import { normEnochian } from "./normalise.ts";

/**
 * One word of a model's reading, as plan 077's prompt asks for it ("What
 * each answer must look like") and plan 081's reading prompt keeps, and how
 * its `ref` is read. Shared by the experiment's checker (`answer.ts`) and
 * the reading's (`check.ts`), so both read a ref alike.
 */

/** How the model says it knows a word. */
export type Basis = "attested" | "derived" | "coined" | "unknown";

/** One word of a reading of Enochian into English. */
export interface ReadingItem {
  /** The word the model says it read, copied by the model. */
  source: string;
  /** Its English. */
  target: string;
  basis: Basis;
  /**
   * A dictionary headword or a Key row ("K.R") in the context; required for
   * "attested", else optional.
   */
  ref?: string;
  /** The input word it reads, numbered from 1 as the input numbers them. */
  token?: number;
}

/** A ref as read: a Key row, a headword, or neither. */
export type ParsedRef =
  | { kind: "row"; id: string }
  | { kind: "headword"; word: string }
  | { kind: "malformed" };

/**
 * Reads a ref in the forms a model is likely to write: "2.3", "Key 2.3",
 * "2.03", "Key 2, row 3", "2:3" for a row; "OL", "OL (dictionary)",
 * "dictionary: OL", "'OL'" for a headword. Anything else is malformed.
 */
export function parseRef(ref: string | undefined): ParsedRef {
  let text = (ref ?? "").trim().replace(/^['"‘“]+|['"’”]+$/g, "");
  const row = text.match(
    /^(?:key\s*)?(\d{1,2})\s*(?:[.:]|,?\s*row)\s*0*(\d{1,3})$/i,
  );
  if (row) return { kind: "row", id: `${Number(row[1])}.${Number(row[2])}` };
  text = text
    .replace(/^(?:dictionary|dict|entry|headword)\s*[:\s]\s*/i, "")
    .replace(/\s*[([](?:dictionary|dict|entry|headword|WE|EMPM)[)\]]\s*$/i, "")
    .trim()
    .replace(/^['"‘“]+|['"’”]+$/g, "");
  if (/^[A-Za-z][A-Za-z\- ()]*$/.test(text) && normEnochian(text))
    return { kind: "headword", word: text };
  return { kind: "malformed" };
}
