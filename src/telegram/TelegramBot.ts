import { Telegraf } from "telegraf";
import { TelegramPlatform } from "./TelegramPlatform";
import { SessionManager } from "../core/SessionManager";
import { AutoApprovePolicy } from "../approval/AutoApprovePolicy";
import type { AppConfig, TelegramConfig } from "../types/index";

export class TelegramBot {
  private bot: Telegraf;
  private sessionManager: SessionManager;

  constructor(telegramConfig: TelegramConfig, appConfig: AppConfig) {
    this.bot = new Telegraf(telegramConfig.botToken);

    const platform = new TelegramPlatform(this.bot);
    const autoApprovePolicy = new AutoApprovePolicy(appConfig.autoApprove);
    this.sessionManager = new SessionManager(
      appConfig,
      platform,
      autoApprovePolicy
    );

    // Handle text messages
    this.bot.on("text", async (ctx) => {
      const text = ctx.message.text?.trim();
      if (!text) return;

      const chatId = String(ctx.chat.id);
      // Use reply-to message as thread context, or the message itself
      const threadId = String(
        ctx.message.reply_to_message?.message_id ?? ctx.message.message_id
      );

      const session = this.sessionManager.getOrCreate({
        channelId: chatId,
        threadId,
      });

      // Handle commands
      if (/^\/cd\s+(.+)$/i.test(text)) {
        const newDir = text.match(/^\/cd\s+(.+)$/i)![1].trim();
        const { existsSync } = await import("node:fs");
        if (!existsSync(newDir)) {
          await ctx.reply(`Directory not found: \`${newDir}\``, {
            parse_mode: "Markdown",
          });
          return;
        }
        session.setWorkingDir(newDir);
        await ctx.reply(`Working directory: \`${newDir}\``, {
          parse_mode: "Markdown",
        });
        return;
      }

      if (/^\/claude[-_]?reset$/i.test(text)) {
        await this.sessionManager.destroy({ channelId: chatId, threadId });
        await ctx.reply("Session reset.");
        return;
      }

      void session.handleUserMessage(text);
    });

    // Handle approval button clicks
    this.bot.on("callback_query", async (ctx) => {
      if (!("data" in ctx.callbackQuery)) return;

      const data = ctx.callbackQuery.data;
      const isApprove = data.startsWith("approve::");
      const isDeny = data.startsWith("deny::");

      if (!isApprove && !isDeny) return;

      await ctx.answerCbQuery();

      const approvalKey = data.replace(/^(approve|deny)::/, "");
      const threadId = approvalKey.split("::")[0];
      const chatId = String(ctx.chat!.id);

      const session = this.sessionManager.get({
        channelId: chatId,
        threadId,
      });
      if (!session) return;

      const found = session.resolveApproval(approvalKey, isApprove);
      if (!found) {
        console.warn(
          "[Telegram] Approval key not found (already resolved?):",
          approvalKey
        );
      }
    });
  }

  async start(): Promise<void> {
    await this.bot.launch();
    console.log("[Telegram] Bot is running");
  }

  stop(): void {
    this.sessionManager.dispose();
    this.bot.stop();
  }
}
