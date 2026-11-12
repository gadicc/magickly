import { z } from "zod";
import type { AnswerItem } from "./answer.ts";

/**
 * Reading a model's reply. Every request asks the model to end its reply with
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

/** One answer item, as `answer.ts` defines it; null optional fields allowed. */
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

export const answerSchema = z.object({ items: z.array(answerItemSchema) });

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

/** A translation reply's items, with undefined fields left out. */
export function parseAnswer(text: string): Parsed<AnswerItem[]> {
  const parsed = parseReply(text, answerSchema, mendAnswer);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    coercions: parsed.coercions ?? 0,
    value: parsed.value.items.map((item) => {
      const out: AnswerItem = {
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
