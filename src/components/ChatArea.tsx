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
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
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
    <div className="flex-1 flex flex-col bg-slate-800 h-screen">
      <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
        <div>
          <h1 className="text-white font-semibold text-lg">AI 助手</h1>
          <p className="text-slate-400 text-sm">在线</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="bg-red-900/50 border-b border-red-700 px-6 py-3">
          <div className="flex items-center gap-2 text-red-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="ml-auto text-red-300 hover:text-red-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message) => {
          if (message.content.startsWith("_TASK_RESULT_")) {
            try {
              const taskJson = message.content.replace("_TASK_RESULT_", "");
              const task: Task = JSON.parse(taskJson);
              task.created_at = new Date(task.created_at);
              task.updated_at = new Date(task.updated_at);
              
              return (
                <div key={message.id} className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1 max-w-[70%]">
                    <TaskExecution task={task} />
                    <span className="text-xs text-slate-500 px-2 mt-1 block">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              );
            } catch {
            }
          }

          return (
            <div key={message.id} className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <div className={`max-w-[70%] rounded-2xl px-5 py-3 ${message.role === "user" ? "bg-blue-600 text-white rounded-tr-md" : "bg-slate-700 text-slate-100 rounded-tl-md"}`}>
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
                <span className="text-xs text-slate-500 px-2">
                  {formatTime(message.timestamp)}
                </span>
              </div>
              {message.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
        {currentTask && (
          <div className="flex gap-4 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1 max-w-[70%]">
              <TaskExecution task={currentTask} />
            </div>
          </div>
        )}
        {isLoading && (
          <div className="flex gap-4 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="bg-slate-700 text-slate-100 rounded-2xl rounded-tl-md px-5 py-3">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 border-t border-slate-700">
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-700 flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 resize-none focus:outline-none max-h-[150px] min-h-[24px]"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            className={`p-3 rounded-xl transition-all duration-200 ${inputText.trim() && !isLoading ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/30" : "bg-slate-700 text-slate-500 cursor-not-allowed"}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
