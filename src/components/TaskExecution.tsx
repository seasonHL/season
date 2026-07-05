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
            className="w-5.5 h-5.5 text-[#8d6a16]"
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
          <div className="w-5.5 h-5.5 border-2 border-[#167a69] border-t-transparent rounded-full animate-spin"></div>
        );
      case TaskStatus.COMPLETED:
        return (
          <svg
            className="w-5.5 h-5.5 text-[#167a69]"
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
            className="w-5.5 h-5.5 text-[#b33b32]"
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
        return "text-[#8d6a16] bg-[#fbf8ef]";
      case TaskStatus.EXECUTING:
        return "text-[#167a69] bg-[#e8f3f0]";
      case TaskStatus.COMPLETED:
        return "text-[#167a69] bg-[#e8f3f0]";
      case TaskStatus.FAILED:
        return "text-[#b33b32] bg-[#f7dedb]";
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
    <div className="bg-white rounded-lg p-5 border border-[#dce7e3] shadow-[0_10px_28px_rgba(31,45,43,0.06)]">
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor()}`}>
          {getStatusIcon()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-[#18201e] font-semibold">{formatActionType()}</span>
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
          <p className="text-[#8b9895] text-xs mt-1">
            {task.created_at.toLocaleTimeString("zh-CN")}
          </p>
        </div>
      </div>

      {task.result && (
        <div className="mt-4 pt-4 border-t border-[#dce7e3]">
          {task.result.success ? (
            <div className="space-y-2.5">
              <p className="text-sm text-[#41504d] font-medium">执行结果:</p>
              {task.result.data && (
                <pre className="text-xs text-[#53635f] bg-[#f8fbfa] p-4 rounded-lg overflow-x-auto font-mono border border-[#dce7e3]">
                  {task.result.data}
                </pre>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-sm text-[#b33b32] font-medium">执行失败:</p>
              {task.result.error && (
                <pre className="text-xs text-[#b33b32] bg-[#fff2f0] p-4 rounded-lg overflow-x-auto font-mono border border-[#f0c3bd]">
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
