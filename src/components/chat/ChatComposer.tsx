import { useEffect, useMemo, useRef } from "react";
import {
  ArrowUp,
  Mic,
  Paperclip,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useConfigContext } from "@/contexts/ConfigContext";
import { cn } from "@/lib/utils";
import { ModelConfig, PermissionMode } from "@/types";

interface ChatComposerProps {
  value: string;
  isLoading: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onAttachmentsChange: (files: File[]) => void;
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
  onSend: () => void;
  attachmentCount: number;
}

const permissionOptions: Array<{ value: PermissionMode; label: string }> = [
  { value: "full-access", label: "完全访问" },
  { value: "ask-first", label: "请求确认" },
  { value: "chat-only", label: "仅聊天" },
];

const legacyModelOption = (model: string): ModelConfig => ({
  id: "legacy-primary",
  name: "主模型",
  provider: "default",
  provider_name: "Default",
  base_url: "",
  api_key: "",
  model,
  enabled: true,
});

const getModelDisplayLabel = (model: ModelConfig) => {
  const providerName = model.provider_name?.trim() || model.provider;

  return providerName ? `${providerName} / ${model.model}` : model.model;
};

function ChatComposer({
  value,
  isLoading,
  textareaRef,
  onChange,
  onKeyDown,
  onAttachmentsChange,
  permissionMode,
  onPermissionModeChange,
  onSend,
  attachmentCount,
}: ChatComposerProps) {
  const { config, saveConfig } = useConfigContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSend = (Boolean(value.trim()) || attachmentCount > 0) && !isLoading;

  const selectableModels = useMemo(() => {
    const models = config.models?.length
      ? config.models
      : [legacyModelOption(config.model || "deepseek-v4-pro")];

    return models.filter((model) =>
      model.enabled && model.base_url.trim() && model.model.trim()
    );
  }, [config.model, config.models]);

  const activeModel = selectableModels[0];
  const activeModelId = activeModel?.id ?? "";
  const activeModelLabel = activeModel
    ? getModelDisplayLabel(activeModel)
    : "选择模型";
  const modelOptions = selectableModels.map((model) => ({
    value: model.id,
    label: getModelDisplayLabel(model),
  }));

  const handleModelChange = async (selectedId: string) => {
    const selectedModel = selectableModels.find((model) => model.id === selectedId);

    if (!selectedModel || selectedModel.id === activeModelId) return;

    const currentModels = config.models?.length ? config.models : selectableModels;
    const reorderedModels = [
      { ...selectedModel, enabled: true },
      ...currentModels.filter((model) => model.id !== selectedId),
    ];

    await saveConfig({
      ...config,
      base_url: selectedModel.base_url,
      api_key: selectedModel.api_key,
      model: selectedModel.model,
      models: reorderedModels,
    });
  };

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onAttachmentsChange(Array.from(event.target.files ?? []));
  };

  useEffect(() => {
    if (attachmentCount === 0 && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [attachmentCount]);

  return (
    <div className="border-t border-border bg-card/70 px-4 pb-5 pt-4 backdrop-blur-xl sm:px-7 sm:pb-7">
      <div className="rounded-[28px] border border-border bg-card px-3.5 pb-3.5 pt-4 shadow-[0_20px_50px_rgba(31,45,43,0.10)] sm:px-5 sm:pt-5">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="要求后续变更"
          className="max-h-[200px] min-h-[58px] resize-none border-0 bg-transparent px-1 text-[15px] shadow-none focus-visible:ring-0"
          rows={1}
        />
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleAttachmentChange}
            />
            <Button
              type="button"
              title="添加附件"
              aria-label="添加附件"
              variant="outline"
              size="icon-lg"
              onClick={() => fileInputRef.current?.click()}
            >
              {attachmentCount > 0 ? <Paperclip /> : <Plus />}
            </Button>
            <Select
              items={permissionOptions}
              value={permissionMode}
              onValueChange={(nextValue) => onPermissionModeChange(nextValue as PermissionMode)}
            >
              <SelectTrigger
                size="default"
                title="权限控制"
                className="h-9 border-destructive/30 bg-background font-semibold text-destructive hover:bg-destructive/10"
              >
                <SlidersHorizontal data-icon="inline-start" />
                <SelectValue placeholder="权限控制" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {permissionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {attachmentCount > 0 && (
              <Badge variant="secondary">
                {attachmentCount} 个附件
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Select
              items={modelOptions}
              value={activeModelId}
              onValueChange={(nextValue) => {
                if (typeof nextValue === "string") {
                  void handleModelChange(nextValue);
                }
              }}
            >
              <SelectTrigger
                size="default"
                title="选择模型"
                className="h-10 min-w-[152px] bg-background font-semibold"
              >
                <SelectValue placeholder={activeModelLabel} />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {selectableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {getModelDisplayLabel(model)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              type="button"
              title="语音输入"
              aria-label="语音输入"
              variant="ghost"
              size="icon-lg"
              className="rounded-full text-muted-foreground"
            >
              <Mic />
            </Button>
            <Button
              onClick={onSend}
              disabled={!canSend}
              size="icon-lg"
              className={cn(
                "size-11 rounded-full shadow-[0_12px_24px_rgba(22,122,105,0.24)]",
                !canSend && "shadow-none"
              )}
              title="发送"
              aria-label="发送"
            >
              <ArrowUp />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatComposer;
