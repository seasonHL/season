import { Task, TaskStatus } from "../types";

interface TaskExecutionProps {
  task: Task;
}

function TaskExecution({ task }: TaskExecutionProps) {
  const getStatusIcon = () => {
    switch (task.status) {
      case TaskStatus.PENDING:
        return (
          <svg
            className="w-5 h-5 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case TaskStatus.EXECUTING:
        return (
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        );
      case TaskStatus.COMPLETED:
        return (
          <svg
            className="w-5 h-5 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case TaskStatus.FAILED:
        return (
          <svg
            className="w-5 h-5 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
    }
  };

  const getStatusText = () => {
    switch (task.status) {
      case TaskStatus.PENDING:
        return "等待执行";
      case TaskStatus.EXECUTING:
        return "执行中";
      case TaskStatus.COMPLETED:
        return "执行完成";
      case TaskStatus.FAILED:
        return "执行失败";
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case TaskStatus.PENDING:
        return "text-amber-400 bg-amber-500/20";
      case TaskStatus.EXECUTING:
        return "text-blue-400 bg-blue-500/20";
      case TaskStatus.COMPLETED:
        return "text-green-400 bg-green-500/20";
      case TaskStatus.FAILED:
        return "text-red-400 bg-red-500/20";
    }
  };

  const formatActionType = () => {
    const { action } = task.task_request;
    switch (action.type) {
      case "FileRead":
        return "读取文件";
      case "FileWrite":
        return "写入文件";
      case "ExecuteCommand":
        return "执行命令";
      default:
        return "未知任务";
    }
  };

  return (
    <div className="bg-slate-700 rounded-xl p-4 border border-slate-600">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor()}`}>
          {getStatusIcon()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{formatActionType()}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
          <p className="text-slate-400 text-xs">
            {task.created_at.toLocaleTimeString("zh-CN")}
          </p>
        </div>
      </div>

      {task.result && (
        <div className="mt-3 pt-3 border-t border-slate-600">
          {task.result.success ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-300">执行结果:</p>
              {task.result.data && (
                <pre className="text-xs text-slate-400 bg-slate-800 p-3 rounded-lg overflow-x-auto">
                  {task.result.data}
                </pre>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-red-300">执行失败:</p>
              {task.result.error && (
                <pre className="text-xs text-red-400 bg-red-900/30 p-3 rounded-lg overflow-x-auto">
                  {task.result.error}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskExecution;
