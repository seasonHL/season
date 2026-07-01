import { ToolCall } from "../../types";

export function formatToolArguments(argumentsText: string) {
  try {
    return JSON.stringify(JSON.parse(argumentsText), null, 2);
  } catch {
    return argumentsText;
  }
}

function ToolCallDetails({ toolCall }: { toolCall: ToolCall }) {
  return (
    <details className="mb-3 group" open>
      <summary className="cursor-pointer text-xs font-semibold text-[#2f6f8f] hover:text-[#24556e] flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        调用 {toolCall.function.name}
      </summary>
      <pre className="mt-2 text-xs text-[#53635f] font-mono bg-[#f4f8f7] rounded-lg p-3 max-h-40 overflow-y-auto border border-[#e1ece9] whitespace-pre-wrap">
        {formatToolArguments(toolCall.function.arguments)}
      </pre>
    </details>
  );
}

export default ToolCallDetails;
