import type { PermissionMode, TaskAction, TaskRequest, TaskResult } from "../types";

export interface DesktopToolContext {
  executeTask: (action: TaskAction) => Promise<TaskResult>;
  permissionMode: PermissionMode;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function createTaskRequest(action: TaskAction): TaskRequest {
  return { action };
}

export function executeTaskRequest(
  context: DesktopToolContext,
  taskRequest: TaskRequest
): Promise<TaskResult> {
  return context.executeTask(taskRequest.action);
}
