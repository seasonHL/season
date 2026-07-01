use crate::models::Config;
use tauri_plugin_store::StoreExt;

#[tauri::command]
pub async fn save_config(app: tauri::AppHandle, config: Config) -> Result<(), String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    store.set("base_url", config.base_url);
    store.set("api_key", config.api_key);
    store.set("model", config.model);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn load_config(app: tauri::AppHandle) -> Result<Config, String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    store.reload().ok();
    let base_url = store
        .get("base_url")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "".to_string());
    let api_key = store
        .get("api_key")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "".to_string());
    let model = store
        .get("model")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "deepseek-v4-pro".to_string());
    Ok(Config {
        base_url,
        api_key,
        model,
    })
}
