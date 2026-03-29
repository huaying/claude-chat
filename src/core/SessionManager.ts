import type { Platform, PlatformContext } from "../platform/Platform";
import { Session } from "./Session";
import { AutoApprovePolicy } from "../approval/AutoApprovePolicy";
import type { AppConfig } from "../types/index";

/**
 * Registry mapping "channelId::threadId" → Session.
 * Sessions live for the lifetime of the process.
 */
export class SessionManager {
  private sessions = new Map<string, Session>();

  constructor(
    private readonly config: AppConfig,
    private readonly platform: Platform,
    private readonly autoApprovePolicy: AutoApprovePolicy
  ) {}

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
    // no-op, sessions cleaned up on process exit
  }

  private key(ctx: PlatformContext): string {
    return `${ctx.channelId}::${ctx.threadId}`;
  }
}
