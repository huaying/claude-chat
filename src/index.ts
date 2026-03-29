import "dotenv/config";
import { loadConfig } from "./config";
import { SlackBot } from "./slack/SlackBot";
import { DiscordBot } from "./discord/DiscordBot";
import { TelegramBot } from "./telegram/TelegramBot";

async function main(): Promise<void> {
  const config = loadConfig();
  const bots: Array<{ stop(): void }> = [];

  // ── Slack ──
  if (config.platforms.slack) {
    const slackBot = new SlackBot(config.platforms.slack, config);
    await slackBot.start();
    bots.push(slackBot);
  }

  // ── Discord ──
  if (config.platforms.discord) {
    const discordBot = new DiscordBot(config.platforms.discord, config);
    await discordBot.start();
    bots.push(discordBot);
  }

  // ── Telegram ──
  if (config.platforms.telegram) {
    const telegramBot = new TelegramBot(config.platforms.telegram, config);
    await telegramBot.start();
    bots.push(telegramBot);
  }

  console.log("✅ claude-chat is running");
  console.log(`   Default working dir: ${config.claude.defaultWorkingDir}`);
  if (config.autoApprove.enabled) {
    const tools = config.autoApprove.rules.map((r) => r.tool).join(", ");
    console.log(`   Auto-approve: ${tools}`);
  }

  const shutdown = () => {
    console.log("[main] Shutting down…");
    bots.forEach((b) => b.stop());
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
