import { z } from "zod";
import type { AppConfig } from "./types/index";

const EnvSchema = z.object({
  SLACK_BOT_TOKEN: z.string().min(1, "SLACK_BOT_TOKEN is required"),
  SLACK_APP_TOKEN: z.string().min(1, "SLACK_APP_TOKEN is required"),
  SLACK_SIGNING_SECRET: z.string().min(1, "SLACK_SIGNING_SECRET is required"),
  DEFAULT_WORKING_DIR: z.string().default("/tmp/claude-workspace"),
  SESSION_TIMEOUT_MS: z.coerce.number().default(1_800_000),
  STREAM_DEBOUNCE_MS: z.coerce.number().default(1_500),
  MAX_SLACK_MESSAGE_LENGTH: z.coerce.number().default(3_000),
});

export function loadConfig(): AppConfig {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map((e) => `  ${e.path.join(".")}: ${e.message}`).join("\n");
    throw new Error(`Configuration error:\n${errors}\n\nCopy .env.example to .env and fill in the values.`);
  }

  const env = result.data;
  return {
    slack: {
      botToken: env.SLACK_BOT_TOKEN,
      appToken: env.SLACK_APP_TOKEN,
      signingSecret: env.SLACK_SIGNING_SECRET,
    },
    claude: {
      defaultWorkingDir: env.DEFAULT_WORKING_DIR,
    },
    session: { timeoutMs: env.SESSION_TIMEOUT_MS },
    streaming: {
      debounceMs: env.STREAM_DEBOUNCE_MS,
      maxMessageLength: env.MAX_SLACK_MESSAGE_LENGTH,
    },
  };
}
