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

  // Streaming
  STREAM_DEBOUNCE_MS: z.coerce.number().default(1_500),
  MAX_MESSAGE_LENGTH_SLACK: z.coerce.number().default(3_000),
  MAX_MESSAGE_LENGTH_DISCORD: z.coerce.number().default(1_900),
  MAX_MESSAGE_LENGTH_TELEGRAM: z.coerce.number().default(4_000),

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
    streaming: {
      debounceMs: env.STREAM_DEBOUNCE_MS,
      maxMessageLength: {
        slack: env.MAX_MESSAGE_LENGTH_SLACK,
        discord: env.MAX_MESSAGE_LENGTH_DISCORD,
        telegram: env.MAX_MESSAGE_LENGTH_TELEGRAM,
      },
    },
    autoApprove: {
      enabled: autoApproveTools.length > 0,
      rules: autoApproveTools.map((tool) => ({ tool })),
    },
  };
}
