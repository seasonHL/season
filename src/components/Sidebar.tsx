import { View, Conversation } from "../types";

interface SidebarProps {
  onViewChange: (view: View) => void;
  conversations: Conversation[];
  currentConversation: Conversation | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}

function Sidebar({
  onViewChange,
  conversations,
  currentConversation,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
}: SidebarProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 0) {
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "昨天";
    } else if (diffDays < 7) {
      const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      return days[date.getDay()];
    } else {
      return date.toLocaleDateString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
      });
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteConversation(id);
  };

  return (
    <aside className="w-[19rem] bg-white/82 backdrop-blur-xl border-r border-[#dce7e3] flex flex-col h-screen shadow-[12px_0_36px_rgba(31,45,43,0.06)]">
      <div className="p-5 border-b border-[#dce7e3]">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-[#167a69] flex items-center justify-center shadow-[0_10px_24px_rgba(22,122,105,0.22)]">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#18201e]">Desktop Agent</h2>
              <p className="text-[11px] text-[#6d7d79]">本地任务工作台</p>
            </div>
          </div>
        </div>
        <button
          onClick={onNewConversation}
          className="w-full bg-[#18201e] hover:bg-[#24312e] text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2.5 shadow-[0_12px_26px_rgba(24,32,30,0.18)] active:scale-[0.98]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center gap-2 px-2 py-2 mb-2">
          <svg className="w-4 h-4 text-[#7d8d89]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xs font-bold text-[#7d8d89] uppercase tracking-wider">
            对话历史
          </h3>
        </div>
        <div className="space-y-1.5">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`w-full text-left px-3.5 py-3 rounded-lg transition-all duration-200 relative group cursor-pointer border ${
                currentConversation?.id === conv.id
                  ? "bg-[#e8f3f0] text-[#10201c] border-[#95c7ba] shadow-[0_8px_20px_rgba(22,122,105,0.10)]"
                  : "text-[#41504d] bg-transparent border-transparent hover:bg-white hover:text-[#18201e] hover:border-[#dce7e3]"
              }`}
            >
              <button
                onClick={() => onSelectConversation(conv.id)}
                className="w-full text-left"
              >
                <div className="text-sm font-medium truncate pr-9 leading-snug">{conv.title}</div>
                <div className="text-xs text-[#7d8d89] mt-1 group-hover:text-[#53635f] flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDate(conv.updated_at)}
                </div>
              </button>
              <button
                onClick={(e) => handleDelete(e, conv.id)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 text-[#7d8d89] hover:text-[#b33b32] hover:bg-[#f7dedb] rounded-md transition-all duration-200"
                title="删除对话"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="px-4 py-6 text-center">
              <div className="w-12 h-12 rounded-lg bg-[#eef4f2] flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-[#7d8d89]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-[#53635f] text-sm">还没有对话</p>
              <p className="text-[#8b9895] text-xs mt-1">开始新的对话吧</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-[#dce7e3]">
        <button
          onClick={() => onViewChange("settings")}
          className="w-full text-left px-3.5 py-3 rounded-lg hover:bg-white text-[#41504d] hover:text-[#18201e] transition-all duration-200 flex items-center gap-3.5 group border border-transparent hover:border-[#dce7e3]"
        >
          <div className="w-9 h-9 rounded-lg bg-[#eef4f2] group-hover:bg-[#e8f3f0] flex items-center justify-center transition-colors">
            <svg className="w-5 h-5 text-[#6d7d79] group-hover:text-[#167a69] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426-1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.572c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium">设置</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
