import { TaskRequest } from "../types";

interface ToolCallItem {
  id: string;
  name: string;
  arguments: string;
  taskRequest: TaskRequest;
}

interface TaskConfirmationProps {
  toolCalls: ToolCallItem[];
  onConfirm: () => void;
  onReject: () => void;
}

function TaskConfirmation({
  toolCalls,
  onConfirm,
  onReject,
}: TaskConfirmationProps) {
  const getActionIcon = (type: string) => {
    switch (type) {
      case "FileRead":
        return (
          <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case "FileWrite":
        return (
          <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      case "ExecuteCommand":
        return (
          <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case "FileRead":
        return { text: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" };
      case "FileWrite":
        return { text: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/30" };
      case "ExecuteCommand":
        return { text: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" };
      default:
        return { text: "text-slate-400", bg: "bg-slate-500/20", border: "border-slate-500/30" };
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case "FileRead":
        return "读取文件";
      case "FileWrite":
        return "写入文件";
      case "ExecuteCommand":
        return "执行命令";
      default:
        return "未知操作";
    }
  };

  const formatArguments = (action: any, type: string) => {
    const colors = getActionColor(type);
    
    switch (type) {
      case "FileRead":
        return (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">
              <span className="text-slate-500 font-medium">路径:</span>{" "}
              <code className="font-mono text-blue-300 bg-blue-500/10 px-2 py-1 rounded-lg">
                {action.payload?.path || "未指定"}
              </code>
            </p>
          </div>
        );

      case "FileWrite":
        return (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">
              <span className="text-slate-500 font-medium">路径:</span>{" "}
              <code className="font-mono text-purple-300 bg-purple-500/10 px-2 py-1 rounded-lg">
                {action.payload?.path || "未指定"}
              </code>
            </p>
            <p className="text-sm text-slate-300">
              <span className="text-slate-500 font-medium">内容:</span>
            </p>
            <pre className="text-xs text-slate-400 bg-slate-900/80 p-3 rounded-xl max-h-32 overflow-y-auto font-mono border border-slate-700/30">
              {action.payload?.content || "未指定"}
            </pre>
          </div>
        );

      case "ExecuteCommand":
        return (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">
              <span className="text-slate-500 font-medium">命令:</span>{" "}
              <code className="font-mono text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-lg">
                {action.payload?.command || "未指定"}
              </code>
            </p>
            {action.payload?.args && action.payload.args.length > 0 && (
              <p className="text-sm text-slate-300">
                <span className="text-slate-500 font-medium">参数:</span>{" "}
                <code className="font-mono text-slate-300">
                  {action.payload.args.join(" ")}
                </code>
              </p>
            )}
          </div>
        );

      default:
        try {
          const parsed = JSON.parse(toolCalls[0]?.arguments || "{}");
          return (
            <pre className="text-xs text-slate-400 bg-slate-900/80 p-3 rounded-xl max-h-32 overflow-y-auto font-mono">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          );
        } catch {
          return (
            <p className="text-sm text-slate-400 font-mono">
              {toolCalls[0]?.arguments || "无参数"}
            </p>
          );
        }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-pulse-subtle">
      <div className="bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-2xl mx-4 border border-slate-700/50 animate-slide-up max-h-[80vh] flex flex-col">
        <div className="p-7 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
              <svg
                className="w-6.5 h-6.5 text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-slate-100 font-semibold text-xl">
                {toolCalls.length === 1 ? "任务确认" : "批量任务确认"}
              </h2>
              <p className="text-slate-500 text-sm">
                AI 请求执行 {toolCalls.length} 个操作
              </p>
            </div>
          </div>
        </div>

        <div className="p-7 overflow-y-auto flex-1 space-y-4">
          {toolCalls.map((toolCall, index) => {
            const { action } = toolCall.taskRequest;
            const type = action.type;
            const colors = getActionColor(type);

            return (
              <div
                key={toolCall.id}
                className={`bg-slate-900/70 p-4 rounded-2xl border ${colors.border} space-y-3`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center ${colors.text}`}>
                    {getActionIcon(type)}
                  </div>
                  <div className="flex-1">
                    <span className={`font-semibold text-lg ${colors.text}`}>
                      {getActionLabel(type)}
                    </span>
                    <span className="text-slate-500 text-sm ml-2">
                      #{index + 1}
                    </span>
                  </div>
                </div>
                <div className="pl-14">
                  {formatArguments(action, type)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-7 border-t border-slate-700/50 flex gap-3 flex-shrink-0">
          <button
            onClick={onReject}
            className="flex-1 px-5 py-3.5 bg-slate-700/80 hover:bg-slate-600 text-slate-100 rounded-2xl transition-all duration-200 font-semibold hover:shadow-lg"
          >
            全部拒绝
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-5 py-3.5 bg-gradient-to-br from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-2xl transition-all duration-200 font-semibold shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 active:scale-[0.98]"
          >
            全部确认执行
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskConfirmation;
