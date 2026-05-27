import { useState, useRef, useEffect, useCallback } from "react";
import { Message, TaskRequest, Task, TaskStatus, Conversation } from "../types";
import { useConfigContext } from "../contexts/ConfigContext";
import { useTaskExecutor } from "../hooks/useTaskExecutor";
import { sendChatMessage, parseTaskFromResponse, extractTextWithoutTask, createAgent, AgentEvent } from "../services/api";
import TaskConfirmation from "./TaskConfirmation";
import TaskExecution from "./TaskExecution";

interface ChatAreaProps {
  conversation: Conversation | null;
  onSaveConversation: (messages: Message[], tasks: Task[]) => void;
}

function ChatArea({ conversation, onSaveConversation }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingTask, setPendingTask] = useState<TaskRequest | null>(null);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { config } = useConfigContext();
  const { executeTask } = useTaskExecutor();

  useEffect(() => {
    if (conversation) {
      setMessages(conversation.messages);
      setTasks(conversation.tasks);
    }
  }, [conversation?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleConfirmTask = async () => {
    if (!pendingTask) return;

    const now = new Date();
    const task: Task = {
      id: crypto.randomUUID(),
      task_request: pendingTask,
      status: TaskStatus.EXECUTING,
      created_at: now,
      updated_at: now,
    };

    setCurrentTask(task);
    setPendingTask(null);

    try {
      const result = await executeTask(pendingTask.action);
      const updatedTask: Task = {
        ...task,
        status: result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
        result,
        updated_at: new Date(),
      };
      setCurrentTask(updatedTask);
      setTasks((prev) => [...prev, updatedTask]);

      const taskMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `_TASK_RESULT_${JSON.stringify(updatedTask)}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, taskMessage]);
      onSaveConversation(messages, [...tasks, updatedTask]);
    } catch (error) {
      const updatedTask: Task = {
        ...task,
        status: TaskStatus.FAILED,
        result: {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        updated_at: new Date(),
      };
      setCurrentTask(updatedTask);
      setTasks((prev) => [...prev, updatedTask]);
    }
  };

  const handleRejectTask = () => {
    setPendingTask(null);
  };

  const handleAgentEvent = useCallback((event: AgentEvent) => {
    console.log("Agent event:", event.type, event);
    switch (event.type) {
      case "agent_start":
        setIsLoading(true);
        break;
      case "agent_end":
        setIsLoading(false);
        break;
      case "message_start":
        break;
      case "message_update":
        break;
      case "message_end":
        break;
      case "tool_execution_start":
        console.log("Tool execution started:", event.toolName, event.args);
        break;
      case "tool_execution_end":
        console.log("Tool execution ended:", event.toolName, event.result);
        break;
    }
  }, []);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    setErrorMessage(null);
    setCurrentTask(null);

    if (!config.base_url) {
      setErrorMessage("请先在设置中配置 API 地址");
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const chatMessages = [
      { role: "system" as const, content: "You are a helpful assistant." },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content.startsWith("_TASK_RESULT_") ? "[任务执行结果]" : m.content,
      })),
      { role: "user" as const, content: userMessage.content },
    ];

    const response = await sendChatMessage(config.base_url, config.api_key, {
      model: config.model,
      messages: chatMessages,
      thinking: { type: "enabled" },
      reasoning_effort: "high",
      stream: false,
    });

    if (response.error) {
      setErrorMessage(`请求失败: ${response.error}`);
      setIsLoading(false);
      return;
    }

    const taskRequest = parseTaskFromResponse(response.content);
    const textContent = extractTextWithoutTask(response.content);

    if (textContent) {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: textContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }

    if (taskRequest) {
      setPendingTask(taskRequest);
    }

    setIsLoading(false);
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
      minute: "2-digit",
    });
  };

  useEffect(() => {
    const { unsubscribe } = createAgent(config.api_key, handleAgentEvent);
    return () => unsubscribe();
  }, [config.api_key, handleAgentEvent]);

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
          if (message.content.startsWith("_TASK_RESULT_")) {
            try {
              const taskJson = message.content.replace("_TASK_RESULT_", "");
              const task: Task = JSON.parse(taskJson);
              task.created_at = new Date(task.created_at);
              task.updated_at = new Date(task.updated_at);
              
              return (
                <div key={message.id} className="flex gap-4 justify-start animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/25">
                    <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1 max-w-[75%]">
                    <TaskExecution task={task} />
                    <span className="text-xs text-slate-600 px-1.5 mt-2 block">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              );
            } catch {
            }
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
        {currentTask && (
          <div className="flex gap-4 justify-start animate-slide-up">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/25">
              <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1 max-w-[75%]">
              <TaskExecution task={currentTask} />
            </div>
          </div>
        )}
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

      {pendingTask && (
        <TaskConfirmation taskRequest={pendingTask} onConfirm={handleConfirmTask} onReject={handleRejectTask} />
      )}
    </div>
  );
}

export default ChatArea;
