import { TaskRequest, ToolCall } from "../../types";

export interface ToolCallItem {
  toolCall: ToolCall;
  taskRequest: TaskRequest;
  result?: {
    success: boolean;
    data?: string;
    error?: string;
  };
  status: "pending" | "executing" | "completed" | "failed";
}
