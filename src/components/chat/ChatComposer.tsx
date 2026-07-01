interface ChatComposerProps {
  value: string;
  isLoading: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
}

function ChatComposer({
  value,
  isLoading,
  textareaRef,
  onChange,
  onKeyDown,
  onSend,
}: ChatComposerProps) {
  return (
    <div className="px-7 pb-7 pt-4 border-t border-[#dce7e3] bg-white/64 backdrop-blur-xl">
      <div className="bg-white rounded-lg p-4 border border-[#cfdeda] shadow-[0_20px_50px_rgba(31,45,43,0.10)] flex gap-3.5 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="输入消息，按 Enter 发送..."
          className="flex-1 bg-transparent text-[#18201e] placeholder-[#8b9895] resize-none focus:outline-none max-h-[200px] min-h-[24px] text-sm leading-relaxed py-2 px-2"
          rows={1}
        />
        <button
          onClick={onSend}
          disabled={!value.trim() || isLoading}
          className={`p-3.5 rounded-lg transition-all duration-200 flex-shrink-0 ${value.trim() && !isLoading ? "bg-[#167a69] hover:bg-[#126756] text-white shadow-[0_12px_24px_rgba(22,122,105,0.24)] active:scale-[0.96]" : "bg-[#edf3f1] text-[#9aa8a5] cursor-not-allowed"}`}
        >
          <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ChatComposer;
