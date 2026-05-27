import { useState, useEffect } from "react";
import { useConfigContext } from "../contexts/ConfigContext";

interface SettingsProps {
  onBack: () => void;
}

function Settings({ onBack }: SettingsProps) {
  const { config, saveConfig } = useConfigContext();
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    console.log("Settings - config loaded:", config);
    setBaseUrl(config.base_url || "");
  }, [config.base_url]);

  useEffect(() => {
    setApiKey(config.api_key || "");
  }, [config.api_key]);

  useEffect(() => {
    setModel(config.model || "deepseek-v4-pro");
  }, [config.model]);

  const handleSave = async () => {
    await saveConfig({ base_url: baseUrl, api_key: apiKey, model: model });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 h-screen">
      <header className="h-18 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 flex items-center justify-between px-7">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-all duration-200"
          >
            <svg
              className="w-5.5 h-5.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-slate-100 font-semibold text-lg">设置</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-7 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {showSuccess && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-slide-up">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5 text-emerald-400"
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
              </div>
              <div>
                <span className="text-emerald-400 text-sm font-semibold">
                  保存成功！
                </span>
                <p className="text-emerald-300/70 text-xs">您的设置已保存</p>
              </div>
            </div>
          )}

          <div className="bg-slate-800/60 rounded-3xl p-7 border border-slate-700/50 shadow-soft">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-slate-100 font-semibold text-lg">API 配置</h2>
                <p className="text-slate-500 text-sm">配置您的 API 连接信息</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Base URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.deepseek.com"
                    className="w-full pl-12 pr-4 py-4 bg-slate-900/70 border border-slate-700 rounded-2xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-200 text-sm"
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                  OpenAI 格式: https://api.deepseek.com<br/>
                  Anthropic 格式: https://api.deepseek.com/anthropic
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  API Key
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-12 pr-4 py-4 bg-slate-900/70 border border-slate-700 rounded-2xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-200 font-mono text-sm"
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  请输入您的 API Key（将以 Bearer token 方式发送）
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  模型名称
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="deepseek-v4-pro"
                    className="w-full pl-12 pr-4 py-4 bg-slate-900/70 border border-slate-700 rounded-2xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-200 font-mono text-sm"
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  例如: deepseek-v4-pro, gpt-4o, claude-3-sonnet
                </p>
              </div>

              <div className="pt-3">
                <button
                  onClick={handleSave}
                  className="w-full bg-gradient-to-br from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white font-semibold py-4 px-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/35 active:scale-[0.98]"
                >
                  <svg
                    className="w-5.5 h-5.5"
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
                  保存设置
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-3xl p-7 border border-slate-700/50 shadow-soft">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-slate-700/50 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-slate-100 font-semibold text-lg">关于</h2>
                <p className="text-slate-500 text-sm">应用信息</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-slate-500">
              <p>AI 助手桌面应用</p>
              <p>基于 Tauri + React 构建</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
