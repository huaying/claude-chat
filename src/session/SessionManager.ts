import type { WebClient } from "@slack/web-api";
import { Session } from "./Session";
import type { AppConfig } from "../types/index";

/**
 * Registry mapping "channelId::threadTs" → Session.
 * Handles creation, retrieval, timeout cleanup, and destruction.
 */
export class SessionManager {
  private sessions = new Map<string, Session>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    private readonly config: AppConfig,
    private readonly client: WebClient
  ) {
    // Prune expired sessions every 5 minutes
    this.cleanupInterval = setInterval(
      () => void this.pruneExpired(),
      5 * 60 * 1000
    );
  }

  getOrCreate(channelId: string, threadTs: string): Session {
    const key = this.key(channelId, threadTs);
    if (!this.sessions.has(key)) {
      this.sessions.set(
        key,
        new Session(channelId, threadTs, this.config, this.client)
      );
    }
    return this.sessions.get(key)!;
  }

  get(channelId: string, threadTs: string): Session | undefined {
    return this.sessions.get(this.key(channelId, threadTs));
  }

  async destroy(channelId: string, threadTs: string): Promise<void> {
    const key = this.key(channelId, threadTs);
    const session = this.sessions.get(key);
    if (session) {
      await session.destroy();
      this.sessions.delete(key);
    }
  }

  dispose(): void {
    clearInterval(this.cleanupInterval);
  }

  private key(channelId: string, threadTs: string): string {
    return `${channelId}::${threadTs}`;
  }

  private async pruneExpired(): Promise<void> {
    const now = Date.now();
    for (const [key, session] of this.sessions) {
      const idle = now - session.state.lastActivityAt.getTime();
      if (idle > this.config.session.timeoutMs) {
        console.log(`[SessionManager] Pruning expired session: ${key}`);
        await session.destroy();
        this.sessions.delete(key);
      }
    }
  }
}
