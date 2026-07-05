import type {
  AgentToolCall,
  AgentToolCallRequest,
  AgentToolDefinition,
  AgentToolRuntime,
} from "./types";

export class ToolRegistry<TTaskRequest = unknown, TContext = unknown> {
  private readonly tools = new Map<string, AgentToolRuntime<TTaskRequest, TContext>>();

  constructor(tools: AgentToolRuntime<TTaskRequest, TContext>[] = []) {
    tools.forEach((tool) => this.register(tool));
  }

  register(tool: AgentToolRuntime<TTaskRequest, TContext>) {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get definitions(): AgentToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.definition);
  }

  resolve(toolCall: AgentToolCall): AgentToolCallRequest<TTaskRequest> | null {
    const runtime = this.tools.get(toolCall.function.name);
    if (!runtime) return null;

    let args: unknown;
    try {
      args = toolCall.function.arguments.trim()
        ? JSON.parse(toolCall.function.arguments)
        : {};
    } catch {
      return null;
    }

    const taskRequest = runtime.parse(args, toolCall);
    return taskRequest ? { toolCall, taskRequest } : null;
  }

  runtimeFor(toolCall: AgentToolCall) {
    return this.tools.get(toolCall.function.name);
  }

  requiresApproval(
    item: AgentToolCallRequest<TTaskRequest>,
    context: TContext
  ): boolean {
    const runtime = this.runtimeFor(item.toolCall);
    return runtime?.requiresApproval?.(item.taskRequest, item.toolCall, context) ?? true;
  }

  async execute(
    item: AgentToolCallRequest<TTaskRequest>,
    context: TContext
  ) {
    const runtime = this.runtimeFor(item.toolCall);
    if (!runtime) {
      return {
        success: false,
        error: `Unsupported tool: ${item.toolCall.function.name}`,
      };
    }

    return runtime.execute(item.taskRequest, item.toolCall, context);
  }
}
