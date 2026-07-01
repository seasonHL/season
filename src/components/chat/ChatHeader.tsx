function ChatHeader() {
  return (
    <header className="h-[72px] bg-white/78 backdrop-blur-xl border-b border-[#dce7e3] flex items-center justify-between px-7">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#167a69] flex items-center justify-center shadow-[0_10px_24px_rgba(22,122,105,0.20)]">
          <svg className="w-5.5 h-5.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <h1 className="text-[#18201e] font-semibold text-base">AI 助手</h1>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#18a076] animate-pulse"></span>
            <p className="text-[#6d7d79] text-xs">在线</p>
          </div>
        </div>
      </div>
      <button className="p-2.5 text-[#7d8d89] hover:text-[#18201e] hover:bg-[#eef4f2] rounded-lg transition-all duration-200">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      </button>
    </header>
  );
}

export default ChatHeader;
