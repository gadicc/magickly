/**
 * A CSS string of `text`, quoted, with its quotes, backslashes and line
 * breaks escaped, so a URL cannot end the `url()` early.
 */
export function cssString(text: string): string {
  return `"${text.replace(/["\\\n\r\f]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `)}"`;
}
