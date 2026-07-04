use crate::models::{Config, ModelConfig};
use tauri_plugin_store::StoreExt;

#[tauri::command]
pub async fn save_config(app: tauri::AppHandle, config: Config) -> Result<(), String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    store.set("base_url", config.base_url.clone());
    store.set("api_key", config.api_key.clone());
    store.set("model", config.model.clone());
    store.set(
        "models",
        serde_json::to_value(&config.models).map_err(|e| e.to_string())?,
    );
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
    let mut models = store
        .get("models")
        .and_then(|v| serde_json::from_value::<Vec<ModelConfig>>(v.clone()).ok())
        .unwrap_or_default();

    if models.is_empty() {
        models.push(ModelConfig {
            id: "primary".to_string(),
            name: "主模型".to_string(),
            provider: "default".to_string(),
            provider_name: Some("Default".to_string()),
            base_url: base_url.clone(),
            api_key: api_key.clone(),
            model: model.clone(),
            enabled: true,
        });
    }

    Ok(Config {
        base_url,
        api_key,
        model,
        models,
    })
}
