export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface Config {
  base_url: string;
  api_key: string;
  model: string;
}

export type View = "chat" | "settings";

export interface ChatRequest {
  model: string;
  messages: {
    role: "user" | "assistant" | "system";
    content: string;
  }[];
  thinking?: { type: "enabled" };
  reasoning_effort?: string;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  error?: string;
}

export type TaskAction =
  | { type: "FileRead"; payload: { path: string } }
  | { type: "FileWrite"; payload: { path: string; content: string } }
  | { type: "ExecuteCommand"; payload: { command: string; args: string[] } };

export interface TaskRequest {
  action: TaskAction;
}

export interface TaskResult {
  success: boolean;
  data?: string;
  error?: string;
}

export enum TaskStatus {
  PENDING = "pending",
  EXECUTING = "executing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface Task {
  id: string;
  task_request: TaskRequest;
  status: TaskStatus;
  result?: TaskResult;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  tasks: Task[];
  created_at: Date;
  updated_at: Date;
}
