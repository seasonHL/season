use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::process::Command as ProcessCommand;

#[derive(Debug, Serialize, Deserialize)]
struct Config {
    base_url: String,
    api_key: String,
    model: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", content = "payload")]
pub enum TaskAction {
    FileRead { path: String },
    FileWrite { path: String, content: String },
    ExecuteCommand { command: String, args: Vec<String> },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskRequest {
    pub action: TaskAction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub task_request: TaskRequest,
    pub status: String,
    pub result: Option<TaskResult>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub messages: Vec<Message>,
    pub tasks: Vec<Task>,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn save_config(app: tauri::AppHandle, config: Config) -> Result<(), String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    store.set("base_url", config.base_url);
    store.set("api_key", config.api_key);
    store.set("model", config.model);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn load_config(app: tauri::AppHandle) -> Result<Config, String> {
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
    Ok(Config { base_url, api_key, model })
}

fn is_command_allowed(command: &str, args: &[String]) -> bool {
    let allowed_commands: HashSet<&str> = [
        "echo", "ls", "cat", "pwd", "git", "node", "npm", "cargo", "python", "python3"
    ].iter().cloned().collect();
    
    if !allowed_commands.contains(command) {
        return false;
    }
    
    let dangerous_args: HashSet<&str> = [
        "-e", "-c", "--eval", "-exec", "--execute"
    ].iter().cloned().collect();
    
    for arg in args {
        if dangerous_args.contains(arg.as_str()) {
            return false;
        }
        if arg.starts_with("-e=") || arg.starts_with("-c=") {
            return false;
        }
    }
    
    true
}

fn is_path_safe(path: &str) -> bool {
    let path = Path::new(path);
    
    if path.is_absolute() {
        if let Some(home_dir) = dirs::home_dir() {
            let allowed_dirs = [
                home_dir.join("Documents"),
                home_dir.join("Desktop"),
                home_dir.join("Downloads"),
            ];
            
            for allowed_dir in allowed_dirs {
                if path.starts_with(&allowed_dir) {
                    return true;
                }
            }
            return false;
        }
    }
    
    true
}

#[tauri::command]
async fn execute_task(request: TaskRequest) -> TaskResult {
    match request.action {
        TaskAction::FileRead { path } => {
            if !is_path_safe(&path) {
                return TaskResult {
                    success: false,
                    data: None,
                    error: Some("Access denied: path is not in allowed directory".to_string()),
                };
            }
            
            match fs::read_to_string(&path) {
                Ok(content) => TaskResult {
                    success: true,
                    data: Some(content),
                    error: None,
                },
                Err(e) => TaskResult {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                },
            }
        }
        TaskAction::FileWrite { path, content } => {
            if !is_path_safe(&path) {
                return TaskResult {
                    success: false,
                    data: None,
                    error: Some("Access denied: path is not in allowed directory".to_string()),
                };
            }
            
            match fs::write(&path, content) {
                Ok(_) => TaskResult {
                    success: true,
                    data: None,
                    error: None,
                },
                Err(e) => TaskResult {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                },
            }
        }
        TaskAction::ExecuteCommand { command, args } => {
            if !is_command_allowed(&command, &args) {
                return TaskResult {
                    success: false,
                    data: None,
                    error: Some(format!("Command '{}' with args {:?} is not allowed", command, args)),
                };
            }
            
            match ProcessCommand::new(command)
                .args(args)
                .output()
            {
                Ok(output) => {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    
                    if output.status.success() {
                        TaskResult {
                            success: true,
                            data: Some(stdout),
                            error: if stderr.is_empty() { None } else { Some(stderr) },
                        }
                    } else {
                        TaskResult {
                            success: false,
                            data: Some(stdout),
                            error: Some(stderr),
                        }
                    }
                }
                Err(e) => TaskResult {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                },
            }
        }
    }
}

#[tauri::command]
async fn save_conversation(app: tauri::AppHandle, conversation: Conversation) -> Result<(), String> {
    let store = app.store("conversations.json").map_err(|e| e.to_string())?;
    store.reload().ok();
    
    let mut conversations: Vec<Conversation> = store
        .get("conversations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_else(Vec::new);
    
    let index = conversations.iter().position(|c| c.id == conversation.id);
    if let Some(i) = index {
        conversations[i] = conversation;
    } else {
        conversations.push(conversation);
    }
    
    let value = serde_json::to_value(conversations).map_err(|e| e.to_string())?;
    store.set("conversations", value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn load_conversations(app: tauri::AppHandle) -> Result<Vec<Conversation>, String> {
    let store = app.store("conversations.json").map_err(|e| e.to_string())?;
    store.reload().ok();
    
    let conversations: Vec<Conversation> = store
        .get("conversations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_else(Vec::new);
    
    Ok(conversations)
}

#[tauri::command]
async fn load_conversation(app: tauri::AppHandle, id: String) -> Result<Conversation, String> {
    let store = app.store("conversations.json").map_err(|e| e.to_string())?;
    store.reload().ok();
    
    let conversations: Vec<Conversation> = store
        .get("conversations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_else(Vec::new);
    
    conversations
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Conversation not found".to_string())
}

#[tauri::command]
async fn delete_conversation(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let store = app.store("conversations.json").map_err(|e| e.to_string())?;
    store.reload().ok();
    
    let mut conversations: Vec<Conversation> = store
        .get("conversations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_else(Vec::new);
    
    conversations.retain(|c| c.id != id);
    
    let value = serde_json::to_value(conversations).map_err(|e| e.to_string())?;
    store.set("conversations", value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet, save_config, load_config, execute_task, save_conversation, load_conversations, load_conversation, delete_conversation])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
