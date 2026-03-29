/**
 * Discord uses standard markdown natively, so minimal conversion is needed.
 * This function handles edge cases where Claude's output might not render
 * correctly in Discord.
 */
export function mdToDiscord(markdown: string): string {
  // Discord supports most standard markdown out of the box.
  // Only trim excess blank lines.
  return markdown.replace(/\n{3,}/g, "\n\n").trim();
}
