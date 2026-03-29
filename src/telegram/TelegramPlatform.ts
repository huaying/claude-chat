import type { Telegraf, Context } from "telegraf";
import type {
  Platform,
  PlatformContext,
  MessageHandle,
} from "../platform/Platform";
import { mdToTelegramHTML } from "./formatter";

export class TelegramPlatform implements Platform {
  constructor(
    private readonly bot: Telegraf<Context>,
    public readonly maxMessageLength: number
  ) {}

  async postMessage(
    ctx: PlatformContext,
    text: string
  ): Promise<MessageHandle> {
    const chatId = ctx.channelId;
    const threadId = parseInt(ctx.threadId, 10) || undefined;

    const msg = await this.bot.telegram.sendMessage(chatId, text, {
      reply_parameters: threadId
        ? { message_id: threadId }
        : undefined,
    });
    return { id: String(msg.message_id) };
  }

  async updateMessage(
    ctx: PlatformContext,
    handle: MessageHandle,
    text: string
  ): Promise<void> {
    try {
      await this.bot.telegram.editMessageText(
        ctx.channelId,
        parseInt(handle.id, 10),
        undefined,
        text,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      console.error(
        "[TelegramPlatform] Failed to update message:",
        (err as Error).message
      );
    }
  }

  async postApprovalRequest(
    ctx: PlatformContext,
    toolName: string,
    toolInput: Record<string, unknown>,
    approvalKey: string
  ): Promise<MessageHandle> {
    const chatId = ctx.channelId;
    const threadId = parseInt(ctx.threadId, 10) || undefined;
    const inputSummary = JSON.stringify(toolInput, null, 2).slice(0, 600);

    const msg = await this.bot.telegram.sendMessage(
      chatId,
      `<b>Tool request:</b> <code>${toolName}</code>\n<pre>${escapeHTML(inputSummary)}</pre>`,
      {
        parse_mode: "HTML",
        reply_parameters: threadId
          ? { message_id: threadId }
          : undefined,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Approve",
                callback_data: `approve::${approvalKey}`,
              },
              {
                text: "❌ Deny",
                callback_data: `deny::${approvalKey}`,
              },
            ],
          ],
        },
      }
    );
    return { id: String(msg.message_id) };
  }

  async dismissApprovalRequest(
    ctx: PlatformContext,
    handle: MessageHandle,
    outcome: { approved: boolean; toolName: string }
  ): Promise<void> {
    try {
      await this.bot.telegram.deleteMessage(
        ctx.channelId,
        parseInt(handle.id, 10)
      );
    } catch {
      try {
        const label = outcome.approved ? "allowed" : "denied";
        await this.bot.telegram.editMessageText(
          ctx.channelId,
          parseInt(handle.id, 10),
          undefined,
          `<code>${outcome.toolName}</code> — ${label}`,
          { parse_mode: "HTML" }
        );
        // Remove inline keyboard
        await this.bot.telegram.editMessageReplyMarkup(
          ctx.channelId,
          parseInt(handle.id, 10),
          undefined,
          { inline_keyboard: [] }
        );
      } catch (err) {
        console.error("[TelegramPlatform] Failed to dismiss approval:", (err as Error).message);
      }
    }
  }

  formatText(markdown: string): string {
    return mdToTelegramHTML(markdown);
  }
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
