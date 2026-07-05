import { Message } from "../../types";
import MessageMarkdown from "./MessageMarkdown";
import ToolCallDetails, { formatToolArguments } from "./ToolCallDetails";
import { ToolCallItem } from "./types";

interface ChatMessageListProps {
  messages: Message[];
  executingToolCalls: ToolCallItem[];
  isLoading: boolean;
  streamingAssistantId: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  formatTime: (date: Date) => string;
}

function findToolCallForMessage(messages: Message[], toolMessage: Message) {
  if (!toolMessage.tool_call_id) return undefined;

  return messages
    .flatMap((message) => message.tool_calls || [])
    .find((toolCall) => toolCall.id === toolMessage.tool_call_id);
}

function EmptyChat() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-16">
      <div className="w-20 h-20 rounded-lg bg-white border border-[#dce7e3] flex items-center justify-center mb-5 shadow-[0_20px_50px_rgba(31,45,43,0.08)]">
        <svg className="w-10 h-10 text-[#167a69]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold text-[#18201e] mb-2">你好！</h2>
      <p className="text-[#6d7d79] max-w-md leading-relaxed">有什么我可以帮你的吗？无论是问题解答、创意构思还是任务协助，我都在这里为你服务。</p>
    </div>
  );
}

function ToolAvatar() {
  return (
    <div className="w-10 h-10 rounded-lg bg-[#2f6f8f] flex items-center justify-center flex-shrink-0 shadow-[0_10px_22px_rgba(47,111,143,0.18)]">
      <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="w-10 h-10 rounded-lg bg-[#167a69] flex items-center justify-center flex-shrink-0 shadow-[0_10px_22px_rgba(22,122,105,0.18)]">
      <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="w-10 h-10 rounded-lg bg-[#d5a131] flex items-center justify-center flex-shrink-0 shadow-[0_10px_22px_rgba(213,161,49,0.22)]">
      <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </div>
  );
}

function ToolMessage({ message, messages, index, formatTime }: {
  message: Message;
  messages: Message[];
  index: number;
  formatTime: (date: Date) => string;
}) {
  const toolCall = findToolCallForMessage(messages, message);

  return (
    <div key={message.id} className="flex gap-4 justify-start animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
      <ToolAvatar />
      <div className="flex-1 max-w-[72%]">
        <div className="bg-white text-[#18201e] rounded-lg rounded-tl-sm px-5 py-4 border border-[#bfd7e4] shadow-[0_10px_28px_rgba(31,45,43,0.06)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-[#2f6f8f]">工具执行结果</span>
          </div>
          {toolCall && <ToolCallDetails toolCall={toolCall} />}
          <div className="bg-[#f4f8f7] rounded-lg p-3 max-h-60 overflow-y-auto border border-[#e1ece9]">
            <MessageMarkdown content={message.content} role="tool" />
          </div>
        </div>
        <span className="text-xs text-[#8b9895] px-1.5 mt-2 block">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

function ChatMessage({ message, index, formatTime }: {
  message: Message;
  index: number;
  formatTime: (date: Date) => string;
}) {
  return (
    <div key={message.id} className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"} animate-slide-up`} style={{ animationDelay: `${index * 0.05}s` }}>
      {message.role === "assistant" && <AssistantAvatar />}
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
          <MessageMarkdown content={message.content} role={message.role} />
        </div>
        <span className={`text-xs px-1.5 ${message.role === "user" ? "text-right text-[#7d8d89]" : "text-[#8b9895]"}`}>
          {formatTime(message.timestamp)}
        </span>
      </div>
      {message.role === "user" && <UserAvatar />}
    </div>
  );
}

function ExecutingToolCall({ item, index }: { item: ToolCallItem; index: number }) {
  return (
    <div key={`executing-${item.toolCall.id}-${index}`} className="flex gap-4 justify-start animate-slide-up">
      <ToolAvatar />
      <div className="flex-1 max-w-[72%]">
        <div className="bg-white text-[#18201e] rounded-lg rounded-tl-sm px-5 py-4 border border-[#bfd7e4] shadow-[0_10px_28px_rgba(31,45,43,0.06)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-[#2f6f8f]">{item.toolCall.function.name}</span>
            {item.status === "executing" && (
              <span className="w-2 h-2 bg-[#2f6f8f] rounded-full animate-pulse"></span>
            )}
          </div>
          <div className="text-xs text-[#53635f] font-mono bg-[#f4f8f7] rounded-lg p-3 overflow-x-auto border border-[#e1ece9]">
            <pre className="whitespace-pre-wrap">
              {formatToolArguments(item.toolCall.function.arguments)}
            </pre>
          </div>
          {item.result && (
            <div className="mt-3 pt-3 border-t border-[#dce7e3]">
              <p className="text-sm text-[#41504d]">
                {item.result.success ? "✅ 执行成功" : "❌ 执行失败"}
              </p>
              {item.result.data && (
                <div className="mt-2 bg-[#f4f8f7] rounded-lg p-3 max-h-40 overflow-y-auto border border-[#e1ece9]">
                  <MessageMarkdown content={item.result.data} role="tool" />
                </div>
              )}
              {item.result.error && (
                <p className="mt-2 text-xs text-[#b33b32]">{item.result.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingMessage() {
  return (
    <div className="flex gap-4 justify-start animate-slide-up">
      <AssistantAvatar />
      <div className="bg-white text-[#18201e] rounded-lg rounded-tl-sm px-5 py-4 border border-[#dce7e3] shadow-[0_10px_28px_rgba(31,45,43,0.06)]">
        <div className="flex gap-2.5">
          <div className="w-2.5 h-2.5 bg-[#167a69] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2.5 h-2.5 bg-[#167a69] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2.5 h-2.5 bg-[#167a69] rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  );
}

function ChatMessageList({
  messages,
  executingToolCalls,
  isLoading,
  streamingAssistantId,
  messagesEndRef,
  formatTime,
}: ChatMessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-7 py-8 space-y-6">
      {messages.length === 0 && <EmptyChat />}

      {messages.map((message, index) => (
        message.role === "tool"
          ? <ToolMessage key={message.id} message={message} messages={messages} index={index} formatTime={formatTime} />
          : <ChatMessage key={message.id} message={message} index={index} formatTime={formatTime} />
      ))}

      {executingToolCalls.map((item, index) => (
        <ExecutingToolCall key={`executing-${item.toolCall.id}-${index}`} item={item} index={index} />
      ))}

      {isLoading && !streamingAssistantId && <LoadingMessage />}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default ChatMessageList;
