use tauri_plugin_store::StoreExt;

const MEMORY_KEY: &str = "content";

pub fn read_memory(app: &tauri::AppHandle) -> Result<String, String> {
    let store = app.store("memory.json").map_err(|e| e.to_string())?;
    store.reload().ok();
    let content = store
        .get(MEMORY_KEY)
        .and_then(|value| value.as_str().map(|s| s.to_string()))
        .unwrap_or_default();
    Ok(content)
}

pub fn append_memory(app: &tauri::AppHandle, content: String) -> Result<String, String> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err("Memory content cannot be empty".to_string());
    }

    let store = app.store("memory.json").map_err(|e| e.to_string())?;
    store.reload().ok();

    let current = store
        .get(MEMORY_KEY)
        .and_then(|value| value.as_str().map(|s| s.to_string()))
        .unwrap_or_default();
    let next = if current.trim().is_empty() {
        format!("- {}", trimmed)
    } else {
        format!("{}\n- {}", current.trim_end(), trimmed)
    };

    store.set(MEMORY_KEY, next.clone());
    store.save().map_err(|e| e.to_string())?;
    Ok(next)
}

#[tauri::command]
pub async fn load_memory(app: tauri::AppHandle) -> Result<String, String> {
    read_memory(&app)
}

#[tauri::command]
pub async fn save_memory(app: tauri::AppHandle, content: String) -> Result<String, String> {
    append_memory(&app, content)
}
