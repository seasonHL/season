import { Agent, AgentEvent, convertToLlm, type AgentMessage } from "@earendil-works/pi-agent-core";
import { ChatRequest, ChatResponse, TaskAction, TaskRequest, TaskResult } from "../types";
import { invoke } from "@tauri-apps/api/core";
export type { AgentEvent };
const buildApiUrl = (baseUrl: string): string => {
 if (!baseUrl)
 return "";
 let url = baseUrl.trim();
 if (url.endsWith("/")) {
 url = url.slice(0, -1);
 }
 if (url.includes("anthropic")) {
 return `${url}/v1/messages`;
 }
 return `${url}/chat/completions`;
};
export const sendChatMessage = async (
 baseUrl: string,
 apiKey: string,
 request: ChatRequest
): Promise<ChatResponse> => {
 try {
 if (!baseUrl) {
 return {
 content: "",
 error: "请先在设置页面配置 API 地址",
 };
 }
 const apiUrl = buildApiUrl(baseUrl);
 console.log(`构建的 API URL: ${apiUrl}`);
 const headers: Record<string, string> = {
 "Content-Type": "application/json",
 };
 if (apiKey) {
 headers["Authorization"] = `Bearer ${apiKey}`;
 }
 console.log(`API 请求头:`, headers);
 console.log(`API 请求体:`, JSON.stringify(request, null, 2));
 const response = await fetch(apiUrl, {
 method: "POST",
 headers,
 body: JSON.stringify(request),
 });
 if (!response.ok) {
 const errorText = await response.text();
 console.error(`API 响应错误 - 状态码: ${response.status}`);
 console.error(`API 响应内容: ${errorText}`);
 throw new Error(`HTTP ${response.status}: ${errorText}`);
 }
 const data = await response.json();
 let content = "";
 if (typeof data === "string") {
 content = data;
 }
 else if (data.content) {
 content = data.content;
 }
 else if (data.choices && data.choices[0]?.message?.content) {
 content = data.choices[0].message.content;
 }
 else {
 throw new Error("Invalid response format");
 }
 return { content };
 }
 catch (error) {
 const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
 return {
 content: "",
 error: errorMessage,
 };
 }
};
export const parseTaskFromResponse = (content: string): TaskRequest | null => {
 try {
 const taskRegex = /<task>([\s\S]*?)<\/task>/;
 const match = content.match(taskRegex);
 if (!match) {
 return null;
 }
 const taskJson = JSON.parse(match[1].trim());
 let action: TaskAction;
 switch (taskJson.type) {
 case "FileRead":
 action = {
 type: "FileRead",
 payload: { path: taskJson.path }
 };
 break;
 case "FileWrite":
 action = {
 type: "FileWrite",
 payload: {
 path: taskJson.path,
 content: taskJson.content
 }
 };
 break;
 case "ExecuteCommand":
 action = {
 type: "ExecuteCommand",
 payload: {
 command: taskJson.command,
 args: taskJson.args || []
 }
 };
 break;
 default:
 return null;
 }
 return { action };
 }
 catch {
 return null;
 }
};
export const extractTextWithoutTask = (content: string): string => {
 return content.replace(/<task>[\s\S]*?<\/task>/, "").trim();
};
const executeTaskAction = async (action: TaskAction): Promise<TaskResult> => {
 try {
 const request: TaskRequest = { action };
 const result = await invoke<TaskResult>('execute_task', { request });
 return result;
 }
 catch (error) {
 return {
 success: false,
 error: error instanceof Error ? error.message : 'Unknown error',
 };
 }
};
export const createAgent = (apiKey: string, onEvent: (event: AgentEvent) => void) => {
 const agent = new Agent({
 convertToLlm: (messages: AgentMessage[]) => convertToLlm(messages),
 getApiKey: () => apiKey,
 toolExecution: "sequential",
 beforeToolCall: async (context) => {
 console.log("准备执行工具:", context.toolCall);
 return undefined;
 },
 afterToolCall: async (context) => {
 console.log("工具执行完成:", context.result);
 return undefined;
 },
 });
 const unsubscribe = agent.subscribe((event) => {
 onEvent(event);
 });
 return { agent, unsubscribe };
};
export const executeTaskWithAgent = async (action: TaskAction): Promise<TaskResult> => {
 return executeTaskAction(action);
};