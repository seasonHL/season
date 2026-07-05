import { AgentProvider, AgentProviderRequest, AgentProviderStreamChunk } from "@season/agent-core";
import { Config, ModelConfig } from "../types";
import { isRetryableModelErrorMessage, sendChatMessage, sendChatMessageStream } from "./api";

export class ApiChatProvider implements AgentProvider {
  readonly name = "openai-compatible";

  constructor(private readonly config: Config) {}

  async complete(request: AgentProviderRequest) {
    return this.withModelFailover((modelConfig) =>
      sendChatMessage(
        modelConfig.base_url,
        modelConfig.api_key,
        { ...request, model: modelConfig.model }
      )
    );
  }

  async stream(
    request: AgentProviderRequest,
    onChunk: (chunk: AgentProviderStreamChunk) => void
  ) {
    return this.withModelFailover((modelConfig) =>
      sendChatMessageStream(
        modelConfig.base_url,
        modelConfig.api_key,
        { ...request, model: modelConfig.model },
        onChunk
      )
    );
  }

  private getModelConfigs(): ModelConfig[] {
    const configuredModels = this.config.models?.filter((item) =>
      item.enabled && item.base_url.trim() && item.model.trim()
    );

    if (configuredModels && configuredModels.length > 0) {
      return configuredModels;
    }

    if (!this.config.base_url) {
      return [];
    }

    return [{
      id: "legacy-primary",
      name: "主模型",
      provider: "default",
      provider_name: "Default",
      base_url: this.config.base_url,
      api_key: this.config.api_key,
      model: this.config.model,
      enabled: true,
    }];
  }

  private async withModelFailover(
    call: (modelConfig: ModelConfig) => ReturnType<typeof sendChatMessage>
  ) {
    const modelConfigs = this.getModelConfigs();
    if (modelConfigs.length === 0) {
      throw new Error("请先在设置页面配置至少一个可用模型");
    }

    const errors: string[] = [];

    for (let index = 0; index < modelConfigs.length; index++) {
      const modelConfig = modelConfigs[index];
      const response = await call(modelConfig);

      if (!response.error) {
        return response;
      }

      const label = modelConfig.name || modelConfig.model;
      errors.push(`${label}: ${response.error}`);

      if (!isRetryableModelErrorMessage(response.error) || index === modelConfigs.length - 1) {
        throw new Error(errors.join("\n"));
      }
    }

    throw new Error(errors.join("\n") || "模型请求失败");
  }
}
