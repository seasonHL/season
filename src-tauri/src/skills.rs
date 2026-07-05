use crate::models::SkillMetadata;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

const SKILL_FILE_NAME: &str = "SKILL.md";
const MAX_SCAN_DEPTH: usize = 6;
const MAX_SKILL_FILE_BYTES: u64 = 256 * 1024;

#[tauri::command]
pub async fn list_skills() -> Result<Vec<SkillMetadata>, String> {
    let roots = skill_roots();
    let mut seen_paths = HashSet::new();
    let mut skills = Vec::new();

    for root in roots {
        scan_skill_root(&root, 0, &mut seen_paths, &mut skills);
    }

    skills.sort_by(|left, right| {
        left.name
            .cmp(&right.name)
            .then_with(|| left.path.cmp(&right.path))
    });

    Ok(skills)
}

fn skill_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(current_dir) = std::env::current_dir() {
        for ancestor in current_dir.ancestors() {
            roots.push(ancestor.join(".agents").join("skills"));
            roots.push(ancestor.join("skills"));
        }
    }

    if let Some(home_dir) = dirs::home_dir() {
        roots.push(home_dir.join(".agents").join("skills"));
    }

    dedupe_paths(roots)
        .into_iter()
        .filter(|path| path.is_dir())
        .collect()
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::new();

    for path in paths {
        let key = fs::canonicalize(&path).unwrap_or(path.clone());
        if seen.insert(key) {
            deduped.push(path);
        }
    }

    deduped
}

fn scan_skill_root(
    dir: &Path,
    depth: usize,
    seen_paths: &mut HashSet<PathBuf>,
    skills: &mut Vec<SkillMetadata>,
) {
    if depth > MAX_SCAN_DEPTH {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();

        if file_name.starts_with('.') {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        if metadata.is_dir() {
            scan_skill_root(&path, depth + 1, seen_paths, skills);
            continue;
        }

        if !metadata.is_file() || file_name != SKILL_FILE_NAME {
            continue;
        }

        if metadata.len() > MAX_SKILL_FILE_BYTES {
            continue;
        }

        let canonical_path = fs::canonicalize(&path).unwrap_or(path.clone());
        if !seen_paths.insert(canonical_path.clone()) {
            continue;
        }

        if let Ok(content) = fs::read_to_string(&path) {
            if let Some(skill) = parse_skill_file(&canonical_path, &content) {
                skills.push(skill);
            }
        }
    }
}

fn parse_skill_file(path: &Path, content: &str) -> Option<SkillMetadata> {
    let frontmatter = extract_frontmatter(content)?;
    let name = frontmatter_value(frontmatter, "name")
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| default_skill_name(path));
    let description = frontmatter_value(frontmatter, "description")?;

    if description.is_empty() {
        return None;
    }

    Some(SkillMetadata {
        name,
        description,
        path: path.to_string_lossy().into_owned(),
        content: content.to_string(),
    })
}

fn extract_frontmatter(content: &str) -> Option<&str> {
    let trimmed = content.strip_prefix("---")?;
    let trimmed = trimmed
        .strip_prefix('\n')
        .or_else(|| trimmed.strip_prefix("\r\n"))?;
    let end = trimmed.find("\n---").or_else(|| trimmed.find("\r\n---"))?;
    Some(&trimmed[..end])
}

fn frontmatter_value(frontmatter: &str, key: &str) -> Option<String> {
    let prefix = format!("{key}:");

    for line in frontmatter.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with(&prefix) {
            continue;
        }

        let value = trimmed[prefix.len()..].trim();
        return Some(unquote(value));
    }

    None
}

fn unquote(value: &str) -> String {
    let value = value.trim();
    let unquoted = value
        .strip_prefix('"')
        .and_then(|inner| inner.strip_suffix('"'))
        .or_else(|| {
            value
                .strip_prefix('\'')
                .and_then(|inner| inner.strip_suffix('\''))
        })
        .unwrap_or(value);

    unquoted.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn default_skill_name(path: &Path) -> String {
    path.parent()
        .and_then(|parent| parent.file_name())
        .and_then(|name| name.to_str())
        .map(|name| name.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "skill".to_string())
}
