import "dotenv/config";
import { App } from "@slack/bolt";
import { loadConfig } from "./config";
import { SessionManager } from "./session/SessionManager";
import { registerMessageHandler } from "./slack/handlers/message.handler";
import { registerActionHandler } from "./slack/handlers/action.handler";

async function main(): Promise<void> {
  const config = loadConfig();

  const app = new App({
    token: config.slack.botToken,
    signingSecret: config.slack.signingSecret,
    socketMode: true,
    appToken: config.slack.appToken,
  });

  const sessionManager = new SessionManager(config, app.client);

  registerMessageHandler(app, sessionManager);
  registerActionHandler(app, sessionManager);

  app.error(async (error) => {
    console.error("[Bolt] Unhandled error:", error);
  });

  process.on("SIGTERM", () => {
    console.log("[main] Shutting down…");
    sessionManager.dispose();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("[main] Shutting down…");
    sessionManager.dispose();
    process.exit(0);
  });

  await app.start();
  console.log("✅ claude-slack-bridge is running (Socket Mode)");
  console.log(`   Default working dir: ${config.claude.defaultWorkingDir}`);
  console.log("   Commands: /cd <path>  |  /claude-reset");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
