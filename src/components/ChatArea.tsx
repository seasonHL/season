import { useState, useRef, useEffect } from "react";
import { Message, TaskRequest, Task, TaskStatus, Conversation, ToolCall } from "../types";
import { useConfigContext } from "../contexts/ConfigContext";
import { useTaskExecutor } from "../hooks/useTaskExecutor";
import { 
  sendChatMessage, 
  parseToolCallToTaskRequest, 
  convertToolsToOpenAIFormat, 
  SYSTEM_PROMPT
} from "../services/api";
import TaskConfirmation from "./TaskConfirmation";

interface ChatAreaProps {
  conversation: Conversation | null;
  onSaveConversation: (messages: Message[], tasks: Task[]) => void;
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

function ChatArea({ conversation, onSaveConversation }: ChatAreaProps) {
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
    onSaveConversation(messages, [...tasks, ...newTasks]);

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

    const toolMessages: Message[] = toolResults.map(({ toolCall, result }) => ({
      id: crypto.randomUUID(),
      role: "tool" as const,
      content: result.success ? result.data || "操作成功完成" : `错误: ${result.error || "未知错误"}`,
      timestamp: new Date(),
      tool_call_id: toolCall.id
    }));

    const updatedTasks = tasks.map((task, idx) => {
      const execIdx = idx - tasks.length + newExecutingToolCalls.length;
      if (execIdx >= 0 && execIdx < newExecutingToolCalls.length) {
        const result = toolResults[execIdx]?.result;
        return {
          ...task,
          status: result?.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
          result: result ? { success: result.success, data: result.data, error: result.error } : undefined,
          updated_at: new Date()
        };
      }
      return task;
    }).concat(newTasks.map((task, idx) => ({
      ...task,
      status: toolResults[idx]?.result?.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
      result: toolResults[idx]?.result ? { 
        success: toolResults[idx]!.result.success, 
        data: toolResults[idx]!.result.data, 
        error: toolResults[idx]!.result.error 
      } : undefined,
      updated_at: new Date()
    })));

    const allMessages = [...messages, ...toolMessages];
    setMessages(allMessages);
    setTasks(updatedTasks);
    onSaveConversation(allMessages, updatedTasks);

    setTimeout(() => {
      setExecutingToolCalls([]);
    }, 2000);

    await continueConversation(allMessages, updatedTasks);
  };

  const continueConversation = async (currentMessages: Message[], currentTasks: Task[]) => {
    if (!config.base_url) {
      setErrorMessage("请先在设置页面配置 API 地址");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const chatMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...currentMessages.map((m) => {
        const msg: Record<string, any> = {
          role: m.role,
        };
        if (m.role === "assistant" && m.tool_calls) {
          msg.content = m.content || null;
          msg.tool_calls = m.tool_calls;
        } else {
          msg.content = m.content;
        }
        if (m.role === "tool" && m.tool_call_id) {
          msg.tool_call_id = m.tool_call_id;
        }
        if (m.role === "assistant" && m.reasoning_content) {
          msg.reasoning_content = m.reasoning_content;
        }
        return msg;
      })
    ].filter(m => m.content || m.tool_calls || m.tool_call_id || m.reasoning_content);

    const tools = convertToolsToOpenAIFormat();

    const response = await sendChatMessage(config.base_url, config.api_key, {
      model: config.model,
      messages: chatMessages as any,
      tools,
      stream: false
    });

    if (response.error) {
      setErrorMessage(`请求失败: ${response.error}`);
      setIsLoading(false);
      return;
    }

    if (response.tool_calls && response.tool_calls.length > 0) {
      const newToolCalls: ToolCallItem[] = [];
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.content || "正在执行工具...",
        timestamp: new Date(),
        tool_calls: response.tool_calls,
        reasoning_content: response.reasoning_content
      };

      const messagesWithResponse = [...currentMessages, assistantMessage];
      setMessages(messagesWithResponse);
      onSaveConversation(messagesWithResponse, currentTasks);

      for (const toolCall of response.tool_calls) {
        const taskRequest = parseToolCallToTaskRequest(toolCall);
        if (taskRequest) {
          newToolCalls.push({
            toolCall,
            taskRequest,
            status: "pending"
          });
        }
      }

      if (newToolCalls.length > 0) {
        setPendingToolCalls(newToolCalls);
      }

      setIsLoading(false);
    } else {
      if (response.content) {
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.content,
          timestamp: new Date(),
          reasoning_content: response.reasoning_content
        };
        const messagesWithResponse = [...currentMessages, assistantMessage];
        setMessages(messagesWithResponse);
        onSaveConversation(messagesWithResponse, currentTasks);
      }
      setIsLoading(false);
    }
  };

  const handleRejectToolCalls = () => {
    setPendingToolCalls([]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !conversation) return;

    setErrorMessage(null);

    if (!config.base_url) {
      setErrorMessage("请先在设置页面配置 API 地址");
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputText.trim(),
      timestamp: new Date()
    };

    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInputText("");
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    await continueConversation(currentMessages, tasks);
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
    <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 h-screen">
      <header className="h-18 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 flex items-center justify-between px-7">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h1 className="text-slate-100 font-semibold text-base">AI 助手</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-slate-500 text-xs">在线</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-7 py-4">
          <div className="flex items-center gap-3 text-red-200 bg-red-500/10 px-4 py-3 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4.5 h-4.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="ml-auto text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded-lg transition-all">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-7 py-8 space-y-7">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-16">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 flex items-center justify-center mb-5">
              <svg className="w-10 h-10 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-100 mb-2">你好！</h2>
            <p className="text-slate-500 max-w-md">有什么我可以帮你的吗？无论是问题解答、创意构思还是任务协助，我都在这里为你服务。</p>
          </div>
        )}

        {messages.map((message, index) => {
          if (message.role === "tool") {
            return (
              <div key={message.id} className="flex gap-4 justify-start animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
                  <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 max-w-[75%]">
                  <div className="bg-slate-800/80 text-slate-100 rounded-2xl rounded-tl-sm px-5 py-4 border border-blue-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-blue-400">工具执行结果</span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono bg-slate-900/50 rounded-lg p-3 max-h-60 overflow-y-auto">
                      {message.content}
                    </p>
                  </div>
                  <span className="text-xs text-slate-600 px-1.5 mt-2 block">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"} animate-slide-up`} style={{ animationDelay: `${index * 0.05}s` }}>
              {message.role === "assistant" && (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/25">
                  <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <div className={`max-w-[75%] rounded-2xl px-5 py-4 shadow-soft ${message.role === "user" ? "bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-tr-sm shadow-primary-500/20" : "bg-slate-800/80 text-slate-100 rounded-tl-sm border border-slate-700/50"}`}>
                  {message.role === "assistant" && message.reasoning_content && (
                    <details className="mb-3 group">
                      <summary className="cursor-pointer text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        思考过程
                      </summary>
                      <div className="mt-2 pt-2 border-t border-purple-500/20">
                        <p className="text-xs text-slate-400 font-mono bg-slate-900/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                          {message.reasoning_content}
                        </p>
                      </div>
                    </details>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
                <span className={`text-xs px-1.5 ${message.role === "user" ? "text-right text-slate-500" : "text-slate-600"}`}>
                  {formatTime(message.timestamp)}
                </span>
              </div>
              {message.role === "user" && (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/25">
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
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
              <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1 max-w-[75%]">
              <div className="bg-slate-800/80 text-slate-100 rounded-2xl rounded-tl-sm px-5 py-4 border border-blue-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-blue-400">{tc.toolCall.function.name}</span>
                  {tc.status === "executing" && (
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono bg-slate-900/50 rounded-lg p-3 overflow-x-auto">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(JSON.parse(tc.toolCall.function.arguments), null, 2)}
                  </pre>
                </div>
                {tc.result && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-sm text-slate-300">
                      {tc.result.success ? "✅ 执行成功" : "❌ 执行失败"}
                    </p>
                    {tc.result.data && (
                      <pre className="mt-2 text-xs text-slate-400 font-mono bg-slate-900/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                        {tc.result.data}
                      </pre>
                    )}
                    {tc.result.error && (
                      <p className="mt-2 text-xs text-red-400">{tc.result.error}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4 justify-start animate-slide-up">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/25">
              <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="bg-slate-800/80 text-slate-100 rounded-2xl rounded-tl-sm px-5 py-4 border border-slate-700/50 shadow-soft">
              <div className="flex gap-2.5">
                <div className="w-2.5 h-2.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2.5 h-2.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2.5 h-2.5 bg-slate-500 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-7 pb-7 pt-4 border-t border-slate-800/50 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-4 border border-slate-800/50 shadow-large flex gap-3.5 items-end">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，按 Enter 发送..."
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-600 resize-none focus:outline-none max-h-[200px] min-h-[24px] text-sm leading-relaxed py-2 px-2"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            className={`p-3.5 rounded-2xl transition-all duration-200 flex-shrink-0 ${inputText.trim() && !isLoading ? "bg-gradient-to-br from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 active:scale-[0.96]" : "bg-slate-800 text-slate-600 cursor-not-allowed"}`}
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
