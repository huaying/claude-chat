// ─── Session ────────────────────────────────────────────────────────────────

export interface SessionState {
  channelId: string;
  threadTs: string;
  claudeSessionId: string | null;
  workingDir: string;
  createdAt: Date;
  lastActivityAt: Date;
  status: SessionStatus;
  activeMessageTs: string | null;
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

export interface AppConfig {
  slack: {
    botToken: string;
    appToken: string;
    signingSecret: string;
  };
  claude: {
    defaultWorkingDir: string;
  };
  session: {
    timeoutMs: number;
  };
  streaming: {
    debounceMs: number;
    maxMessageLength: number;
  };
}
