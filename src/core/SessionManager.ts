import type { Platform, PlatformContext } from "../platform/Platform";
import { Session } from "./Session";
import { AutoApprovePolicy } from "../approval/AutoApprovePolicy";
import type { AppConfig } from "../types/index";

/**
 * Registry mapping "channelId::threadId" → Session.
 * Each platform gets its own SessionManager instance.
 */
export class SessionManager {
  private sessions = new Map<string, Session>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    private readonly config: AppConfig,
    private readonly platform: Platform,
    private readonly autoApprovePolicy: AutoApprovePolicy
  ) {
    // Prune expired sessions every 5 minutes
    this.cleanupInterval = setInterval(
      () => void this.pruneExpired(),
      5 * 60 * 1000
    );
  }

  getOrCreate(ctx: PlatformContext): Session {
    const key = this.key(ctx);
    if (!this.sessions.has(key)) {
      this.sessions.set(
        key,
        new Session(ctx, this.config, this.platform, this.autoApprovePolicy)
      );
    }
    return this.sessions.get(key)!;
  }

  get(ctx: PlatformContext): Session | undefined {
    return this.sessions.get(this.key(ctx));
  }

  async destroy(ctx: PlatformContext): Promise<void> {
    const key = this.key(ctx);
    const session = this.sessions.get(key);
    if (session) {
      await session.destroy();
      this.sessions.delete(key);
    }
  }

  dispose(): void {
    clearInterval(this.cleanupInterval);
  }

  private key(ctx: PlatformContext): string {
    return `${ctx.channelId}::${ctx.threadId}`;
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
