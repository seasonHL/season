import { useState, useRef, useEffect } from "react";
import { Message, TaskRequest, Task, TaskStatus, Conversation, ToolCall } from "../types";
import { useConfigContext } from "../contexts/ConfigContext";
import { useMemory } from "../hooks/useMemory";
import { useTaskExecutor } from "../hooks/useTaskExecutor";
import { Agent } from "@season/agent-core";
import { buildSystemPrompt } from "../agent/systemPrompt";
import { ApiChatProvider } from "../services/agentProvider";
import { parseToolCallToTaskRequest, toolDefinitions } from "../tools/registry";
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

interface ToolCallItem {
  toolCall: ToolCall;
  taskRequest: TaskRequest;
  result?: {
    success: boolean;
    data?: string;
    error?: string;
  };
  status: "pending" | "executing" | "completed" | "failed";
}

function ChatArea({ conversation, onCreateConversation, onSaveConversation }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCallItem[]>([]);
  const [executingToolCalls, setExecutingToolCalls] = useState<ToolCallItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { config } = useConfigContext();
  const { executeTask } = useTaskExecutor();
  const { memory, loadMemory } = useMemory();

  useEffect(() => {
    setMessages(conversation?.messages || []);
    setTasks(conversation?.tasks || []);
    setInputText("");
    setErrorMessage(null);
    setPendingToolCalls([]);
    setExecutingToolCalls([]);
  }, [conversation?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, executingToolCalls]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleConfirmToolCalls = async () => {
    if (pendingToolCalls.length === 0 || !conversation) return;

    const now = new Date();
    const newExecutingToolCalls: ToolCallItem[] = pendingToolCalls.map(tc => ({
      ...tc,
      status: "executing" as const
    }));

    setExecutingToolCalls(prev => [...prev, ...newExecutingToolCalls]);
    setPendingToolCalls([]);

    const newTasks: Task[] = newExecutingToolCalls.map(tc => ({
      id: crypto.randomUUID(),
      task_request: tc.taskRequest,
      status: TaskStatus.EXECUTING,
      created_at: now,
      updated_at: now
    }));

    setTasks(prev => [...prev, ...newTasks]);
    await onSaveConversation(conversation, messages, [...tasks, ...newTasks]);

    const toolResults: Array<{ toolCall: ToolCall; result: { success: boolean; data?: string; error?: string } }> = [];

    for (let i = 0; i < newExecutingToolCalls.length; i++) {
      const tc = newExecutingToolCalls[i];
      try {
        const result = await executeTask(tc.taskRequest.action);
        toolResults.push({ toolCall: tc.toolCall, result });

        setExecutingToolCalls(prev => 
          prev.map((item, idx) => 
            idx === i ? { ...item, result, status: result.success ? "completed" as const : "failed" as const } : item
          )
        );
      } catch (error) {
        const errorResult = { 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        };
        toolResults.push({ toolCall: tc.toolCall, result: errorResult });

        setExecutingToolCalls(prev => 
          prev.map((item, idx) => 
            idx === i ? { ...item, result: errorResult, status: "failed" as const } : item
          )
        );
      }
    }

    const toolMessages = toolResults.map(({ toolCall, result }) =>
      Agent.createToolMessage(toolCall, result)
    ) as Message[];

    const completedNewTasks = newTasks.map((task, idx) => ({
      ...task,
      status: toolResults[idx]?.result?.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
      result: toolResults[idx]?.result ? { 
        success: toolResults[idx]!.result.success, 
        data: toolResults[idx]!.result.data, 
        error: toolResults[idx]!.result.error 
      } : undefined,
      updated_at: new Date()
    }));
    const updatedTasks = [...tasks, ...completedNewTasks];

    const allMessages = [...messages, ...toolMessages];
    setMessages(allMessages);
    setTasks(updatedTasks);
    await onSaveConversation(conversation, allMessages, updatedTasks);

    setTimeout(() => {
      setExecutingToolCalls([]);
    }, 2000);

    const latestMemory = await loadMemory();
    await continueConversation(conversation, allMessages, updatedTasks, latestMemory);
  };

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

    const agent = new Agent<TaskRequest>({
      model: config.model,
      provider: new ApiChatProvider(config),
      systemPrompt: buildSystemPrompt(memorySnapshot),
      tools: toolDefinitions,
      initialMessages: currentMessages,
      parseToolCall: parseToolCallToTaskRequest,
    });
    const result = await agent.run().catch((error) => {
      setErrorMessage(`请求失败: ${error instanceof Error ? error.message : "未知错误"}`);
      setIsLoading(false);
      return null;
    });

    if (!result) return;

    if (result.assistantMessage) {
      const messagesWithResponse = [...currentMessages, result.assistantMessage];
      setMessages(messagesWithResponse);
      await onSaveConversation(activeConversation, messagesWithResponse, currentTasks);
      currentMessages = messagesWithResponse;
    }

    if (result.toolCalls.length > 0) {
      setPendingToolCalls(result.toolCalls.map((item) => ({
        ...item,
        status: "pending" as const
      })));
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  };

  const handleRejectToolCalls = () => {
    setPendingToolCalls([]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    setErrorMessage(null);

    if (!config.base_url) {
      setErrorMessage("请先在设置页面配置 API 地址");
      return;
    }

    const agent = new Agent<TaskRequest>({
      model: config.model,
      provider: new ApiChatProvider(config),
      systemPrompt: buildSystemPrompt(memory),
      tools: toolDefinitions,
      initialMessages: messages,
      parseToolCall: parseToolCallToTaskRequest,
    });
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-[linear-gradient(180deg,#fbfdfc_0%,#f1f7f5_100%)] h-screen">
      <header className="h-[72px] bg-white/78 backdrop-blur-xl border-b border-[#dce7e3] flex items-center justify-between px-7">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#167a69] flex items-center justify-center shadow-[0_10px_24px_rgba(22,122,105,0.20)]">
            <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h1 className="text-[#18201e] font-semibold text-base">AI 助手</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#18a076] animate-pulse"></span>
              <p className="text-[#6d7d79] text-xs">在线</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2.5 text-[#7d8d89] hover:text-[#18201e] hover:bg-[#eef4f2] rounded-lg transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="bg-[#fff2f0] border-b border-[#f0c3bd] px-7 py-4">
          <div className="flex items-center gap-3 text-[#7b2924] bg-white/70 px-4 py-3 rounded-lg border border-[#f0c3bd]">
            <div className="w-8 h-8 rounded-lg bg-[#f7dedb] flex items-center justify-center flex-shrink-0">
              <svg className="w-4.5 h-4.5 text-[#b33b32]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="ml-auto text-[#b33b32] hover:text-[#7b2924] p-1 hover:bg-[#f7dedb] rounded-lg transition-all">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-7 py-8 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-16">
            <div className="w-20 h-20 rounded-lg bg-white border border-[#dce7e3] flex items-center justify-center mb-5 shadow-[0_20px_50px_rgba(31,45,43,0.08)]">
              <svg className="w-10 h-10 text-[#167a69]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-[#18201e] mb-2">你好！</h2>
            <p className="text-[#6d7d79] max-w-md leading-relaxed">有什么我可以帮你的吗？无论是问题解答、创意构思还是任务协助，我都在这里为你服务。</p>
          </div>
        )}

        {messages.map((message, index) => {
          if (message.role === "tool") {
            return (
              <div key={message.id} className="flex gap-4 justify-start animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                <div className="w-10 h-10 rounded-lg bg-[#2f6f8f] flex items-center justify-center flex-shrink-0 shadow-[0_10px_22px_rgba(47,111,143,0.18)]">
                  <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 max-w-[72%]">
                  <div className="bg-white text-[#18201e] rounded-lg rounded-tl-sm px-5 py-4 border border-[#bfd7e4] shadow-[0_10px_28px_rgba(31,45,43,0.06)]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-[#2f6f8f]">工具执行结果</span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono bg-[#f4f8f7] rounded-lg p-3 max-h-60 overflow-y-auto border border-[#e1ece9]">
                      {message.content}
                    </p>
                  </div>
                  <span className="text-xs text-[#8b9895] px-1.5 mt-2 block">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"} animate-slide-up`} style={{ animationDelay: `${index * 0.05}s` }}>
              {message.role === "assistant" && (
                <div className="w-10 h-10 rounded-lg bg-[#167a69] flex items-center justify-center flex-shrink-0 shadow-[0_10px_22px_rgba(22,122,105,0.18)]">
                  <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              )}
              <div className={`flex flex-col gap-1.5 max-w-[72%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`rounded-lg px-5 py-4 shadow-[0_10px_28px_rgba(31,45,43,0.06)] ${message.role === "user" ? "bg-[#18201e] text-white rounded-tr-sm" : "bg-white text-[#18201e] rounded-tl-sm border border-[#dce7e3]"}`}>
                  {message.role === "assistant" && message.reasoning_content && (
                    <details className="mb-3 group">
                      <summary className="cursor-pointer text-xs font-semibold text-[#8d6a16] hover:text-[#6e500d] flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        思考过程
                      </summary>
                      <div className="mt-2 pt-2 border-t border-[#e5d29b]">
                        <p className="text-xs text-[#53635f] font-mono bg-[#fbf8ef] rounded-lg p-3 max-h-40 overflow-y-auto border border-[#eee0b6]">
                          {message.reasoning_content}
                        </p>
                      </div>
                    </details>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
                <span className={`text-xs px-1.5 ${message.role === "user" ? "text-right text-[#7d8d89]" : "text-[#8b9895]"}`}>
                  {formatTime(message.timestamp)}
                </span>
              </div>
              {message.role === "user" && (
                <div className="w-10 h-10 rounded-lg bg-[#d5a131] flex items-center justify-center flex-shrink-0 shadow-[0_10px_22px_rgba(213,161,49,0.22)]">
                  <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}

        {executingToolCalls.map((tc, idx) => (
          <div key={`executing-${tc.toolCall.id}-${idx}`} className="flex gap-4 justify-start animate-slide-up">
            <div className="w-10 h-10 rounded-lg bg-[#2f6f8f] flex items-center justify-center flex-shrink-0 shadow-[0_10px_22px_rgba(47,111,143,0.18)]">
              <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1 max-w-[72%]">
              <div className="bg-white text-[#18201e] rounded-lg rounded-tl-sm px-5 py-4 border border-[#bfd7e4] shadow-[0_10px_28px_rgba(31,45,43,0.06)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-[#2f6f8f]">{tc.toolCall.function.name}</span>
                  {tc.status === "executing" && (
                    <span className="w-2 h-2 bg-[#2f6f8f] rounded-full animate-pulse"></span>
                  )}
                </div>
                <div className="text-xs text-[#53635f] font-mono bg-[#f4f8f7] rounded-lg p-3 overflow-x-auto border border-[#e1ece9]">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(JSON.parse(tc.toolCall.function.arguments), null, 2)}
                  </pre>
                </div>
                {tc.result && (
                  <div className="mt-3 pt-3 border-t border-[#dce7e3]">
                    <p className="text-sm text-[#41504d]">
                      {tc.result.success ? "✅ 执行成功" : "❌ 执行失败"}
                    </p>
                    {tc.result.data && (
                      <pre className="mt-2 text-xs text-[#53635f] font-mono bg-[#f4f8f7] rounded-lg p-3 max-h-40 overflow-y-auto border border-[#e1ece9]">
                        {tc.result.data}
                      </pre>
                    )}
                    {tc.result.error && (
                      <p className="mt-2 text-xs text-[#b33b32]">{tc.result.error}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4 justify-start animate-slide-up">
            <div className="w-10 h-10 rounded-lg bg-[#167a69] flex items-center justify-center flex-shrink-0 shadow-[0_10px_22px_rgba(22,122,105,0.18)]">
              <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="bg-white text-[#18201e] rounded-lg rounded-tl-sm px-5 py-4 border border-[#dce7e3] shadow-[0_10px_28px_rgba(31,45,43,0.06)]">
              <div className="flex gap-2.5">
                <div className="w-2.5 h-2.5 bg-[#167a69] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2.5 h-2.5 bg-[#167a69] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2.5 h-2.5 bg-[#167a69] rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-7 pb-7 pt-4 border-t border-[#dce7e3] bg-white/64 backdrop-blur-xl">
        <div className="bg-white rounded-lg p-4 border border-[#cfdeda] shadow-[0_20px_50px_rgba(31,45,43,0.10)] flex gap-3.5 items-end">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，按 Enter 发送..."
            className="flex-1 bg-transparent text-[#18201e] placeholder-[#8b9895] resize-none focus:outline-none max-h-[200px] min-h-[24px] text-sm leading-relaxed py-2 px-2"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            className={`p-3.5 rounded-lg transition-all duration-200 flex-shrink-0 ${inputText.trim() && !isLoading ? "bg-[#167a69] hover:bg-[#126756] text-white shadow-[0_12px_24px_rgba(22,122,105,0.24)] active:scale-[0.96]" : "bg-[#edf3f1] text-[#9aa8a5] cursor-not-allowed"}`}
          >
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {pendingToolCalls.length > 0 && (
        <TaskConfirmation 
          toolCalls={pendingToolCalls.map(tc => ({
            id: tc.toolCall.id,
            name: tc.toolCall.function.name,
            arguments: tc.toolCall.function.arguments,
            taskRequest: tc.taskRequest
          }))}
          onConfirm={handleConfirmToolCalls} 
          onReject={handleRejectToolCalls} 
        />
      )}
    </div>
  );
}

export default ChatArea;
