import { z } from "zod";
import type { ReadingItem } from "./item.ts";

/**
 * Reading a model's reply (plan 077, and plan 081's reading, which moved
 * this here from the experiment's scripts in step 2D). Every request asks the model to end its reply with
 * one fenced json block: forced tool calls don't combine with Anthropic's
 * thinking, and batch requests have no structured-output option. The last
 * such block is parsed and validated; anything else is a failure, recorded
 * and counted against the model, never retried away.
 */

/** The text of the last fenced json block in a reply, if any. */
export function lastJsonBlock(text: string): string | undefined {
  const blocks = [...text.matchAll(/```json[^\S\n]*\n([\s\S]*?)\n?```/gi)];
  return blocks.at(-1)?.[1];
}

/** A parsed reply, or why it couldn't be. */
export type Parsed<T> =
  | { ok: true; value: T; coercions?: number }
  | { ok: false; error: string };

/**
 * Parses and validates the last json block against a schema. `prepare` may
 * mend minor slips in the parsed JSON first, counting what it mended.
 */
export function parseReply<T>(
  text: string,
  schema: z.ZodType<T>,
  prepare?: (value: unknown) => number,
): Parsed<T> {
  const block = lastJsonBlock(text);
  if (block === undefined)
    return { ok: false, error: "no ```json block in the reply" };
  let value: unknown;
  try {
    value = JSON.parse(block);
  } catch (error) {
    return { ok: false, error: `invalid JSON: ${(error as Error).message}` };
  }
  const coercions = prepare?.(value) ?? 0;
  const result = schema.safeParse(value);
  if (!result.success)
    return {
      ok: false,
      error: `does not match the schema: ${z.prettifyError(result.error)}`,
    };
  return { ok: true, value: result.data, coercions };
}

const optionalText = z
  .string()
  .nullish()
  .transform((one) => one ?? undefined);

const BASES = ["attested", "derived", "coined", "unknown"] as const;

/**
 * One answer item, as the experiment's `answer.ts` defines it (`ReplyItem`);
 * null optional fields allowed.
 */
export const answerItemSchema = z.object({
  source: z.string(),
  target: z.string(),
  basis: z.enum(BASES),
  ref: optionalText,
  row: optionalText,
  token: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((one) => one ?? undefined),
});

/**
 * A translation reply: its items and, from arm A3s's prompt on (plan 081,
 * S1), the whole passage read as plain English, in one or more sentences
 * (the "sentence" field, whatever its length). It is taken as it
 * comes and read apart (`parseSentence`), so a reply with none, or with one
 * that isn't a string, still gives its items: the bars score the items
 * alone.
 */
export const answerSchema = z.object({
  items: z.array(answerItemSchema),
  sentence: z.unknown().optional(),
});

/**
 * Mends the slips a reply may make without changing what it says: a token
 * written as a numeric string ("3"), and a basis in other case or with
 * spaces ("Attested"). Returns how many it mended; anything else is left
 * for the schema to reject.
 */
export function mendAnswer(value: unknown): number {
  const items = (value as { items?: unknown })?.items;
  if (!Array.isArray(items)) return 0;
  let mended = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const one = item as Record<string, unknown>;
    if (typeof one.token === "string" && /^\s*\d+\s*$/.test(one.token)) {
      one.token = Number(one.token);
      mended++;
    }
    if (typeof one.basis === "string") {
      const basis = one.basis.trim().toLowerCase();
      if (basis !== one.basis && (BASES as readonly string[]).includes(basis)) {
        one.basis = basis;
        mended++;
      }
    }
  }
  return mended;
}

/**
 * One item of a reply: the reading's item and, in the experiment's task 2,
 * the row it answers.
 */
export interface ReplyItem extends ReadingItem {
  /** The row id the item answers ("K.R"), when the input gives row ids. */
  row?: string;
}

/** A translation reply's items, with undefined fields left out. */
export function parseAnswer(text: string): Parsed<ReplyItem[]> {
  const parsed = parseReply(text, answerSchema, mendAnswer);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    coercions: parsed.coercions ?? 0,
    value: parsed.value.items.map((item) => {
      const out: ReplyItem = {
        source: item.source,
        target: item.target,
        basis: item.basis,
      };
      if (item.ref !== undefined) out.ref = item.ref;
      if (item.row !== undefined) out.row = item.row;
      if (item.token !== undefined) out.token = item.token;
      return out;
    }),
  };
}

/**
 * A reply's sentence (arm A3s): the "sentence" field of its last json block,
 * trimmed, when it is a non-empty string; otherwise none. Never fails a
 * reply: its items are read by `parseAnswer` either way.
 */
export function parseSentence(text: string): string | undefined {
  const parsed = parseReply(text, answerSchema, mendAnswer);
  if (!parsed.ok) return undefined;
  const sentence = parsed.value.sentence;
  return typeof sentence === "string" && sentence.trim()
    ? sentence.trim()
    : undefined;
}
