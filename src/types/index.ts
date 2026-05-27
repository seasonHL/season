import { AgentMessage as CoreAgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import { Static, Type } from "@sinclair/typebox";
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
 thinking?: {
 type: "enabled";
 };
 reasoning_effort?: string;
 stream?: boolean;
}
export interface ChatResponse {
 content: string;
 error?: string;
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
export type TaskActionSchema = typeof FileReadSchema | typeof FileWriteSchema | typeof ExecuteCommandSchema;
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
export type AgentMessage = CoreAgentMessage;
export type AppAgentTool = AgentTool<TaskActionSchema, TaskResult>;