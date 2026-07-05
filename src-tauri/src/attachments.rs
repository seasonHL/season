use calamine::{open_workbook_auto_from_rs, Data, Range, Reader};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Cursor,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

const MAX_FILE_READ_CHARS: usize = 120_000;
const SPREADSHEET_EXTENSIONS: &[&str] = &["xlsx", "xls", "xlsm", "xlsb", "ods"];
const TEXT_EXTENSIONS: &[&str] = &[
    "txt", "md", "markdown", "csv", "tsv", "json", "jsonl", "yaml", "yml", "toml", "xml", "html",
    "htm", "css", "js", "jsx", "ts", "tsx", "rs", "go", "py", "java", "kt", "swift", "c", "h",
    "cpp", "hpp", "cs", "php", "rb", "sh", "zsh", "bash", "sql", "log",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAttachmentRequest {
    name: String,
    mime_type: String,
    bytes: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedAttachment {
    name: String,
    mime_type: String,
    path: String,
    size: usize,
}

#[tauri::command]
pub fn save_attachment(
    app: tauri::AppHandle,
    request: SaveAttachmentRequest,
) -> Result<SavedAttachment, String> {
    let dir = attachment_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建附件目录: {e}"))?;

    let file_name = unique_file_name(&request.name);
    let path = dir.join(file_name);
    fs::write(&path, &request.bytes).map_err(|e| format!("无法保存附件: {e}"))?;

    Ok(SavedAttachment {
        name: request.name,
        mime_type: request.mime_type,
        path: path.to_string_lossy().to_string(),
        size: request.bytes.len(),
    })
}

pub(crate) fn read_file_for_model(path: &str) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("读取文件失败: {e}"))?;
    let extension = extension_of(path);

    if is_spreadsheet_extension(&extension) {
        return parse_spreadsheet(&bytes, MAX_FILE_READ_CHARS);
    }

    if is_text_extension(&extension) {
        return parse_text(&bytes, MAX_FILE_READ_CHARS);
    }

    match String::from_utf8(bytes) {
        Ok(content) => Ok(truncate_chars(&content, MAX_FILE_READ_CHARS)),
        Err(_) => Ok(format!(
            "[未读取正文：FileRead 暂不支持解析 .{} 二进制文件。支持文本文件和 Excel/ODS 表格。]",
            if extension.is_empty() {
                "unknown"
            } else {
                &extension
            }
        )),
    }
}

pub(crate) fn is_saved_attachment_path(app: &tauri::AppHandle, path: &str) -> bool {
    let Ok(dir) = attachment_dir(app) else {
        return false;
    };
    let Ok(canonical_dir) = dir.canonicalize() else {
        return false;
    };
    let Ok(canonical_path) = Path::new(path).canonicalize() else {
        return false;
    };

    canonical_path.starts_with(canonical_dir)
}

fn attachment_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("attachments"))
        .map_err(|e| format!("无法获取应用数据目录: {e}"))
}

fn unique_file_name(name: &str) -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("{}-{}", timestamp, sanitize_file_name(name))
}

fn sanitize_file_name(name: &str) -> String {
    let file_name = Path::new(name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("attachment");
    let sanitized: String = file_name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') {
                ch
            } else {
                '_'
            }
        })
        .collect();

    if sanitized.trim_matches('_').is_empty() {
        "attachment".to_string()
    } else {
        sanitized
    }
}

fn extension_of(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn is_spreadsheet_extension(extension: &str) -> bool {
    SPREADSHEET_EXTENSIONS.contains(&extension)
}

fn is_text_extension(extension: &str) -> bool {
    TEXT_EXTENSIONS.contains(&extension)
}

fn parse_text(bytes: &[u8], max_chars: usize) -> Result<String, String> {
    let content = String::from_utf8(bytes.to_vec())
        .map_err(|_| "此文件不是有效的 UTF-8 文本，无法作为文本读取".to_string())?;
    Ok(truncate_chars(&content, max_chars))
}

fn parse_spreadsheet(bytes: &[u8], max_chars: usize) -> Result<String, String> {
    let cursor = Cursor::new(bytes.to_vec());
    let mut workbook =
        open_workbook_auto_from_rs(cursor).map_err(|e| format!("无法解析表格文件: {e}"))?;
    let mut sections = Vec::new();

    for sheet_name in workbook.sheet_names().to_owned() {
        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| format!("无法读取工作表 {sheet_name}: {e}"))?;
        sections.push(format!("## 工作表: {sheet_name}\n{}", range_to_csv(&range)));
    }

    if sections.is_empty() {
        return Ok("[表格文件中没有可读取的工作表]".to_string());
    }

    Ok(truncate_chars(&sections.join("\n\n"), max_chars))
}

fn range_to_csv(range: &Range<Data>) -> String {
    range
        .rows()
        .map(|row| {
            row.iter()
                .map(format_cell)
                .map(|value| escape_csv_cell(&value))
                .collect::<Vec<_>>()
                .join(",")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn format_cell(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(value) => value.clone(),
        Data::Float(value) => value.to_string(),
        Data::Int(value) => value.to_string(),
        Data::Bool(value) => value.to_string(),
        Data::DateTime(value) => value.to_string(),
        Data::DateTimeIso(value) => value.clone(),
        Data::DurationIso(value) => value.clone(),
        Data::Error(value) => format!("{value:?}"),
    }
}

fn escape_csv_cell(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn truncate_chars(content: &str, max_chars: usize) -> String {
    if content.chars().count() <= max_chars {
        return content.to_string();
    }

    let truncated = content.chars().take(max_chars).collect::<String>();
    format!("{truncated}\n\n[内容已截断，仅显示前 {max_chars} 个字符]")
}
