import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKMessage,
  PermissionResult,
} from "@anthropic-ai/claude-agent-sdk";
import type { Platform, PlatformContext } from "../platform/Platform";
import { ApprovalGate } from "../approval/ApprovalGate";
import { AutoApprovePolicy } from "../approval/AutoApprovePolicy";
import { StreamingUpdater } from "./StreamingUpdater";
import type { SessionState, AppConfig } from "../types/index";

export class Session {
  public state: SessionState;
  private abortController: AbortController | null = null;
  private approvalGate: ApprovalGate;
  private updater: StreamingUpdater;

  constructor(
    ctx: PlatformContext,
    private readonly config: AppConfig,
    private readonly platform: Platform,
    private readonly autoApprovePolicy: AutoApprovePolicy
  ) {
    this.state = {
      ctx,
      claudeSessionId: null,
      workingDir: config.claude.defaultWorkingDir,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      status: "idle",
      activeMessageHandle: null,
      activeMessageText: "",
    };
    this.approvalGate = new ApprovalGate();
    this.updater = new StreamingUpdater(
      platform,
      ctx,
      config.streaming.debounceMs,
      config.streaming.maxMessageLength
    );
  }

  /**
   * Handle a user message from the chat platform.
   * Runs a Claude query and streams results back.
   */
  async handleUserMessage(text: string): Promise<void> {
    if (this.state.status === "awaiting_approval") {
      await this.platform.postMessage(
        this.state.ctx,
        "Please approve or deny the pending tool request first."
      );
      return;
    }

    if (this.state.status === "thinking") {
      await this.platform.postMessage(
        this.state.ctx,
        "Claude is still working on the previous request."
      );
      return;
    }

    this.state.lastActivityAt = new Date();
    this.state.status = "thinking";
    this.state.activeMessageText = "";
    this.abortController = new AbortController();

    // Post an initial placeholder message that we'll update as Claude streams
    const handle = await this.platform.postMessage(
      this.state.ctx,
      "_thinking…_"
    );
    this.state.activeMessageHandle = handle;

    try {
      console.log(`[Session] Running query: "${text.slice(0, 80)}"`);
      await this.runQuery(text);
      console.log(`[Session] Query finished`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Session] Query error:`, msg);
      if (this.state.activeMessageHandle) {
        await this.updater.finalizeWithError(
          this.state.activeMessageHandle,
          msg
        );
      }
      this.state.status = "error";
      return;
    }

    this.state.status = "idle";
  }

  /**
   * Resolve a pending tool approval from a button click.
   */
  resolveApproval(approvalKey: string, approved: boolean): boolean {
    return this.approvalGate.resolve(approvalKey, {
      approved,
      reason: approved ? undefined : "Denied by user",
    });
  }

  /**
   * Change the working directory for this session.
   */
  setWorkingDir(newDir: string): void {
    this.state.workingDir = newDir;
  }

  async destroy(): Promise<void> {
    this.abortController?.abort();
    this.approvalGate.rejectAll("Session destroyed");
    await this.updater.flush();
    this.state.status = "destroyed";
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async runQuery(prompt: string): Promise<void> {
    const resumeOpts = this.state.claudeSessionId
      ? { resume: this.state.claudeSessionId }
      : {};

    // Remove CLAUDECODE env var so the SDK can launch inside an existing Claude Code session
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (k !== "CLAUDECODE" && v !== undefined) env[k] = v;
    }

    for await (const event of query({
      prompt,
      options: {
        abortController: this.abortController!,
        cwd: this.state.workingDir,
        permissionMode: "default",
        env,
        stderr: (data: string) => console.error("[claude stderr]", data),
        canUseTool: (toolName, input, { signal }) =>
          this.requestToolApproval(toolName, input, signal),
        ...resumeOpts,
      },
    })) {
      console.log(
        `[Session] event: ${event.type}${"subtype" in event ? "/" + event.subtype : ""}`
      );
      await this.handleEvent(event);
    }
  }

  private async handleEvent(event: SDKMessage): Promise<void> {
    this.state.lastActivityAt = new Date();

    switch (event.type) {
      case "system":
        if (event.subtype === "init") {
          this.state.claudeSessionId = event.session_id;
        }
        break;

      case "assistant": {
        const text = (
          event.message.content as Array<{ type: string; text?: string }>
        )
          .filter((b) => b.type === "text" && typeof b.text === "string")
          .map((b) => b.text as string)
          .join("");

        if (text && this.state.activeMessageHandle) {
          this.state.activeMessageText += text;
          this.updater.update(
            this.state.activeMessageHandle,
            this.state.activeMessageText
          );
        }
        break;
      }

      case "result": {
        if (!this.state.activeMessageHandle) break;

        if (event.subtype === "success") {
          const finalText = event.result || this.state.activeMessageText;
          console.log(
            `[Session] result/success: result.length=${event.result.length}, accumulated.length=${this.state.activeMessageText.length}, using.length=${finalText.length}`
          );
          await this.updater.finalize(
            this.state.activeMessageHandle,
            finalText
          );
          // Post cost/turn footnote
          const cost = event.total_cost_usd.toFixed(4);
          await this.platform.postMessage(
            this.state.ctx,
            `_Cost: $${cost} | Turns: ${event.num_turns}_`
          );
        } else {
          const errors =
            "errors" in event ? event.errors.join("; ") : event.subtype;
          await this.updater.finalizeWithError(
            this.state.activeMessageHandle,
            errors
          );
        }
        break;
      }
    }
  }

  /**
   * Intercepts tool calls. Checks auto-approve policy first,
   * then falls through to human approval via the platform UI.
   */
  private async requestToolApproval(
    toolName: string,
    input: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<PermissionResult> {
    // Auto-approve if policy allows
    if (this.autoApprovePolicy.shouldAutoApprove(toolName)) {
      console.log(`[Session] Auto-approved tool: ${toolName}`);
      return { behavior: "allow", updatedInput: input };
    }

    this.state.status = "awaiting_approval";

    // Unique key for this approval request
    const approvalKey = `${this.state.ctx.threadId}::${Date.now()}`;

    const approvalHandle = await this.platform.postApprovalRequest(
      this.state.ctx,
      toolName,
      input,
      approvalKey
    );

    try {
      // Block here until the user clicks a button
      const decision = await this.approvalGate.wait(approvalKey, signal);

      // Dismiss the approval message
      await this.platform.dismissApprovalRequest(
        this.state.ctx,
        approvalHandle,
        { approved: decision.approved, toolName }
      );

      this.state.status = "thinking";

      if (decision.approved) {
        return { behavior: "allow", updatedInput: input };
      } else {
        return {
          behavior: "deny",
          message: decision.reason ?? "Denied by user",
        };
      }
    } catch {
      this.state.status = "thinking";
      return { behavior: "deny", message: "Session aborted" };
    }
  }
}
