import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

interface MessageMarkdownProps {
  content: string;
  role: "user" | "assistant" | "system" | "tool";
}

function MessageMarkdown({ content, role }: MessageMarkdownProps) {
  return (
    <div className={`markdown-message ${
      role === "user"
        ? "markdown-message-user"
        : role === "tool"
          ? "markdown-message-tool"
          : "markdown-message-assistant"
    }`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MessageMarkdown;
