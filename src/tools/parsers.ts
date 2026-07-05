import type { TaskRequest } from "../types";
import { asRecord, createTaskRequest } from "./runtime";

export function parseFileReadRequest(args: unknown): TaskRequest | null {
  const input = asRecord(args);
  if (!input.path) return null;

  return createTaskRequest({
    type: "FileRead",
    payload: { path: String(input.path) },
  });
}

export function parseFileWriteRequest(args: unknown): TaskRequest | null {
  const input = asRecord(args);
  if (!input.path || input.content === undefined) return null;

  return createTaskRequest({
    type: "FileWrite",
    payload: {
      path: String(input.path),
      content: String(input.content),
    },
  });
}

export function parseExecuteCommandRequest(args: unknown): TaskRequest | null {
  const input = asRecord(args);
  if (!input.command) return null;

  return createTaskRequest({
    type: "ExecuteCommand",
    payload: {
      command: String(input.command),
      args: Array.isArray(input.args) ? input.args.map(String) : [],
    },
  });
}

export function parseMemoryReadRequest(): TaskRequest {
  return createTaskRequest({
    type: "MemoryRead",
    payload: {},
  });
}

export function parseMemoryWriteRequest(args: unknown): TaskRequest | null {
  const input = asRecord(args);
  if (!input.content) return null;

  return createTaskRequest({
    type: "MemoryWrite",
    payload: { content: String(input.content) },
  });
}
