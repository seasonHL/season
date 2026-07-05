import type { AgentToolRuntime } from "@season/agent-core";
import type { TaskRequest } from "../types";
import {
  executeCommandToolDefinition,
  fileReadToolDefinition,
  fileWriteToolDefinition,
  memoryReadToolDefinition,
  memoryWriteToolDefinition,
} from "./definitions";
import {
  parseExecuteCommandRequest,
  parseFileReadRequest,
  parseFileWriteRequest,
  parseMemoryReadRequest,
  parseMemoryWriteRequest,
} from "./parsers";
import { executeTaskRequest } from "./runtime";
import type { DesktopToolContext } from "./runtime";

export const toolRuntimes: AgentToolRuntime<TaskRequest, DesktopToolContext>[] = [
  {
    name: "FileRead",
    definition: fileReadToolDefinition,
    parse: parseFileReadRequest,
    requiresApproval: () => false,
    execute: (taskRequest, _toolCall, context) => executeTaskRequest(context, taskRequest),
  },
  {
    name: "FileWrite",
    definition: fileWriteToolDefinition,
    parse: parseFileWriteRequest,
    requiresApproval: (_request, _toolCall, context) => context.permissionMode !== "full-access",
    execute: (taskRequest, _toolCall, context) => executeTaskRequest(context, taskRequest),
  },
  {
    name: "ExecuteCommand",
    definition: executeCommandToolDefinition,
    parse: parseExecuteCommandRequest,
    requiresApproval: (_request, _toolCall, context) => context.permissionMode !== "full-access",
    execute: (taskRequest, _toolCall, context) => executeTaskRequest(context, taskRequest),
  },
  {
    name: "MemoryRead",
    definition: memoryReadToolDefinition,
    parse: parseMemoryReadRequest,
    requiresApproval: () => false,
    execute: (taskRequest, _toolCall, context) => executeTaskRequest(context, taskRequest),
  },
  {
    name: "MemoryWrite",
    definition: memoryWriteToolDefinition,
    parse: parseMemoryWriteRequest,
    requiresApproval: (_request, _toolCall, context) => context.permissionMode !== "full-access",
    execute: (taskRequest, _toolCall, context) => executeTaskRequest(context, taskRequest),
  },
];
