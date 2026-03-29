import {
  Client,
  GatewayIntentBits,
  Events,
  type Interaction,
  type Message,
} from "discord.js";
import { DiscordPlatform } from "./DiscordPlatform";
import { SessionManager } from "../core/SessionManager";
import { AutoApprovePolicy } from "../approval/AutoApprovePolicy";
import type { AppConfig, DiscordConfig } from "../types/index";

export class DiscordBot {
  private client: Client;
  private sessionManager: SessionManager;

  constructor(discordConfig: DiscordConfig, appConfig: AppConfig) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    const platform = new DiscordPlatform(this.client);
    const autoApprovePolicy = new AutoApprovePolicy(appConfig.autoApprove);
    this.sessionManager = new SessionManager(
      appConfig,
      platform,
      autoApprovePolicy
    );

    this.client.on(Events.MessageCreate, (message: Message) => {
      void this.handleMessage(message);
    });

    this.client.on(Events.InteractionCreate, (interaction: Interaction) => {
      void this.handleInteraction(interaction);
    });

    // Store the token for start()
    this._token = discordConfig.botToken;
  }

  private _token: string;

  async start(): Promise<void> {
    await this.client.login(this._token);
    console.log("[Discord] Bot is running");
  }

  stop(): void {
    this.sessionManager.dispose();
    this.client.destroy();
  }

  private async handleMessage(message: Message): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return;
    const text = message.content?.trim();
    if (!text) return;

    // Don't respond unless the bot is mentioned or it's in a thread the bot is in
    if (
      !message.mentions.has(this.client.user!) &&
      !message.channel.isThread()
    ) {
      return;
    }

    // Strip bot mention from the text
    const cleanText = text
      .replace(new RegExp(`<@!?${this.client.user!.id}>`, "g"), "")
      .trim();
    if (!cleanText) return;

    const channelId = message.channel.isThread()
      ? message.channel.parentId ?? message.channelId
      : message.channelId;
    const threadId = message.channel.isThread()
      ? message.channelId
      : message.id; // top-level message starts a new "thread"

    const session = this.sessionManager.getOrCreate({ channelId, threadId });

    // Handle commands
    if (/^\/cd\s+(.+)$/i.test(cleanText)) {
      const newDir = cleanText.match(/^\/cd\s+(.+)$/i)![1].trim();
      const { existsSync } = await import("node:fs");
      if (!existsSync(newDir)) {
        await message.reply(`Directory not found: \`${newDir}\``);
        return;
      }
      session.setWorkingDir(newDir);
      await message.reply(`Working directory: \`${newDir}\``);
      return;
    }

    if (/^\/claude-reset$/i.test(cleanText)) {
      await this.sessionManager.destroy({ channelId, threadId });
      await message.reply("Session reset.");
      return;
    }

    void session.handleUserMessage(cleanText);
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    const isApprove = customId.startsWith("approve::");
    const isDeny = customId.startsWith("deny::");

    if (!isApprove && !isDeny) return;

    await interaction.deferUpdate();

    const approvalKey = customId.replace(/^(approve|deny)::/, "");

    // Find the session — the approval key starts with threadId
    const threadId = approvalKey.split("::")[0];
    const channelId =
      interaction.channel?.isThread()
        ? (interaction.channel.parentId ?? interaction.channelId)
        : interaction.channelId;

    const session = this.sessionManager.get({
      channelId,
      threadId,
    });
    if (!session) return;

    const found = session.resolveApproval(approvalKey, isApprove);
    if (!found) {
      console.warn(
        "[Discord] Approval key not found (already resolved?):",
        approvalKey
      );
    }
  }
}
