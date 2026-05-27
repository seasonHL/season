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
    <div className="flex-1 flex flex-col bg-slate-800 h-screen">
      <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-white font-semibold text-lg">设置</h1>
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="bg-slate-700/50 rounded-2xl p-6 border border-slate-700">
            <h2 className="text-white font-semibold text-lg mb-6">API 配置</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Base URL
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.deepseek.com"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <p className="mt-2 text-xs text-slate-400">
                  OpenAI 格式: https://api.deepseek.com<br/>
                  Anthropic 格式: https://api.deepseek.com/anthropic
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm"
                />
                <p className="mt-2 text-xs text-slate-400">
                  请输入您的 API Key（将以 Bearer token 方式发送）
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  模型名称
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="deepseek-v4-pro"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm"
                />
                <p className="mt-2 text-xs text-slate-400">
                  例如: deepseek-v4-pro, gpt-4o, claude-3-sonnet
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleSave}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  保存设置
                </button>
              </div>

              {showSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-600/20 border border-green-500/30 rounded-xl">
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
                  <span className="text-green-400 text-sm font-medium">
                    保存成功！
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-700/50 rounded-2xl p-6 border border-slate-700">
            <h2 className="text-white font-semibold text-lg mb-4">关于</h2>
            <div className="space-y-2 text-sm text-slate-400">
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
