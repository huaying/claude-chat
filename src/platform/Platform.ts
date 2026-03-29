// ─── Platform Abstraction ──────────────────────────────────────────────────
// Session talks to this interface instead of any specific chat platform SDK.

export interface PlatformContext {
  channelId: string;
  threadId: string;
}

export interface MessageHandle {
  id: string;
}

export interface Platform {
  /** Post a new message in the conversation thread. */
  postMessage(ctx: PlatformContext, text: string): Promise<MessageHandle>;

  /** Update an existing message (used for streaming). */
  updateMessage(
    ctx: PlatformContext,
    handle: MessageHandle,
    text: string
  ): Promise<void>;

  /** Post an approval prompt with approve/deny actions. */
  postApprovalRequest(
    ctx: PlatformContext,
    toolName: string,
    toolInput: Record<string, unknown>,
    approvalKey: string
  ): Promise<MessageHandle>;

  /** Remove or collapse an approval message after the user responds. */
  dismissApprovalRequest(
    ctx: PlatformContext,
    handle: MessageHandle,
    outcome: { approved: boolean; toolName: string }
  ): Promise<void>;

  /** Convert markdown to platform-native rich text format. */
  formatText(markdown: string): string;
}
