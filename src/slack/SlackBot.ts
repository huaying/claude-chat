import { App } from "@slack/bolt";
import { SlackPlatform } from "./SlackPlatform";
import { SessionManager } from "../core/SessionManager";
import { AutoApprovePolicy } from "../approval/AutoApprovePolicy";
import { registerMessageHandler } from "./handlers/message.handler";
import { registerActionHandler } from "./handlers/action.handler";
import type { AppConfig, SlackConfig } from "../types/index";

export class SlackBot {
  private app: App;
  private sessionManager: SessionManager;

  constructor(slackConfig: SlackConfig, appConfig: AppConfig) {
    this.app = new App({
      token: slackConfig.botToken,
      signingSecret: slackConfig.signingSecret,
      socketMode: true,
      appToken: slackConfig.appToken,
    });

    const platform = new SlackPlatform(this.app.client);
    const autoApprovePolicy = new AutoApprovePolicy(appConfig.autoApprove);
    this.sessionManager = new SessionManager(
      appConfig,
      platform,
      autoApprovePolicy
    );

    registerMessageHandler(this.app, this.sessionManager);
    registerActionHandler(this.app, this.sessionManager);

    this.app.error(async (error) => {
      console.error("[Slack] Unhandled error:", error);
    });
  }

  async start(): Promise<void> {
    await this.app.start();
    console.log("[Slack] Bot is running (Socket Mode)");
  }

  stop(): void {
    this.sessionManager.dispose();
  }
}
