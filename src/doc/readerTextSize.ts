/**
 * The ritual reader's text size (plan 089, deferred item 3), shared by the
 * `<head>` script that applies it before the first paint and the reader's
 * hook (`useReaderTextSize`) that changes it. Not a client module: the
 * server document inlines the script.
 */

export const READER_TEXT_SIZE_KEY = "magickli:reader-text-size:v1";
/** The custom property on `<html>` the reader's font size reads. */
export const READER_TEXT_SIZE_PROPERTY = "--reader-text-size";
/** The reader's text size, in percent, without a choice of the reader's. */
export const READER_TEXT_SIZE_DEFAULT = 100;
/** The smallest and largest text size the controls go to, in percent. */
export const READER_TEXT_SIZE_RANGE = [50, 300] as const;
/** The reader's font size: the chosen size, or the default before any. */
export const READER_FONT_SIZE = `var(${READER_TEXT_SIZE_PROPERTY}, ${READER_TEXT_SIZE_DEFAULT}%)`;

/** A size within the range, in whole percent; anything else is the default. */
export function clampTextSize(size: number) {
  if (!Number.isFinite(size)) return READER_TEXT_SIZE_DEFAULT;
  const [min, max] = READER_TEXT_SIZE_RANGE;
  return Math.min(max, Math.max(min, Math.round(size)));
}

const [MIN, MAX] = READER_TEXT_SIZE_RANGE;
/**
 * Sets the stored size on `<html>` before the server-rendered ritual is
 * painted, so a reader who chose one sees no reflow on hydration, and the
 * browser restores a reload's scroll position against the right layout.
 * The clamp is `clampTextSize`'s; a missing or unreadable value sets
 * nothing, and blocked storage is ignored.
 */
export const readerTextSizeScript = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  READER_TEXT_SIZE_KEY,
)});if(s===null)return;var n=Math.round(Number(s));if(!isFinite(n))return;document.documentElement.style.setProperty(${JSON.stringify(
  READER_TEXT_SIZE_PROPERTY,
)},Math.min(${MAX},Math.max(${MIN},n))+"%")}catch(e){}})()`;
