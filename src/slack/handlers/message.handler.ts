import type { App } from "@slack/bolt";
import type { SessionManager } from "../../core/SessionManager";

/**
 * Handles incoming Slack messages and routes them to Claude sessions.
 *
 * Thread logic:
 * - If the message is in a thread → use thread_ts as session key
 * - If the message is a top-level message → use message.ts as session key
 *   (starts a new session; replies will continue it via thread_ts)
 */
export function registerMessageHandler(
  app: App,
  sessionManager: SessionManager
): void {
  // Handle /cd command inline (message starting with /cd)
  app.message(/^\/cd\s+(.+)$/i, async ({ message, context, say }) => {
    if (!("user" in message) || !message.user) return; // Ignore bots

    const newDir = ((context.matches as RegExpMatchArray)?.[1] ?? "").trim();
    const channelId = message.channel;
    const threadId =
      "thread_ts" in message && message.thread_ts
        ? message.thread_ts
        : message.ts;

    const { existsSync } = await import("node:fs");
    if (!existsSync(newDir)) {
      await say({
        thread_ts: threadId,
        text: `Directory not found: \`${newDir}\``,
      });
      return;
    }

    const session = sessionManager.getOrCreate({ channelId, threadId });
    session.setWorkingDir(newDir);

    await say({
      thread_ts: threadId,
      text: `Working directory: \`${newDir}\``,
    });
  });

  // Handle /claude-reset command inline
  app.message(/^\/claude-reset$/i, async ({ message, say }) => {
    if (!("user" in message) || !message.user) return;

    const channelId = message.channel;
    const threadId =
      "thread_ts" in message && message.thread_ts
        ? message.thread_ts
        : message.ts;

    await sessionManager.destroy({ channelId, threadId });
    await say({
      thread_ts: threadId,
      text: "Session reset.",
    });
  });

  // Handle all other messages → send to Claude
  app.message(async ({ message }) => {
    // Ignore bot messages to prevent loops
    if (!("user" in message) || !message.user) return;
    if ("subtype" in message && message.subtype) return;

    const text = ("text" in message ? message.text : "") ?? "";
    if (!text.trim()) return;

    // Skip command messages (already handled above)
    if (/^\/cd\s/i.test(text) || /^\/claude-reset$/i.test(text)) return;

    const channelId = message.channel;
    const threadId =
      "thread_ts" in message && message.thread_ts
        ? message.thread_ts
        : message.ts;

    const session = sessionManager.getOrCreate({ channelId, threadId });

    // Run async without blocking Bolt's event handler
    void session.handleUserMessage(text);
  });
}
