mod attachments;
mod config;
mod conversations;
mod memory;
mod models;
mod security;
mod skills;
mod task;

use attachments::save_attachment;
use config::{load_config, save_config};
use conversations::{
    delete_conversation, load_conversation, load_conversations, save_conversation,
};
use memory::{load_memory, save_memory};
use skills::list_skills;
use task::execute_task;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            save_attachment,
            save_config,
            load_config,
            execute_task,
            load_memory,
            save_memory,
            list_skills,
            save_conversation,
            load_conversations,
            load_conversation,
            delete_conversation
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
