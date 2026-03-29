/**
 * Converts markdown to Telegram HTML format.
 * Telegram's HTML mode supports: <b>, <i>, <code>, <pre>, <a>, <s>, <u>.
 */
export function mdToTelegramHTML(markdown: string): string {
  let text = markdown;

  // Escape HTML entities first (except in code blocks)
  // We'll handle code blocks separately
  const codeBlocks: string[] = [];

  // Extract code blocks
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Extract inline code
  const inlineCode: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    inlineCode.push(code);
    return `__INLINE_CODE_${inlineCode.length - 1}__`;
  });

  // Escape HTML in the remaining text
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  text = text.replace(/__(.+?)__(?!CODE|INLINE)/g, "<b>$1</b>");

  // Italic: *text* or _text_
  text = text.replace(/\*(.+?)\*/g, "<i>$1</i>");
  text = text.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<i>$1</i>");

  // Strikethrough: ~~text~~
  text = text.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Headers: # text → bold
  text = text.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");

  // Restore inline code
  inlineCode.forEach((code, i) => {
    text = text.replace(`__INLINE_CODE_${i}__`, `<code>${escapeHTML(code)}</code>`);
  });

  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    const match = block.match(/```(\w+)?\n?([\s\S]*?)```/);
    const lang = match?.[1] ?? "";
    const code = match?.[2] ?? "";
    const langAttr = lang ? ` class="language-${lang}"` : "";
    text = text.replace(
      `__CODE_BLOCK_${i}__`,
      `<pre><code${langAttr}>${escapeHTML(code.trimEnd())}</code></pre>`
    );
  });

  // Collapse excessive blank lines
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
