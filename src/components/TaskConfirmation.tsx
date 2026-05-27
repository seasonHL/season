import { TaskRequest } from "../types";

interface TaskConfirmationProps {
  taskRequest: TaskRequest;
  onConfirm: () => void;
  onReject: () => void;
}

function TaskConfirmation({
  taskRequest,
  onConfirm,
  onReject,
}: TaskConfirmationProps) {
  const formatTaskAction = () => {
    const { action } = taskRequest;
    switch (action.type) {
      case "FileRead":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-400">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="font-medium">读取文件</span>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-300">
                <span className="text-slate-500">路径:</span> {action.payload.path}
              </p>
            </div>
          </div>
        );
      case "FileWrite":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-400">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span className="font-medium">写入文件</span>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 space-y-2">
              <p className="text-sm text-slate-300">
                <span className="text-slate-500">路径:</span> {action.payload.path}
              </p>
              <p className="text-sm text-slate-300">
                <span className="text-slate-500">内容:</span>
              </p>
              <pre className="text-xs text-slate-400 bg-slate-800 p-2 rounded max-h-32 overflow-y-auto">
                {action.payload.content}
              </pre>
            </div>
          </div>
        );
      case "ExecuteCommand":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-400">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="font-medium">执行命令</span>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-300">
                <span className="text-slate-500">命令:</span> {action.payload.command}
              </p>
              {action.payload.args.length > 0 && (
                <p className="text-sm text-slate-300 mt-1">
                  <span className="text-slate-500">参数:</span> {action.payload.args.join(" ")}
                </p>
              )}
            </div>
          </div>
        );
      default:
        return (
          <div className="text-slate-400">未知任务类型</div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-amber-400"
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
              <h2 className="text-white font-semibold text-lg">任务确认</h2>
              <p className="text-slate-400 text-sm">AI 请求执行以下操作</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {formatTaskAction()}
        </div>

        <div className="p-6 border-t border-slate-700 flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors font-medium"
          >
            拒绝
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors font-medium shadow-lg shadow-blue-600/30"
          >
            确认执行
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskConfirmation;
