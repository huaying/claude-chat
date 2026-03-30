import type { App } from "@slack/bolt";
import type { SessionManager } from "../../core/SessionManager";
import { listClaudeSessions, formatSessionList } from "../../core/sessions";

/**
 * Handles incoming Slack messages and routes them to Claude sessions.
 *
 * Commands use "!" prefix (Slack reserves "/" for its own slash commands).
 */
export function registerMessageHandler(
  app: App,
  sessionManager: SessionManager
): void {
  app.message(async ({ message, say }) => {
    // Ignore bot messages to prevent loops
    if (!("user" in message) || !message.user) return;
    if ("subtype" in message && message.subtype) return;

    const text = ("text" in message ? message.text : "") ?? "";
    if (!text.trim()) return;

    const channelId = message.channel;
    const threadId =
      "thread_ts" in message && message.thread_ts
        ? message.thread_ts
        : message.ts;

    // ── !cd <path> ──
    const cdMatch = text.match(/^!cd\s+(.+)$/i);
    if (cdMatch) {
      const newDir = cdMatch[1].trim();
      const { existsSync } = await import("node:fs");
      if (!existsSync(newDir)) {
        await say({ thread_ts: threadId, text: `Directory not found: \`${newDir}\`` });
        return;
      }
      const session = sessionManager.getOrCreate({ channelId, threadId });
      session.setWorkingDir(newDir);
      await say({ thread_ts: threadId, text: `Working directory: \`${newDir}\`` });
      return;
    }

    // ── !sessions ──
    if (/^!sessions$/i.test(text)) {
      const sessions = await listClaudeSessions();
      await say({ thread_ts: threadId, text: formatSessionList(sessions) });
      return;
    }

    // ── !resume <id> ──
    const resumeMatch = text.match(/^!resume\s+(.+)$/i);
    if (resumeMatch) {
      const input = resumeMatch[1].trim();
      const sessions = await listClaudeSessions();
      const match = sessions.find((s) => s.sessionId.startsWith(input));

      if (!match) {
        await say({
          thread_ts: threadId,
          text: `Session not found: \`${input}\`\nUse \`!sessions\` to list available sessions.`,
        });
        return;
      }

      const session = sessionManager.getOrCreate({ channelId, threadId });
      session.resumeSession(match.sessionId);
      session.setWorkingDir(match.cwd);

      const name = match.name ? ` (${match.name})` : "";
      await say({
        thread_ts: threadId,
        text: `Resumed session \`${match.sessionId.slice(0, 8)}\`${name}\nWorking dir: \`${match.cwd}\``,
      });
      return;
    }

    // ── !reset ──
    if (/^!reset$/i.test(text)) {
      await sessionManager.destroy({ channelId, threadId });
      await say({ thread_ts: threadId, text: "Session reset." });
      return;
    }

    // ── Send to Claude ──
    const session = sessionManager.getOrCreate({ channelId, threadId });
    void session.handleUserMessage(text);
  });
}
