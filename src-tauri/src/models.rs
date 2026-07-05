use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    #[serde(default)]
    pub models: Vec<ModelConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelConfig {
    pub id: String,
    pub name: String,
    #[serde(default = "default_provider")]
    pub provider: String,
    #[serde(default)]
    pub provider_name: Option<String>,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub enabled: bool,
}

fn default_provider() -> String {
    "default".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", content = "payload")]
pub enum TaskAction {
    FileRead { path: String },
    FileWrite { path: String, content: String },
    ExecuteCommand { command: String, args: Vec<String> },
    MemoryRead,
    MemoryWrite { content: String },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskRequest {
    pub action: TaskAction,
    #[serde(default)]
    pub permission_mode: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillMetadata {
    pub name: String,
    pub description: String,
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub function: ToolFunction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub tool_call_id: Option<String>,
    pub reasoning_content: Option<String>,
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
