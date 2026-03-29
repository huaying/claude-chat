import {
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
} from "discord.js";
import type {
  Platform,
  PlatformContext,
  MessageHandle,
} from "../platform/Platform";
import { mdToDiscord } from "./formatter";

export class DiscordPlatform implements Platform {
  constructor(private readonly client: Client) {}

  async postMessage(
    ctx: PlatformContext,
    text: string
  ): Promise<MessageHandle> {
    const thread = await this.getThread(ctx);
    const msg = await thread.send(text);
    return { id: msg.id };
  }

  async updateMessage(
    ctx: PlatformContext,
    handle: MessageHandle,
    text: string
  ): Promise<void> {
    try {
      const thread = await this.getThread(ctx);
      const msg = await thread.messages.fetch(handle.id);
      await msg.edit(text);
    } catch (err) {
      console.error(
        "[DiscordPlatform] Failed to update message:",
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
    const thread = await this.getThread(ctx);
    const inputSummary = JSON.stringify(toolInput, null, 2).slice(0, 600);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve::${approvalKey}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`deny::${approvalKey}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await thread.send({
      content: `**Tool request:** \`${toolName}\`\n\`\`\`json\n${inputSummary}\n\`\`\``,
      components: [row],
    });
    return { id: msg.id };
  }

  async dismissApprovalRequest(
    ctx: PlatformContext,
    handle: MessageHandle,
    outcome: { approved: boolean; toolName: string }
  ): Promise<void> {
    try {
      const thread = await this.getThread(ctx);
      const msg = await thread.messages.fetch(handle.id);
      await msg.delete();
    } catch {
      // If delete fails, try to edit away the buttons
      try {
        const thread = await this.getThread(ctx);
        const msg = await thread.messages.fetch(handle.id);
        const label = outcome.approved ? "allowed" : "denied";
        await msg.edit({
          content: `\`${outcome.toolName}\` — ${label}`,
          components: [],
        });
      } catch {}
    }
  }

  formatText(markdown: string): string {
    return mdToDiscord(markdown);
  }

  private async getThread(ctx: PlatformContext): Promise<TextChannel> {
    // threadId may refer to either a thread or a channel
    const channel =
      this.client.channels.cache.get(ctx.threadId) ??
      this.client.channels.cache.get(ctx.channelId);
    if (!channel || !("send" in channel)) {
      throw new Error(`Channel not found: ${ctx.channelId}/${ctx.threadId}`);
    }
    return channel as TextChannel;
  }
}
