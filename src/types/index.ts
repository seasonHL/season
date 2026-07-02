import { Static, Type } from "@sinclair/typebox";
import type { AgentToolCall } from "@season/agent-core";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: Date;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
}

export type ToolCall = AgentToolCall;

export interface Config {
  base_url: string;
  api_key: string;
  model: string;
  models?: ModelConfig[];
}

export interface ModelConfig {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  enabled: boolean;
}

export type View = "chat" | "settings";
export interface ChatRequest {
  model: string;
  messages: Array<{
    role: "user" | "assistant" | "system" | "tool";
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    reasoning_content?: string;
  }>;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
      };
    };
  }>;
  tool_choice?: string | { type: "function"; function: { name: string } };
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  tool_calls?: ToolCall[];
  reasoning_content?: string;
  error?: string;
  finish_reason?: string;
  output_tokens?: number;
}

const FileReadSchema = Type.Object({
 type: Type.Literal("FileRead"),
 payload: Type.Object({
 path: Type.String(),
 }),
});
const FileWriteSchema = Type.Object({
 type: Type.Literal("FileWrite"),
 payload: Type.Object({
 path: Type.String(),
 content: Type.String(),
 }),
});
const ExecuteCommandSchema = Type.Object({
 type: Type.Literal("ExecuteCommand"),
 payload: Type.Object({
 command: Type.String(),
 args: Type.Array(Type.String()),
 }),
});
const MemoryReadSchema = Type.Object({
 type: Type.Literal("MemoryRead"),
 payload: Type.Object({}),
});
const MemoryWriteSchema = Type.Object({
 type: Type.Literal("MemoryWrite"),
 payload: Type.Object({
 content: Type.String(),
 }),
});
export type TaskActionSchema = typeof FileReadSchema | typeof FileWriteSchema | typeof ExecuteCommandSchema | typeof MemoryReadSchema | typeof MemoryWriteSchema;
export type TaskAction = Static<TaskActionSchema>;
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
