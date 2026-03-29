import type { App } from "@slack/bolt";
import type { SessionManager } from "../../core/SessionManager";
import { ACTION_APPROVE, ACTION_DENY } from "../../types/index";
import type { ApprovalActionMetadata } from "../../types/index";

/**
 * Handles Approve/Deny button clicks from tool approval prompts.
 * Parses the metadata from the button value and resolves the pending ApprovalGate.
 */
export function registerActionHandler(
  app: App,
  sessionManager: SessionManager
): void {
  app.action(ACTION_APPROVE, async ({ ack, body }) => {
    await ack();

    const meta = parseMetadata(body);
    if (!meta) return;

    const session = sessionManager.get({
      channelId: meta.channelId,
      threadId: meta.threadTs,
    });
    if (!session) return;

    const found = session.resolveApproval(meta.approvalKey, true);
    if (!found) {
      console.warn(
        "[action] Approval key not found (already resolved?):",
        meta.approvalKey
      );
    }
  });

  app.action(ACTION_DENY, async ({ ack, body }) => {
    await ack();

    const meta = parseMetadata(body);
    if (!meta) return;

    const session = sessionManager.get({
      channelId: meta.channelId,
      threadId: meta.threadTs,
    });
    if (!session) return;

    const found = session.resolveApproval(meta.approvalKey, false);
    if (!found) {
      console.warn(
        "[action] Approval key not found (already resolved?):",
        meta.approvalKey
      );
    }
  });
}

function parseMetadata(body: unknown): ApprovalActionMetadata | null {
  try {
    const actions = (body as { actions?: Array<{ value?: string }> }).actions;
    const value = actions?.[0]?.value;
    if (!value) return null;
    return JSON.parse(value) as ApprovalActionMetadata;
  } catch {
    return null;
  }
}
