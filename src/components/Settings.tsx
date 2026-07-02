import { useEffect, useState } from "react";
import { useConfigContext } from "../contexts/ConfigContext";
import { ModelConfig } from "../types";

interface SettingsProps {
  onBack: () => void;
}

const defaultModel = (index: number): ModelConfig => ({
  id: crypto.randomUUID(),
  name: index === 0 ? "主模型" : `备用模型 ${index}`,
  base_url: "",
  api_key: "",
  model: "deepseek-v4-pro",
  enabled: true,
});

const normalizeModels = (configModels: ModelConfig[] | undefined, fallback: Omit<ModelConfig, "id" | "name" | "enabled">) => {
  if (configModels && configModels.length > 0) {
    return configModels.map((item, index) => ({
      ...item,
      id: item.id || crypto.randomUUID(),
      name: item.name || (index === 0 ? "主模型" : `备用模型 ${index}`),
      enabled: item.enabled ?? true,
    }));
  }

  return [{
    id: "primary",
    name: "主模型",
    base_url: fallback.base_url,
    api_key: fallback.api_key,
    model: fallback.model || "deepseek-v4-pro",
    enabled: true,
  }];
};

function Settings({ onBack }: SettingsProps) {
  const { config, saveConfig } = useConfigContext();
  const [models, setModels] = useState<ModelConfig[]>([defaultModel(0)]);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setModels(normalizeModels(config.models, {
      base_url: config.base_url || "",
      api_key: config.api_key || "",
      model: config.model || "deepseek-v4-pro",
    }));
  }, [config]);

  const updateModel = (id: string, patch: Partial<ModelConfig>) => {
    setModels((currentModels) =>
      currentModels.map((item) => item.id === id ? { ...item, ...patch } : item)
    );
  };

  const addModel = () => {
    setModels((currentModels) => [...currentModels, defaultModel(currentModels.length)]);
  };

  const removeModel = (id: string) => {
    setModels((currentModels) =>
      currentModels.length === 1 ? currentModels : currentModels.filter((item) => item.id !== id)
    );
  };

  const moveModel = (id: string, direction: -1 | 1) => {
    setModels((currentModels) => {
      const index = currentModels.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= currentModels.length) return currentModels;

      const nextModels = [...currentModels];
      const [item] = nextModels.splice(index, 1);
      nextModels.splice(nextIndex, 0, item);
      return nextModels;
    });
  };

  const handleSave = async () => {
    const sanitizedModels = models.map((item, index) => ({
      ...item,
      id: item.id || crypto.randomUUID(),
      name: item.name.trim() || (index === 0 ? "主模型" : `备用模型 ${index}`),
      base_url: item.base_url.trim(),
      api_key: item.api_key.trim(),
      model: item.model.trim(),
    }));
    const primaryModel = sanitizedModels[0] || defaultModel(0);

    await saveConfig({
      base_url: primaryModel.base_url,
      api_key: primaryModel.api_key,
      model: primaryModel.model || "deepseek-v4-pro",
      models: sanitizedModels,
    });
    setModels(sanitizedModels);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col bg-[linear-gradient(180deg,#fbfdfc_0%,#f1f7f5_100%)] h-screen">
      <header className="h-[72px] bg-white/78 backdrop-blur-xl border-b border-[#dce7e3] flex items-center justify-between px-7">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 text-[#7d8d89] hover:text-[#18201e] hover:bg-[#eef4f2] rounded-lg transition-all duration-200"
            title="返回"
          >
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[#18201e] font-semibold text-lg">设置</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-7 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {showSuccess && (
            <div className="flex items-center gap-3 p-4 bg-[#ecf8f3] border border-[#b8ddcf] rounded-lg animate-slide-up">
              <div className="w-9 h-9 rounded-lg bg-[#d8f0e6] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#167a69]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <span className="text-[#167a69] text-sm font-semibold">保存成功！</span>
                <p className="text-[#5d7d74] text-xs">模型配置已更新</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg p-7 border border-[#dce7e3] shadow-[0_20px_50px_rgba(31,45,43,0.08)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-7">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-[#e8f3f0] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#167a69]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M7 12h10M10 17h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-[#18201e] font-semibold text-lg">模型配置</h2>
                  <p className="text-[#6d7d79] text-sm">按顺序尝试，主模型失败后切换到启用的备用模型</p>
                </div>
              </div>

              <button
                onClick={addModel}
                className="h-10 px-4 bg-[#eef4f2] hover:bg-[#e3eeea] text-[#167a69] font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
                </svg>
                新增模型
              </button>
            </div>

            <div className="space-y-7">
              {models.map((item, index) => (
                <section key={item.id} className="border-t border-[#edf3f1] pt-7 first:border-t-0 first:pt-0">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-[#f2f7f5] border border-[#dce7e3] flex items-center justify-center text-sm font-semibold text-[#41504d]">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[#18201e]">
                          {index === 0 ? "主模型" : "备用模型"}
                        </p>
                        <p className="text-xs text-[#6d7d79]">仅对可恢复错误执行下一个模型</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 px-3 h-9 rounded-lg bg-[#f8fbfa] border border-[#dce7e3] text-sm text-[#41504d]">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(event) => updateModel(item.id, { enabled: event.target.checked })}
                          className="accent-[#167a69]"
                        />
                        启用
                      </label>
                      <button
                        onClick={() => moveModel(item.id, -1)}
                        disabled={index === 0}
                        className="w-9 h-9 rounded-lg border border-[#dce7e3] text-[#6d7d79] hover:text-[#18201e] hover:bg-[#f8fbfa] disabled:opacity-35 disabled:hover:bg-transparent transition-all"
                        title="上移"
                      >
                        <svg className="w-4.5 h-4.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveModel(item.id, 1)}
                        disabled={index === models.length - 1}
                        className="w-9 h-9 rounded-lg border border-[#dce7e3] text-[#6d7d79] hover:text-[#18201e] hover:bg-[#f8fbfa] disabled:opacity-35 disabled:hover:bg-transparent transition-all"
                        title="下移"
                      >
                        <svg className="w-4.5 h-4.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeModel(item.id)}
                        disabled={models.length === 1}
                        className="w-9 h-9 rounded-lg border border-[#f0c3bd] text-[#b33b32] hover:bg-[#fff2f0] disabled:opacity-35 disabled:hover:bg-transparent transition-all"
                        title="删除"
                      >
                        <svg className="w-4.5 h-4.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="配置名称">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(event) => updateModel(item.id, { name: event.target.value })}
                        placeholder="主模型"
                        className="input-field"
                      />
                    </Field>

                    <Field label="模型名称">
                      <input
                        type="text"
                        value={item.model}
                        onChange={(event) => updateModel(item.id, { model: event.target.value })}
                        placeholder="deepseek-v4-pro"
                        className="input-field font-mono"
                      />
                    </Field>

                    <Field label="Base URL">
                      <input
                        type="text"
                        value={item.base_url}
                        onChange={(event) => updateModel(item.id, { base_url: event.target.value })}
                        placeholder="https://api.deepseek.com"
                        className="input-field"
                      />
                    </Field>

                    <Field label="API Key">
                      <input
                        type="password"
                        value={item.api_key}
                        onChange={(event) => updateModel(item.id, { api_key: event.target.value })}
                        placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                        className="input-field font-mono"
                      />
                    </Field>
                  </div>
                </section>
              ))}

              <div className="pt-3">
                <button
                  onClick={handleSave}
                  className="w-full bg-[#167a69] hover:bg-[#126756] text-white font-semibold py-4 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2.5 shadow-[0_14px_28px_rgba(22,122,105,0.24)] active:scale-[0.98]"
                >
                  <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  保存设置
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-7 border border-[#dce7e3] shadow-[0_20px_50px_rgba(31,45,43,0.08)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-lg bg-[#eef4f2] flex items-center justify-center">
                <svg className="w-6 h-6 text-[#7d8d89]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-[#18201e] font-semibold text-lg">容灾策略</h2>
                <p className="text-[#6d7d79] text-sm">429、529、503、超时和网络断开会触发备用模型</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-[#6d7d79]">
              <p>OpenAI 格式会自动请求 `/chat/completions`，包含 `anthropic` 的地址会请求 `/v1/messages`。</p>
              <p>401、403、402、400 等不可恢复错误会直接停止，不会继续消耗备用模型。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-[#41504d] mb-2">{label}</span>
      {children}
    </label>
  );
}

export default Settings;
