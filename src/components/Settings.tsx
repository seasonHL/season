import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  KeyRound,
  Plus,
  Search,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useConfigContext } from "@/contexts/ConfigContext";
import { ModelConfig } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface SettingsProps {
  onBack: () => void;
}

interface ProviderDraft {
  base_url: string;
  api_key: string;
}

interface CustomProviderDraft {
  provider_id: string;
  provider_name: string;
  base_url: string;
  api_key: string;
  model: string;
}

type ModelFallback = Pick<ModelConfig, "base_url" | "api_key" | "model">;

const DEFAULT_PROVIDER_ID = "default";
const DEFAULT_MODEL = "deepseek-v4-pro";
const DEFAULT_API_KEY_PLACEHOLDER = "按供应商要求填写，可留空";
const DEFAULT_BASE_URL_PLACEHOLDER = "例如 https://api.example.com/v1";

const defaultCustomProviderDraft = (): CustomProviderDraft => ({
  provider_id: "",
  provider_name: "",
  base_url: "",
  api_key: "",
  model: DEFAULT_MODEL,
});

const defaultModel = (index: number, provider = DEFAULT_PROVIDER_ID): ModelConfig => ({
  id: crypto.randomUUID(),
  name: index === 0 ? "主模型" : `备用模型 ${index}`,
  provider,
  provider_name: "",
  base_url: "",
  api_key: "",
  model: DEFAULT_MODEL,
  enabled: true,
});

const normalizeModels = (configModels: ModelConfig[] | undefined, fallback: ModelFallback): ModelConfig[] => {
  if (configModels && configModels.length > 0) {
    return configModels.map((item, index) => ({
      ...item,
      id: item.id || crypto.randomUUID(),
      name: item.name || (index === 0 ? "主模型" : `备用模型 ${index}`),
      provider: item.provider || DEFAULT_PROVIDER_ID,
      provider_name: item.provider_name ?? "",
      enabled: item.enabled ?? true,
    }));
  }

  return [{
    id: "primary",
    name: "主模型",
    provider: DEFAULT_PROVIDER_ID,
    provider_name: "",
    base_url: fallback.base_url,
    api_key: fallback.api_key,
    model: fallback.model || DEFAULT_MODEL,
    enabled: true,
  }];
};

const createProviderDrafts = (models: ModelConfig[]): Record<string, ProviderDraft> => {
  const drafts: Record<string, ProviderDraft> = {};

  for (const model of models) {
    drafts[model.provider] = {
      base_url: model.base_url,
      api_key: model.api_key,
    };
  }

  return drafts;
};

const getProviderDisplayName = (providerId: string | null | undefined, models: ModelConfig[]) => {
  return models.find((model) => model.provider === providerId)?.provider_name?.trim() ?? "";
};

const getProviderRawName = (providerId: string | null | undefined, models: ModelConfig[]) => {
  return models.find((model) => model.provider === providerId)?.provider_name ?? "";
};

function Settings({ onBack }: SettingsProps) {
  const { config, saveConfig } = useConfigContext();
  const [models, setModels] = useState<ModelConfig[]>([defaultModel(0)]);
  const [providerDrafts, setProviderDrafts] = useState<Record<string, ProviderDraft>>({});
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [settingsProvider, setSettingsProvider] = useState<string | null>(null);
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [customProviderDraft, setCustomProviderDraft] = useState<CustomProviderDraft>(defaultCustomProviderDraft);
  const [modelSearch, setModelSearch] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const normalizedModels = normalizeModels(config.models, {
      base_url: config.base_url || "",
      api_key: config.api_key || "",
      model: config.model || "deepseek-v4-pro",
    });
    setModels(normalizedModels);
    setProviderDrafts(createProviderDrafts(normalizedModels));
  }, [config]);

  const providerCards = useMemo(() => {
    const configuredProviderIds = [...new Set(models.map((model) => model.provider || DEFAULT_PROVIDER_ID))];
    return configuredProviderIds.map((providerId) => ({
      id: providerId,
      name: getProviderDisplayName(providerId, models),
    }));
  }, [models]);

  const activeProviderName = getProviderDisplayName(activeProvider, models);
  const settingsProviderRawName = getProviderRawName(settingsProvider, models);
  const settingsProviderDraft = settingsProvider
    ? providerDrafts[settingsProvider] ?? {
        base_url: "",
        api_key: "",
      }
    : null;
  const activeProviderModels = models.filter((model) => model.provider === activeProvider);
  const filteredActiveModels = activeProviderModels.filter((model) => {
    const query = modelSearch.trim().toLowerCase();
    if (!query) return true;
    return `${model.name} ${model.model}`.toLowerCase().includes(query);
  });

  const updateProviderDraft = (providerId: string, patch: Partial<ProviderDraft>) => {
    setProviderDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[providerId];
      const nextDraft = {
        base_url: patch.base_url ?? currentDraft?.base_url ?? "",
        api_key: patch.api_key ?? currentDraft?.api_key ?? "",
      };

      return { ...currentDrafts, [providerId]: nextDraft };
    });

    setModels((currentModels) =>
      currentModels.map((model) =>
        model.provider === providerId ? { ...model, ...patch } : model
      )
    );
  };

  const updateModel = (id: string, patch: Partial<ModelConfig>) => {
    setModels((currentModels) =>
      currentModels.map((model) => model.id === id ? { ...model, ...patch } : model)
    );
  };

  const updateProviderName = (providerId: string, providerName: string) => {
    setModels((currentModels) =>
      currentModels.map((model) =>
        model.provider === providerId ? { ...model, provider_name: providerName } : model
      )
    );
  };

  const addModel = (providerId: string) => {
    const providerModels = models.filter((model) => model.provider === providerId);
    const draft = providerDrafts[providerId];
    const nextModel: ModelConfig = {
      id: crypto.randomUUID(),
      name: providerModels.length === 0 ? "主模型" : `备用模型 ${providerModels.length}`,
      provider: providerId,
      provider_name: providerModels[0]?.provider_name ?? "",
      base_url: draft?.base_url ?? "",
      api_key: draft?.api_key ?? "",
      model: DEFAULT_MODEL,
      enabled: true,
    };

    setModels((currentModels) => [...currentModels, nextModel]);
  };

  const addProvider = () => {
    setCustomProviderDraft(defaultCustomProviderDraft());
    setIsAddCustomOpen(true);
  };

  const createCustomProvider = () => {
    const providerId = customProviderDraft.provider_id.trim();
    const providerName = customProviderDraft.provider_name.trim() || providerId;
    const baseUrl = customProviderDraft.base_url.trim();
    const model = customProviderDraft.model.trim() || DEFAULT_MODEL;
    const apiKey = customProviderDraft.api_key.trim();

    const nextModel: ModelConfig = {
      id: crypto.randomUUID(),
      name: "主模型",
      provider: providerId,
      provider_name: providerName,
      base_url: baseUrl,
      api_key: apiKey,
      model,
      enabled: true,
    };

    setProviderDrafts((currentDrafts) => ({
      ...currentDrafts,
      [providerId]: {
        base_url: baseUrl,
        api_key: apiKey,
      },
    }));
    setModels((currentModels) => [...currentModels, nextModel]);
    setIsAddCustomOpen(false);
  };

  const removeModel = (id: string) => {
    setModels((currentModels) => currentModels.filter((model) => model.id !== id));
  };

  const removeProvider = (providerId: string) => {
    if (providerCards.length <= 1) return;
    setModels((currentModels) => currentModels.filter((model) => model.provider !== providerId));
    setActiveProvider(null);
    setSettingsProvider(null);
  };

  const handleSave = async () => {
    const sanitizedModels: ModelConfig[] = models.map((model, index) => {
      const draft = providerDrafts[model.provider];
      return {
        ...model,
        id: model.id || crypto.randomUUID(),
        name: model.name.trim() || (index === 0 ? "主模型" : `备用模型 ${index}`),
        provider: model.provider || DEFAULT_PROVIDER_ID,
        provider_name: model.provider_name?.trim() ?? "",
        base_url: (draft?.base_url ?? model.base_url).trim(),
        api_key: (draft?.api_key ?? model.api_key).trim(),
        model: model.model.trim(),
      };
    });
    const primaryModel = sanitizedModels.find((model) => model.enabled) || sanitizedModels[0] || defaultModel(0);

    await saveConfig({
      base_url: primaryModel.base_url,
      api_key: primaryModel.api_key,
      model: primaryModel.model || "deepseek-v4-pro",
      models: sanitizedModels,
    });
    setModels(sanitizedModels);
    setProviderDrafts(createProviderDrafts(sanitizedModels));
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const canCreateCustomProvider = Boolean(
    customProviderDraft.provider_name.trim() &&
    customProviderDraft.provider_id.trim() &&
    customProviderDraft.base_url.trim() &&
    customProviderDraft.model.trim() &&
    !models.some((model) => model.provider === customProviderDraft.provider_id.trim())
  );

  return (
    <div className="flex h-screen flex-1 flex-col bg-background">
      <header className="flex h-[72px] items-center justify-between border-b bg-card/80 px-7 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Button onClick={onBack} variant="ghost" size="icon" title="返回">
            <ArrowLeft />
          </Button>
          <div>
            <p className="text-xs text-muted-foreground">设置</p>
            <h1 className="text-lg font-semibold text-foreground">模型</h1>
          </div>
        </div>
        <Button onClick={handleSave}>
          <Check data-icon="inline-start" />
          保存设置
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto px-7 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          {showSuccess && (
            <Card size="sm" className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-center gap-3">
                <Badge variant="secondary">已保存</Badge>
                <span className="text-sm text-muted-foreground">模型配置已更新</span>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-foreground">模型供应商</h2>
              <p className="text-sm text-muted-foreground">
                每张卡片管理一个供应商，模型列表会按保存顺序参与主备切换。
              </p>
            </div>

            <div className="flex w-full gap-2 lg:w-auto">
              <Button variant="outline" onClick={addProvider}>
                <Plus data-icon="inline-start" />
                添加提供商
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {providerCards.map((provider) => {
              const draft = providerDrafts[provider.id] ?? {
                base_url: "",
                api_key: "",
              };
              const providerModels = models.filter((model) => model.provider === provider.id);

              return (
                <Card key={provider.id} className="min-h-[360px]">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary">
                        {provider.name.slice(0, 1).toUpperCase()}
                      </div>
                      <CardTitle>{provider.name}</CardTitle>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <FieldGroup>
                      <Field>
                        <FieldLabel>ENDPOINT</FieldLabel>
                        <Input
                          value={draft.base_url}
                          onChange={(event) => updateProviderDraft(provider.id, { base_url: event.target.value })}
                          placeholder={DEFAULT_BASE_URL_PLACEHOLDER}
                        />
                      </Field>

                      <Field>
                        <FieldLabel>API KEY</FieldLabel>
                        <div className="flex gap-2">
                          <Input
                            value={draft.api_key}
                            onChange={(event) => updateProviderDraft(provider.id, { api_key: event.target.value })}
                            placeholder={DEFAULT_API_KEY_PLACEHOLDER}
                            type="password"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            title="修改 API Key"
                            onClick={() => setSettingsProvider(provider.id)}
                          >
                            <KeyRound />
                          </Button>
                        </div>
                        <FieldDescription>按供应商要求填写，可留空。</FieldDescription>
                      </Field>

                    </FieldGroup>

                    <Separator className="my-5" />

                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground">MODELS</p>
                      <p className="min-h-5 text-sm">
                        {providerModels.length > 0
                          ? providerModels.map((model) => model.model).join(", ")
                          : "暂无模型"}
                      </p>
                    </div>
                  </CardContent>

                  <CardFooter className="gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActiveProvider(provider.id)}>
                      <SlidersHorizontal data-icon="inline-start" />
                      模型
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSettingsProvider(provider.id)}>
                      <SettingsIcon data-icon="inline-start" />
                      设置
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={providerCards.length <= 1}
                      onClick={() => removeProvider(provider.id)}
                    >
                      <Trash2 data-icon="inline-start" />
                      删除
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </main>

      <Dialog open={isAddCustomOpen} onOpenChange={setIsAddCustomOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>添加自定义提供商</DialogTitle>
            <DialogDescription>
              创建后会生成一张自定义供应商卡片，并添加一个初始模型。
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel>提供商 ID</FieldLabel>
              <Input
                value={customProviderDraft.provider_id}
                onChange={(event) =>
                  setCustomProviderDraft((draft) => ({ ...draft, provider_id: event.target.value.trim() }))
                }
                placeholder="例如 deepseek、openrouter"
              />
              <FieldDescription>用于内部标识，创建后不建议修改。</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>显示名称</FieldLabel>
              <Input
                value={customProviderDraft.provider_name}
                onChange={(event) =>
                  setCustomProviderDraft((draft) => ({ ...draft, provider_name: event.target.value }))
                }
                placeholder="例如 DeepSeek、OpenRouter"
              />
              <FieldDescription>用于卡片标题和弹窗标题。</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Base URL</FieldLabel>
              <Input
                value={customProviderDraft.base_url}
                onChange={(event) =>
                  setCustomProviderDraft((draft) => ({ ...draft, base_url: event.target.value }))
                }
                placeholder="例如 https://api.example.com/v1"
              />
            </Field>

            <Field>
              <FieldLabel>API Key</FieldLabel>
              <Input
                value={customProviderDraft.api_key}
                onChange={(event) =>
                  setCustomProviderDraft((draft) => ({ ...draft, api_key: event.target.value }))
                }
                placeholder="按供应商要求填写，可留空"
                type="password"
              />
            </Field>

            <Field>
              <FieldLabel>初始模型</FieldLabel>
              <Input
                value={customProviderDraft.model}
                onChange={(event) =>
                  setCustomProviderDraft((draft) => ({ ...draft, model: event.target.value }))
                }
                placeholder="例如 deepseek-chat"
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCustomOpen(false)}>取消</Button>
            <Button onClick={createCustomProvider} disabled={!canCreateCustomProvider}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(settingsProvider)} onOpenChange={(open) => !open && setSettingsProvider(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>供应商设置</DialogTitle>
            <DialogDescription>
              配置这个供应商的访问地址和密钥。
            </DialogDescription>
          </DialogHeader>

          {settingsProvider && settingsProviderDraft && (
            <FieldGroup>
              <Field>
                <FieldLabel>显示名称</FieldLabel>
                <Input
                  value={settingsProviderRawName}
                  onChange={(event) => updateProviderName(settingsProvider, event.target.value)}
                  placeholder="例如 DeepSeek、OpenRouter"
                />
              </Field>

              <Field>
                <FieldLabel>ENDPOINT</FieldLabel>
                <Input
                  value={settingsProviderDraft.base_url}
                  onChange={(event) => updateProviderDraft(settingsProvider, { base_url: event.target.value })}
                  placeholder={DEFAULT_BASE_URL_PLACEHOLDER}
                />
              </Field>

              <Field>
                <FieldLabel>API KEY</FieldLabel>
                <Input
                  value={settingsProviderDraft.api_key}
                  onChange={(event) => updateProviderDraft(settingsProvider, { api_key: event.target.value })}
                  placeholder={DEFAULT_API_KEY_PLACEHOLDER}
                  type="password"
                />
                <FieldDescription>按供应商要求填写，可留空。</FieldDescription>
              </Field>

            </FieldGroup>
          )}

          <DialogFooter>
            <Button onClick={() => setSettingsProvider(null)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activeProvider)} onOpenChange={(open) => !open && setActiveProvider(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeProviderName ?? "模型"} - 模型管理</DialogTitle>
            <DialogDescription>
              管理该供应商下参与主备切换的模型。
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                placeholder="搜索模型..."
              />
            </div>

            {filteredActiveModels.length === 0 ? (
              <Empty className="min-h-28 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SlidersHorizontal />
                  </EmptyMedia>
                  <EmptyTitle>暂无模型</EmptyTitle>
                  <EmptyDescription>添加一个模型后，这个供应商才会参与请求。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="max-h-[320px] overflow-y-auto">
                <div className="grid grid-cols-[1fr_1.2fr_88px_44px] gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>配置名称</span>
                  <span>模型名称</span>
                  <span>状态</span>
                  <span className="sr-only">操作</span>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {filteredActiveModels.map((model) => (
                    <div key={model.id} className="grid grid-cols-[1fr_1.2fr_88px_44px] items-center gap-3 rounded-lg bg-muted/20 px-3 py-2">
                      <Input
                        className="border-transparent bg-background"
                        value={model.name}
                        onChange={(event) => updateModel(model.id, { name: event.target.value })}
                        placeholder="主模型"
                      />
                      <Input
                        className="border-transparent bg-background"
                        value={model.model}
                        onChange={(event) => updateModel(model.id, { model: event.target.value })}
                        placeholder="model-name"
                      />
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={model.enabled}
                          onCheckedChange={(checked) => updateModel(model.id, { enabled: checked })}
                        />
                        <span className="text-sm">启用</span>
                      </div>
                      <Button variant="destructive" size="icon" onClick={() => removeModel(model.id)}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => activeProvider && addModel(activeProvider)}
            >
              <Plus data-icon="inline-start" />
              添加模型
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setActiveProvider(null)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Settings;
