import { Fragment, type ReactNode } from "react";

/**
 * JSDoc as the explorer shows it: its paragraphs, with `code` spans and
 * *emphasis*. Nothing else of Markdown is used in the package's JSDoc.
 */
export function docInline(text: string): ReactNode[] {
  let offset = 0;
  return text.split(/(`[^`]+`|\*[^*\s][^*]*\*)/).map((part) => {
    // Each part keyed by where it starts in the text.
    const key = offset;
    offset += part.length;
    if (/^`.+`$/.test(part)) return <code key={key}>{part.slice(1, -1)}</code>;
    if (/^\*.+\*$/.test(part)) return <em key={key}>{part.slice(1, -1)}</em>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

/** A JSDoc text's paragraphs, each a `<p>`. */
export default function DocText({ text }: { text: string }) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((paragraph) => <p key={paragraph}>{docInline(paragraph)}</p>);
}
