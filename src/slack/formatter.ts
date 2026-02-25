/**
 * Convert Markdown to Slack mrkdwn format.
 * Slack uses its own subset of markdown with different syntax.
 */
export function mdToSlack(text: string): string {
  return text
    // Headings: # Heading → *Heading*
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
    // Bold: **text** or __text__ → *text*
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "*$1*")
    // Strikethrough: ~~text~~ → ~text~
    .replace(/~~(.+?)~~/g, "~$1~")
    // Links: [text](url) → <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>")
    // Unordered lists: - item or * item → • item
    .replace(/^[ \t]*[-*]\s+/gm, "• ")
    // Ordered lists: 1. item → 1. item (keep as-is, Slack renders ok)
    // Code blocks: keep triple backticks (Slack supports them)
    // Horizontal rules: --- → just remove
    .replace(/^---+$/gm, "")
    // Trim trailing whitespace per line
    .replace(/[ \t]+$/gm, "")
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
