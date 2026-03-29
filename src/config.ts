import { z } from "zod";
import type { AppConfig } from "./types/index";

const EnvSchema = z.object({
  // Slack (optional — enabled when all three tokens are set)
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),

  // Discord (optional)
  DISCORD_BOT_TOKEN: z.string().optional(),

  // Telegram (optional)
  TELEGRAM_BOT_TOKEN: z.string().optional(),

  // Claude
  DEFAULT_WORKING_DIR: z.string().default("/tmp/claude-workspace"),

  // Session
  SESSION_TIMEOUT_MS: z.coerce.number().default(1_800_000),

  // Streaming
  STREAM_DEBOUNCE_MS: z.coerce.number().default(1_500),
  MAX_SLACK_MESSAGE_LENGTH: z.coerce.number().default(3_000),

  // Auto-approve
  AUTO_APPROVE_TOOLS: z.string().default(""),
});

export function loadConfig(): AppConfig {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(
      `Configuration error:\n${errors}\n\nCopy .env.example to .env and fill in the values.`
    );
  }

  const env = result.data;

  // At least one platform must be configured
  const hasSlack =
    !!env.SLACK_BOT_TOKEN &&
    !!env.SLACK_APP_TOKEN &&
    !!env.SLACK_SIGNING_SECRET;
  const hasDiscord = !!env.DISCORD_BOT_TOKEN;
  const hasTelegram = !!env.TELEGRAM_BOT_TOKEN;

  if (!hasSlack && !hasDiscord && !hasTelegram) {
    throw new Error(
      "No platform configured. Set SLACK_BOT_TOKEN/SLACK_APP_TOKEN/SLACK_SIGNING_SECRET, DISCORD_BOT_TOKEN, or TELEGRAM_BOT_TOKEN."
    );
  }

  // Parse auto-approve tools
  const autoApproveTools = env.AUTO_APPROVE_TOOLS
    ? env.AUTO_APPROVE_TOOLS.split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return {
    platforms: {
      slack: hasSlack
        ? {
            botToken: env.SLACK_BOT_TOKEN!,
            appToken: env.SLACK_APP_TOKEN!,
            signingSecret: env.SLACK_SIGNING_SECRET!,
          }
        : undefined,
      discord: hasDiscord
        ? { botToken: env.DISCORD_BOT_TOKEN! }
        : undefined,
      telegram: hasTelegram
        ? { botToken: env.TELEGRAM_BOT_TOKEN! }
        : undefined,
    },
    claude: {
      defaultWorkingDir: env.DEFAULT_WORKING_DIR,
    },
    session: { timeoutMs: env.SESSION_TIMEOUT_MS },
    streaming: {
      debounceMs: env.STREAM_DEBOUNCE_MS,
      maxMessageLength: env.MAX_SLACK_MESSAGE_LENGTH,
    },
    autoApprove: {
      enabled: autoApproveTools.length > 0,
      rules: autoApproveTools.map((tool) => ({ tool })),
    },
  };
}
