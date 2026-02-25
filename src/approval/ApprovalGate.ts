import type { ApprovalDecision, PendingApproval } from "../types/index";

/**
 * Promise registry that enables pausing Claude's async execution until
 * a user clicks Approve/Deny in Slack.
 *
 * Flow:
 *   1. Session.requestApproval() calls gate.wait(key, signal)
 *      → returns a Promise that suspends the Claude query loop
 *   2. Slack button click → action.handler calls gate.resolve(key, decision)
 *      → the Promise resolves, unblocking the query loop
 */
export class ApprovalGate {
  private pending = new Map<string, PendingApproval>();

  /**
   * Block until the user clicks Approve or Deny in Slack.
   * The AbortSignal allows cancelling if the session is destroyed.
   */
  wait(approvalKey: string, signal: AbortSignal): Promise<ApprovalDecision> {
    return new Promise<ApprovalDecision>((resolve, reject) => {
      this.pending.set(approvalKey, { resolve, reject });

      const onAbort = () => {
        this.pending.delete(approvalKey);
        reject(new Error("Session aborted"));
      };

      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  /**
   * Called by action.handler when user clicks Approve/Deny.
   * Returns true if the key was found (i.e., the approval was pending).
   */
  resolve(approvalKey: string, decision: ApprovalDecision): boolean {
    const entry = this.pending.get(approvalKey);
    if (!entry) return false;
    this.pending.delete(approvalKey);
    entry.resolve(decision);
    return true;
  }

  /**
   * Called during session cleanup to reject all pending approvals.
   */
  rejectAll(reason: string): void {
    for (const [, entry] of this.pending) {
      entry.reject(new Error(reason));
    }
    this.pending.clear();
  }

  get hasPending(): boolean {
    return this.pending.size > 0;
  }
}
