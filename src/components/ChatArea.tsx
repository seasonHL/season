import { useEffect, useRef, useState } from "react";
import { Agent } from "@season/agent-core";
import { buildSystemPrompt } from "../agent/systemPrompt";
import { useConfigContext } from "../contexts/ConfigContext";
import { useMemory } from "../hooks/useMemory";
import { useTaskExecutor } from "../hooks/useTaskExecutor";
import { ApiChatProvider } from "../services/agentProvider";
import { loadSkills, selectMentionedSkills, type SkillMetadata } from "../services/skills";
import { toolRuntimes } from "../tools/registry";
import { Conversation, Message, Task, TaskStatus, TaskRequest } from "../types";
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
  const agentRef = useRef<Agent<TaskRequest, { executeTask: (action: TaskRequest["action"]) => Promise<ToolResult> }> | null>(null);
  const approvalResolverRef = useRef<((approved: boolean) => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { config } = useConfigContext();
  const { executeTask } = useTaskExecutor();
  const { memory, loadMemory } = useMemory();

  const createAgent = (
    initialMessages: Message[],
    memorySnapshot = memory,
    skills: SkillMetadata[] = [],
    injectedSkills: SkillMetadata[] = []
  ) => {
    return new Agent<TaskRequest, { executeTask: (action: TaskRequest["action"]) => Promise<ToolResult> }>({
      model: config.model,
      provider: new ApiChatProvider(config),
      systemPrompt: buildSystemPrompt(memorySnapshot, skills, injectedSkills),
      toolRuntimes,
      initialMessages,
      contextCompaction: {
        preserveRecentToolResults: 4,
        maxToolResultChars: 12_000,
        maxTotalMessageChars: 160_000,
      },
    });
  };

  const hasConfiguredModel = () => {
    if (config.models?.some((item) => item.enabled && item.base_url.trim() && item.model.trim())) {
      return true;
    }
    return Boolean(config.base_url.trim());
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
  }, [config.base_url, config.api_key, config.model, config.models, memory]);

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
  const getSessionAgent = (
    currentMessages: Message[],
    memorySnapshot = memory,
    skills: SkillMetadata[] = [],
    injectedSkills: SkillMetadata[] = []
  ) => {
    if (!agentRef.current || memorySnapshot !== memory || skills.length > 0 || injectedSkills.length > 0) {
      agentRef.current = createAgent(currentMessages, memorySnapshot, skills, injectedSkills);
    } else {
      agentRef.current.setMessages(currentMessages);
    }

    return agentRef.current;
  };

  /**
   * 在用户消息或工具结果之后继续模型回合。
   *
   * Agent runtime 负责模型 -> 工具 -> 工具结果 -> 模型的循环；
   * 组件只处理流式展示、审批弹窗、任务状态和持久化。
   */
  const continueConversation = async (
    activeConversation: Conversation,
    currentMessages: Message[],
    currentTasks: Task[],
    memorySnapshot = memory,
    skills: SkillMetadata[] = [],
    injectedSkills: SkillMetadata[] = []
  ) => {
    if (!hasConfiguredModel()) {
      setErrorMessage("请先在设置页面配置至少一个可用模型");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setStreamingAssistantId(null);

    let workingMessages = currentMessages;
    let workingTasks = currentTasks;
    let activeBatchTasks: Task[] = [];

    await getSessionAgent(currentMessages, memorySnapshot, skills, injectedSkills).runWithToolsStream({
      context: { executeTask },
      stream: true,
      onStreamUpdate: ({ message }) => {
        if (!message.content && !message.reasoning_content && !message.tool_calls?.length) {
          return;
        }

        setStreamingAssistantId(message.id);
        setMessages((prev) => upsertMessage(prev, message as Message));
      },
      onAssistantMessage: async (_message, nextMessages) => {
        workingMessages = nextMessages as Message[];
        setMessages(workingMessages);
        await onSaveConversation(activeConversation, workingMessages, workingTasks);
      },
      requestApproval: async (toolCalls) => {
        setPendingToolCalls(toolCalls.map((item) => ({
          ...item,
          status: "pending" as const
        })));
        setIsLoading(false);
        setStreamingAssistantId(null);
        return new Promise<boolean>((resolve) => {
          approvalResolverRef.current = resolve;
        });
      },
      onToolCallsStarted: async (toolCalls) => {
        const now = new Date();
        const executingToolCallItems = toolCalls.map((item) => ({
          ...item,
          status: "executing" as const
        }));

        activeBatchTasks = executingToolCallItems.map((item) => ({
          id: crypto.randomUUID(),
          task_request: item.taskRequest,
          status: TaskStatus.EXECUTING,
          created_at: now,
          updated_at: now
        }));

        workingTasks = [...workingTasks, ...activeBatchTasks];
        setPendingToolCalls([]);
        setExecutingToolCalls(executingToolCallItems);
        setTasks(workingTasks);
        setIsLoading(false);
        setStreamingAssistantId(null);
        await onSaveConversation(activeConversation, workingMessages, workingTasks);
      },
      onToolCallFinished: async (_item, result, index) => {
        setExecutingToolCalls((prev) =>
          prev.map((current, currentIndex) =>
            currentIndex === index
              ? { ...current, result, status: result.success ? "completed" : "failed" }
              : current
          )
        );
      },
      onToolCallsFinished: async (results, nextMessages) => {
        const completedTasks = activeBatchTasks.map((task, index) => ({
          ...task,
          status: results[index]?.result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
          result: results[index]?.result,
          updated_at: new Date()
        }));

        if (completedTasks.length > 0) {
          const completedById = new Map(completedTasks.map((task) => [task.id, task]));
          workingTasks = workingTasks.map((task) => completedById.get(task.id) || task);
          setTasks(workingTasks);
        }

        workingMessages = nextMessages as Message[];
        setMessages(workingMessages);
        setExecutingToolCalls([]);
        await onSaveConversation(activeConversation, workingMessages, workingTasks);
        activeBatchTasks = [];
      },
    }).catch((error) => {
      setErrorMessage(`请求失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }).finally(async () => {
      setIsLoading(false);
      setStreamingAssistantId(null);
      await loadMemory();
    });
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleConfirmToolCalls = async () => {
    if (pendingToolCalls.length === 0) return;

    setPendingToolCalls([]);
    setIsLoading(true);
    approvalResolverRef.current?.(true);
    approvalResolverRef.current = null;
  };

  const handleRejectToolCalls = async () => {
    if (pendingToolCalls.length === 0) return;

    setPendingToolCalls([]);
    setIsLoading(true);
    approvalResolverRef.current?.(false);
    approvalResolverRef.current = null;
  };

  /**
   * 追加用户消息，先持久化乐观状态，再启动流式模型回合。
   */
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    setErrorMessage(null);

    if (!hasConfiguredModel()) {
      setErrorMessage("请先在设置页面配置至少一个可用模型");
      return;
    }

    const userInput = inputText.trim();
    let availableSkills: SkillMetadata[] = [];
    let injectedSkills: SkillMetadata[] = [];

    try {
      availableSkills = await loadSkills();
      injectedSkills = selectMentionedSkills(userInput, availableSkills);
    } catch (error) {
      console.warn("Failed to load skills", error);
    }

    const agent = getSessionAgent(messages, memory, availableSkills, injectedSkills);
    agent.appendUserMessage(userInput);

    const activeConversation = conversation ?? onCreateConversation();
    const currentMessages = agent.messages;

    setMessages(currentMessages);
    setInputText("");
    setIsLoading(true);
    await onSaveConversation(activeConversation, currentMessages, tasks);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    await continueConversation(activeConversation, currentMessages, tasks, memory, availableSkills, injectedSkills);
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
