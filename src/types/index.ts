import type { PlatformContext, MessageHandle } from "../platform/Platform";
import type { AutoApproveConfig } from "../approval/AutoApprovePolicy";

// ─── Session ────────────────────────────────────────────────────────────────

export interface SessionState {
  ctx: PlatformContext;
  claudeSessionId: string | null;
  workingDir: string;
  createdAt: Date;
  lastActivityAt: Date;
  status: SessionStatus;
  activeMessageHandle: MessageHandle | null;
  activeMessageText: string;
}

export type SessionStatus =
  | "idle"
  | "thinking"
  | "awaiting_approval"
  | "error"
  | "destroyed";

// ─── Tool Approval ──────────────────────────────────────────────────────────

export interface ApprovalDecision {
  approved: boolean;
  reason?: string;
}

export interface PendingApproval {
  resolve: (decision: ApprovalDecision) => void;
  reject: (reason: unknown) => void;
}

// action_id constants used in Slack Block Kit buttons
export const ACTION_APPROVE = "tool_approval_approve";
export const ACTION_DENY = "tool_approval_deny";

// Metadata embedded in button value to route action back to the correct session
export interface ApprovalActionMetadata {
  channelId: string;
  threadTs: string;
  approvalKey: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

export interface SlackConfig {
  botToken: string;
  appToken: string;
  signingSecret: string;
}

export interface DiscordConfig {
  botToken: string;
}

export interface TelegramConfig {
  botToken: string;
}

export interface AppConfig {
  platforms: {
    slack?: SlackConfig;
    discord?: DiscordConfig;
    telegram?: TelegramConfig;
  };
  claude: {
    defaultWorkingDir: string;
  };
  streaming: {
    debounceMs: number;
    maxMessageLength: {
      slack: number;
      discord: number;
      telegram: number;
    };
  };
  autoApprove: AutoApproveConfig;
}
