import { useEffect, useRef, useState } from "react";
import { Agent } from "@season/agent-core";
import { buildSystemPrompt } from "../agent/systemPrompt";
import { useConfigContext } from "../contexts/ConfigContext";
import { useMemory } from "../hooks/useMemory";
import { useTaskExecutor } from "../hooks/useTaskExecutor";
import { ApiChatProvider } from "../services/agentProvider";
import { parseToolCallToTaskRequest, toolDefinitions } from "../tools/registry";
import { Conversation, Message, Task, TaskStatus, TaskRequest, ToolCall } from "../types";
import ChatComposer from "./chat/ChatComposer";
import ChatHeader from "./chat/ChatHeader";
import ChatMessageList from "./chat/ChatMessageList";
import ErrorBanner from "./chat/ErrorBanner";
import { ToolCallItem } from "./chat/types";
import TaskConfirmation from "./TaskConfirmation";

interface ChatAreaProps {
  conversation: Conversation | null;
  onCreateConversation: () => Conversation;
  onSaveConversation: (
    conversation: Conversation,
    messages: Message[],
    tasks: Task[]
  ) => Promise<void>;
}

type ToolResult = {
  success: boolean;
  data?: string;
  error?: string;
};

function upsertMessage(messages: Message[], message: Message) {
  const existingIndex = messages.findIndex((item) => item.id === message.id);
  if (existingIndex === -1) {
    return [...messages, message];
  }

  return messages.map((item, index) => index === existingIndex ? message : item);
}

function ChatArea({ conversation, onCreateConversation, onSaveConversation }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCallItem[]>([]);
  const [executingToolCalls, setExecutingToolCalls] = useState<ToolCallItem[]>([]);
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
  const agentRef = useRef<Agent<TaskRequest> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { config } = useConfigContext();
  const { executeTask } = useTaskExecutor();
  const { memory, loadMemory } = useMemory();

  const createAgent = (initialMessages: Message[], memorySnapshot = memory) => {
    return new Agent<TaskRequest>({
      model: config.model,
      provider: new ApiChatProvider(config),
      systemPrompt: buildSystemPrompt(memorySnapshot),
      tools: toolDefinitions,
      initialMessages,
      parseToolCall: parseToolCallToTaskRequest,
    });
  };

  useEffect(() => {
    const conversationMessages = conversation?.messages || [];
    setMessages(conversationMessages);
    setTasks(conversation?.tasks || []);
    setInputText("");
    setErrorMessage(null);
    setPendingToolCalls([]);
    setExecutingToolCalls([]);
    setStreamingAssistantId(null);
    agentRef.current = createAgent(conversationMessages);
  }, [conversation?.id]);

  useEffect(() => {
    agentRef.current = createAgent(messages);
  }, [config.base_url, config.api_key, config.model, memory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, executingToolCalls]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  /**
   * 获取当前会话级 Agent，并把本轮需要的消息历史同步进去。
   *
   * 默认复用 `agentRef` 中的实例；只有记忆快照显式变化时才重建，
   * 让后续请求使用新的 system prompt。
   */
  const getSessionAgent = (currentMessages: Message[], memorySnapshot = memory) => {
    if (!agentRef.current || memorySnapshot !== memory) {
      agentRef.current = createAgent(currentMessages, memorySnapshot);
    } else {
      agentRef.current.setMessages(currentMessages);
    }

    return agentRef.current;
  };

  /**
   * 在用户消息或工具结果之后继续模型回合。
   *
   * 流式片段会就地更新正在生成的助手消息；完成后持久化最终消息，
   * 如果模型返回工具调用，则进入用户确认流程。
   */
  const continueConversation = async (
    activeConversation: Conversation,
    currentMessages: Message[],
    currentTasks: Task[],
    memorySnapshot = memory
  ) => {
    if (!config.base_url) {
      setErrorMessage("请先在设置页面配置 API 地址");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setStreamingAssistantId(null);

    const result = await getSessionAgent(currentMessages, memorySnapshot).runStream(({ message }) => {
      if (!message.content && !message.reasoning_content && !message.tool_calls?.length) {
        return;
      }

      setStreamingAssistantId(message.id);
      setMessages(upsertMessage(currentMessages, message as Message));
    }).catch((error) => {
      setErrorMessage(`请求失败: ${error instanceof Error ? error.message : "未知错误"}`);
      setIsLoading(false);
      setStreamingAssistantId(null);
      return null;
    });

    if (!result) return;

    if (result.assistantMessage) {
      currentMessages = upsertMessage(currentMessages, result.assistantMessage as Message);
      setMessages(currentMessages);
      await onSaveConversation(activeConversation, currentMessages, currentTasks);
    }

    if (result.toolCalls.length > 0) {
      setPendingToolCalls(result.toolCalls.map((item) => ({
        ...item,
        status: "pending" as const
      })));
    }

    setIsLoading(false);
    setStreamingAssistantId(null);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  /**
   * 顺序执行已确认的工具调用，并把每次执行结果同步到执行中 UI。
   */
  const executeToolCalls = async (toolCalls: ToolCallItem[]) => {
    const toolResults: Array<{ toolCall: ToolCall; result: ToolResult }> = [];

    for (let i = 0; i < toolCalls.length; i++) {
      const item = toolCalls[i];

      try {
        const result = await executeTask(item.taskRequest.action);
        toolResults.push({ toolCall: item.toolCall, result });

        setExecutingToolCalls((prev) =>
          prev.map((current, index) =>
            index === i ? { ...current, result, status: result.success ? "completed" : "failed" } : current
          )
        );
      } catch (error) {
        const result = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        };
        toolResults.push({ toolCall: item.toolCall, result });

        setExecutingToolCalls((prev) =>
          prev.map((current, index) =>
            index === i ? { ...current, result, status: "failed" } : current
          )
        );
      }
    }

    return toolResults;
  };

  /**
   * 将待确认工具调用转换为任务并执行，写入工具结果消息后继续模型对话。
   */
  const handleConfirmToolCalls = async () => {
    if (pendingToolCalls.length === 0 || !conversation) return;

    const now = new Date();
    const toolCallsToRun: ToolCallItem[] = pendingToolCalls.map((item) => ({
      ...item,
      status: "executing"
    }));
    const newTasks: Task[] = toolCallsToRun.map((item) => ({
      id: crypto.randomUUID(),
      task_request: item.taskRequest,
      status: TaskStatus.EXECUTING,
      created_at: now,
      updated_at: now
    }));

    setExecutingToolCalls((prev) => [...prev, ...toolCallsToRun]);
    setPendingToolCalls([]);
    setTasks((prev) => [...prev, ...newTasks]);
    await onSaveConversation(conversation, messages, [...tasks, ...newTasks]);

    const toolResults = await executeToolCalls(toolCallsToRun);
    const completedNewTasks = newTasks.map((task, index) => ({
      ...task,
      status: toolResults[index]?.result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
      result: toolResults[index]?.result,
      updated_at: new Date()
    }));
    const updatedTasks = [...tasks, ...completedNewTasks];
    const toolMessages = toolResults.map(({ toolCall, result }) =>
      Agent.createToolMessage(toolCall, result)
    ) as Message[];
    const allMessages = [...messages, ...toolMessages];

    setMessages(allMessages);
    setTasks(updatedTasks);
    setExecutingToolCalls([]);
    await onSaveConversation(conversation, allMessages, updatedTasks);

    const latestMemory = await loadMemory();
    await continueConversation(conversation, allMessages, updatedTasks, latestMemory);
  };

  const handleRejectToolCalls = () => {
    setPendingToolCalls([]);
  };

  /**
   * 追加用户消息，先持久化乐观状态，再启动流式模型回合。
   */
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    setErrorMessage(null);

    if (!config.base_url) {
      setErrorMessage("请先在设置页面配置 API 地址");
      return;
    }

    const agent = getSessionAgent(messages);
    agent.appendUserMessage(inputText.trim());

    const activeConversation = conversation ?? onCreateConversation();
    const currentMessages = agent.messages;

    setMessages(currentMessages);
    setInputText("");
    setIsLoading(true);
    await onSaveConversation(activeConversation, currentMessages, tasks);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    await continueConversation(activeConversation, currentMessages, tasks);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[linear-gradient(180deg,#fbfdfc_0%,#f1f7f5_100%)] h-screen">
      <ChatHeader />
      {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />}

      <ChatMessageList
        messages={messages}
        executingToolCalls={executingToolCalls}
        isLoading={isLoading}
        streamingAssistantId={streamingAssistantId}
        messagesEndRef={messagesEndRef}
        formatTime={formatTime}
      />

      <ChatComposer
        value={inputText}
        isLoading={isLoading}
        textareaRef={textareaRef}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
        onSend={handleSendMessage}
      />

      {pendingToolCalls.length > 0 && (
        <TaskConfirmation
          toolCalls={pendingToolCalls.map((item) => ({
            id: item.toolCall.id,
            name: item.toolCall.function.name,
            arguments: item.toolCall.function.arguments,
            taskRequest: item.taskRequest
          }))}
          onConfirm={handleConfirmToolCalls}
          onReject={handleRejectToolCalls}
        />
      )}
    </div>
  );
}

export default ChatArea;
