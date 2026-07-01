import { AgentProvider, AgentProviderRequest } from "@season/agent-core";
import { Config } from "../types";
import { sendChatMessage } from "./api";

export class ApiChatProvider implements AgentProvider {
  readonly name = "openai-compatible";

  constructor(private readonly config: Config) {}

  async complete(request: AgentProviderRequest) {
    if (!this.config.base_url) {
      throw new Error("请先在设置页面配置 API 地址");
    }

    const response = await sendChatMessage(
      this.config.base_url,
      this.config.api_key,
      request
    );

    if (response.error) {
      throw new Error(response.error);
    }

    return response;
  }
}
