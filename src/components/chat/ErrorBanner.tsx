interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="bg-[#fff2f0] border-b border-[#f0c3bd] px-7 py-4">
      <div className="flex items-center gap-3 text-[#7b2924] bg-white/70 px-4 py-3 rounded-lg border border-[#f0c3bd]">
        <div className="w-8 h-8 rounded-lg bg-[#f7dedb] flex items-center justify-center flex-shrink-0">
          <svg className="w-4.5 h-4.5 text-[#b33b32]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onDismiss} className="ml-auto text-[#b33b32] hover:text-[#7b2924] p-1 hover:bg-[#f7dedb] rounded-lg transition-all">
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ErrorBanner;
