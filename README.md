# claude-chat

Chat with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) from Slack, Discord, or Telegram. Powered by the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk).

Claude Code runs locally on your machine. This project bridges its capabilities to your favorite chat platforms, with streaming responses, multi-turn conversations, and a tool approval UI.

## Features

- **Multi-platform** — Slack, Discord, and Telegram (run one or all simultaneously)
- **Streaming** — Claude's responses update in real-time as tokens arrive
- **Tool approval** — Claude asks for permission before running tools (Bash, Edit, etc.) via interactive buttons
- **Auto-approve** — Configure read-only tools (Read, Grep, Glob) to skip manual approval
- **Session management** — Each thread is an independent Claude session with full conversation history
- **Resume** — Sessions persist across messages; Claude remembers the full context within a thread

## Prerequisites

- **Node.js** >= 18
- **Claude Code CLI** installed and logged in (`npm install -g @anthropic-ai/claude-code`)
- A bot token for at least one platform (Slack, Discord, or Telegram)

## Quick Start

```bash
git clone <repo-url> claude-chat
cd claude-chat
npm install
cp .env.example .env
# Edit .env with your bot tokens
npm run dev
```

## Configuration

All configuration is via environment variables (or `.env` file). At least one platform must be configured.

### Platform Tokens

| Variable | Required | Description |
|---|---|---|
| `SLACK_BOT_TOKEN` | For Slack | Bot token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | For Slack | App-level token for Socket Mode (`xapp-...`) |
| `SLACK_SIGNING_SECRET` | For Slack | Signing secret |
| `DISCORD_BOT_TOKEN` | For Discord | Bot token |
| `TELEGRAM_BOT_TOKEN` | For Telegram | Bot token from @BotFather |

### General Settings

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_WORKING_DIR` | `/tmp/claude-workspace` | Default working directory for Claude sessions |
| `SESSION_TIMEOUT_MS` | `1800000` (30 min) | Idle sessions are cleaned up after this duration |
| `STREAM_DEBOUNCE_MS` | `1500` | Debounce interval for streaming message updates |
| `MAX_SLACK_MESSAGE_LENGTH` | `3000` | Truncate messages beyond this length |
| `AUTO_APPROVE_TOOLS` | (empty) | Comma-separated tool names to auto-approve (e.g. `Read,Grep,Glob`) |

## Platform Setup

### Slack

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable **Socket Mode** (generates `SLACK_APP_TOKEN`)
3. Add Bot Token Scopes: `chat:write`, `channels:history`, `groups:history`, `im:history`, `mpim:history`
4. Subscribe to bot events: `message.channels`, `message.groups`, `message.im`, `message.mpim`
5. Install the app to your workspace (generates `SLACK_BOT_TOKEN`)
6. Copy `SLACK_SIGNING_SECRET` from Basic Information

### Discord

1. Create an app at [discord.com/developers/applications](https://discord.com/developers/applications)
2. Go to Bot settings, enable **Message Content Intent**
3. Copy the bot token
4. Invite the bot to your server with permissions: Send Messages, Read Message History, Manage Messages
5. Mention the bot (`@YourBot your question`) or talk to it in a thread

### Telegram

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Create a new bot with `/newbot`
3. Copy the bot token
4. Start a chat with your bot and send messages directly

## Usage

### Chatting

Just send a message in a channel where the bot is present:

- **Slack** — Send any message in a channel/DM; each thread becomes a session
- **Discord** — Mention the bot (`@Bot your question`) or reply in an active thread
- **Telegram** — Send a message directly to the bot

### Commands

| Command | Description |
|---|---|
| `/cd <path>` | Change the working directory for the current session |
| `/claude-reset` | Reset the current session (clear conversation history) |

### Tool Approval

When Claude wants to run a tool (e.g. write a file, execute a shell command), it posts a message with **Approve** / **Deny** buttons. Click to allow or block the action.

To skip approval for safe tools, set:

```
AUTO_APPROVE_TOOLS=Read,Grep,Glob,LS
```

Supports wildcards: `Bash*` matches all Bash-related tools.

## Architecture

```
src/
├── platform/Platform.ts        — Abstract interface for chat platforms
├── core/
│   ├── Session.ts              — Claude SDK query lifecycle (platform-agnostic)
│   ├── SessionManager.ts       — Session registry + expiry cleanup
│   └── StreamingUpdater.ts     — Debounced message streaming
├── approval/
│   ├── ApprovalGate.ts         — Promise-based pause/resume for tool approval
│   └── AutoApprovePolicy.ts    — Rule engine for auto-approving tools
├── slack/                      — Slack adapter (Bolt + Socket Mode)
├── discord/                    — Discord adapter (discord.js)
├── telegram/                   — Telegram adapter (Telegraf)
├── config.ts                   — Environment variable loading
└── index.ts                    — Entry point (starts enabled platforms)
```

## Development

```bash
npm run dev      # Watch mode with hot reload
npm run build    # Compile TypeScript
npm start        # Run compiled output
```

## License

MIT
