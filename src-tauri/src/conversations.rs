use crate::models::Conversation;
use tauri_plugin_store::StoreExt;

fn load_all_conversations(app: &tauri::AppHandle) -> Result<Vec<Conversation>, String> {
    let store = app.store("conversations.json").map_err(|e| e.to_string())?;
    store.reload().ok();

    let conversations = store
        .get("conversations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_else(Vec::new);

    Ok(conversations)
}

fn save_all_conversations(
    app: &tauri::AppHandle,
    conversations: Vec<Conversation>,
) -> Result<(), String> {
    let store = app.store("conversations.json").map_err(|e| e.to_string())?;
    let value = serde_json::to_value(conversations).map_err(|e| e.to_string())?;
    store.set("conversations", value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn save_conversation(
    app: tauri::AppHandle,
    conversation: Conversation,
) -> Result<(), String> {
    let mut conversations = load_all_conversations(&app)?;

    let index = conversations.iter().position(|c| c.id == conversation.id);
    if let Some(i) = index {
        conversations[i] = conversation;
    } else {
        conversations.push(conversation);
    }

    save_all_conversations(&app, conversations)
}

#[tauri::command]
pub async fn load_conversations(app: tauri::AppHandle) -> Result<Vec<Conversation>, String> {
    load_all_conversations(&app)
}

#[tauri::command]
pub async fn load_conversation(app: tauri::AppHandle, id: String) -> Result<Conversation, String> {
    let conversations = load_all_conversations(&app)?;

    conversations
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Conversation not found".to_string())
}

#[tauri::command]
pub async fn delete_conversation(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut conversations = load_all_conversations(&app)?;
    conversations.retain(|c| c.id != id);
    save_all_conversations(&app, conversations)
}
