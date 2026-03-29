import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ClaudeSession {
  sessionId: string;
  pid: number;
  cwd: string;
  startedAt: number;
  name?: string;
  active: boolean;
}

const CLI_SESSIONS_DIR = join(homedir(), ".claude", "sessions");

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * List available Claude Code CLI sessions from ~/.claude/sessions/.
 * These are only active terminal sessions (CLI deletes the file on exit).
 */
export async function listClaudeSessions(): Promise<ClaudeSession[]> {
  let files: string[];
  try {
    files = await readdir(CLI_SESSIONS_DIR);
  } catch {
    return [];
  }

  const sessions: ClaudeSession[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(CLI_SESSIONS_DIR, file), "utf-8");
      const data = JSON.parse(raw);
      if (data.sessionId) {
        const pid = data.pid ?? 0;
        sessions.push({
          sessionId: data.sessionId,
          pid,
          cwd: data.cwd ?? "unknown",
          startedAt: data.startedAt ?? 0,
          name: data.name,
          active: pid > 0 && isProcessAlive(pid),
        });
      }
    } catch {
      // skip malformed files
    }
  }

  // Sort by most recent first
  sessions.sort((a, b) => b.startedAt - a.startedAt);
  return sessions;
}

/**
 * Format sessions list as a readable string.
 */
export function formatSessionList(sessions: ClaudeSession[]): string {
  if (sessions.length === 0) return "No active Claude Code sessions found.";

  return sessions
    .map((s) => {
      const date = new Date(s.startedAt).toLocaleString();
      const name = s.name ? ` (${s.name})` : "";
      const shortId = s.sessionId.slice(0, 8);
      const status = s.active ? " 🟢" : "";
      return `\`${shortId}\`${name}${status} — ${s.cwd} — ${date}`;
    })
    .join("\n");
}
