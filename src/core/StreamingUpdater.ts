import type { Platform, PlatformContext, MessageHandle } from "../platform/Platform";

/**
 * Platform-agnostic streaming message updater with debouncing.
 *
 * Chat platforms typically rate-limit message updates (~1/sec).
 * Claude streams tokens much faster. This class batches updates
 * and only flushes after a quiet period.
 */
export class StreamingUpdater {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingText: string | null = null;
  private pendingHandle: MessageHandle | null = null;

  constructor(
    private readonly platform: Platform,
    private readonly ctx: PlatformContext,
    private readonly debounceMs: number,
    private readonly maxLength: number
  ) {}

  /**
   * Called frequently as Claude streams text.
   * Updates are debounced to avoid platform rate limits.
   */
  update(handle: MessageHandle, fullText: string): void {
    this.pendingText = this.truncate(this.platform.formatText(fullText));
    this.pendingHandle = handle;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      void this.flush();
    }, this.debounceMs);
  }

  /**
   * Called when Claude finishes. Cancels the debounce and posts immediately.
   */
  async finalize(handle: MessageHandle, finalText: string): Promise<void> {
    this.cancelDebounce();
    const text = this.truncate(this.platform.formatText(finalText)) || "_done_";
    await this.platform.updateMessage(this.ctx, handle, text);
  }

  async finalizeWithError(handle: MessageHandle, error: string): Promise<void> {
    this.cancelDebounce();
    await this.platform.updateMessage(this.ctx, handle, `Error: ${error}`);
  }

  async flush(): Promise<void> {
    this.debounceTimer = null;
    if (this.pendingHandle && this.pendingText !== null) {
      const handle = this.pendingHandle;
      const text = this.pendingText + " _…_";
      this.pendingText = null;
      this.pendingHandle = null;
      await this.platform.updateMessage(this.ctx, handle, text);
    }
  }

  private cancelDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingText = null;
    this.pendingHandle = null;
  }

  private truncate(text: string): string {
    if (text.length <= this.maxLength) return text;
    return text.slice(0, this.maxLength - 3) + "…";
  }
}
