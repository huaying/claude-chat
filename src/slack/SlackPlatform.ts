import type { WebClient } from "@slack/web-api";
import type {
  Platform,
  PlatformContext,
  MessageHandle,
} from "../platform/Platform";
import { buildApprovalBlocks } from "./blocks";
import { mdToSlack } from "./formatter";

export class SlackPlatform implements Platform {
  constructor(
    private readonly client: WebClient,
    public readonly maxMessageLength: number
  ) {}

  async postMessage(
    ctx: PlatformContext,
    text: string
  ): Promise<MessageHandle> {
    const result = await this.client.chat.postMessage({
      channel: ctx.channelId,
      thread_ts: ctx.threadId,
      text,
    });
    return { id: result.ts! };
  }

  async updateMessage(
    ctx: PlatformContext,
    handle: MessageHandle,
    text: string
  ): Promise<void> {
    try {
      await this.client.chat.update({
        channel: ctx.channelId,
        ts: handle.id,
        text,
        blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
      });
    } catch (err) {
      console.error(
        "[SlackPlatform] Failed to update message:",
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
    const result = await this.client.chat.postMessage({
      channel: ctx.channelId,
      thread_ts: ctx.threadId,
      blocks: buildApprovalBlocks(
        toolName,
        toolInput,
        ctx.channelId,
        ctx.threadId,
        approvalKey
      ) as any[],
      text: `Claude wants to run: ${toolName}`,
    });
    return { id: result.ts! };
  }

  async dismissApprovalRequest(
    ctx: PlatformContext,
    handle: MessageHandle,
    outcome: { approved: boolean; toolName: string }
  ): Promise<void> {
    try {
      await this.client.chat.delete({
        channel: ctx.channelId,
        ts: handle.id,
      });
    } catch {
      const label = outcome.approved ? "allowed" : "denied";
      await this.client.chat
        .update({
          channel: ctx.channelId,
          ts: handle.id,
          text: `\`${outcome.toolName}\` — ${label}`,
          blocks: [],
        })
        .catch((err) => {
          console.error("[SlackPlatform] Failed to dismiss approval:", (err as Error).message);
        });
    }
  }

  formatText(markdown: string): string {
    return mdToSlack(markdown);
  }
}
