use crate::attachments::{is_saved_attachment_path, read_file_for_model};
use crate::memory::{append_memory, read_memory};
use crate::models::{TaskAction, TaskRequest, TaskResult};
use crate::security::{is_command_allowed, is_path_safe};
use std::fs;
use std::process::Command as ProcessCommand;

#[tauri::command]
pub async fn execute_task(app: tauri::AppHandle, request: TaskRequest) -> TaskResult {
    let has_full_access = request.permission_mode.as_deref() == Some("full-access");

    match request.action {
        TaskAction::FileRead { path } => {
            if !has_full_access && !is_path_safe(&path) && !is_saved_attachment_path(&app, &path) {
                return TaskResult {
                    success: false,
                    data: None,
                    error: Some("Access denied: path is not in allowed directory".to_string()),
                };
            }

            match read_file_for_model(&path) {
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
            if !has_full_access && !is_path_safe(&path) {
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
            if !has_full_access && !is_command_allowed(&command, &args) {
                return TaskResult {
                    success: false,
                    data: None,
                    error: Some(format!(
                        "Command '{}' with args {:?} is not allowed",
                        command, args
                    )),
                };
            }

            match ProcessCommand::new(command).args(args).output() {
                Ok(output) => {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

                    if output.status.success() {
                        TaskResult {
                            success: true,
                            data: Some(stdout),
                            error: if stderr.is_empty() {
                                None
                            } else {
                                Some(stderr)
                            },
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
        TaskAction::MemoryRead => match read_memory(&app) {
            Ok(content) => TaskResult {
                success: true,
                data: Some(if content.trim().is_empty() {
                    "暂无长期记忆".to_string()
                } else {
                    content
                }),
                error: None,
            },
            Err(e) => TaskResult {
                success: false,
                data: None,
                error: Some(e),
            },
        },
        TaskAction::MemoryWrite { content } => match append_memory(&app, content) {
            Ok(memory) => TaskResult {
                success: true,
                data: Some(format!("长期记忆已更新:\n{}", memory)),
                error: None,
            },
            Err(e) => TaskResult {
                success: false,
                data: None,
                error: Some(e),
            },
        },
    }
}
