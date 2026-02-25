import { ACTION_APPROVE, ACTION_DENY } from "../types/index";
import type { ApprovalActionMetadata } from "../types/index";

/**
 * Slack Block Kit builders for all UI components.
 */

export function buildThinkingBlocks(): object[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_Claude is thinking…_",
      },
    },
  ];
}

export function buildApprovalBlocks(
  toolName: string,
  toolInput: unknown,
  channelId: string,
  threadTs: string,
  approvalKey: string
): object[] {
  const metadata: ApprovalActionMetadata = { channelId, threadTs, approvalKey };
  const inputSummary = summarizeInput(toolInput);

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:hammer: *Claude wants to run \`${toolName}\`*\n\`\`\`${inputSummary}\`\`\``,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve", emoji: true },
          style: "primary",
          action_id: ACTION_APPROVE,
          value: JSON.stringify(metadata),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Deny", emoji: true },
          style: "danger",
          action_id: ACTION_DENY,
          value: JSON.stringify(metadata),
        },
      ],
    },
  ];
}

function summarizeInput(input: unknown): string {
  try {
    const raw = JSON.stringify(input, null, 2);
    return raw.length > 600 ? raw.slice(0, 597) + "…" : raw;
  } catch {
    return String(input);
  }
}
