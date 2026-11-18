/**
 * What the paid run may spend (plan 081, S11): the model's price from
 * the Gateway's public listing, a conservative estimate refused above
 * the cap, and a loop that stops before any batch that could pass it.
 */

/** `run` refuses, and stops, past this (S11 expected under $0.10). */
export const CAP_USD = 0.25;

/**
 * The price recorded in plan 070 (Gateway listing, 9 November 2026), for
 * `estimate`, which makes no request: $0.20 per million input tokens.
 */
export const RECORDED_PRICE_PER_TOKEN = 0.2 / 1e6;

/**
 * A conservative token count for an input: one token per two bytes. The
 * spike's 6,416 inputs measured 4.2 bytes a token; the real run, 5.0.
 */
export const conservativeTokens = (input: string) =>
  Math.ceil(Buffer.byteLength(input) / 2);

/**
 * The model's price per input token from the Gateway's listing
 * (`/v1/models`); throws unless it is a positive number.
 */
export function listedPrice(listing: unknown, model: string): number {
  const data = (listing as { data?: unknown } | null)?.data;
  const entry = Array.isArray(data)
    ? (data as { id?: unknown; pricing?: { input?: unknown } }[]).find(
        (one) => one?.id === model,
      )
    : undefined;
  const price = Number(entry?.pricing?.input);
  if (!Number.isFinite(price) || price <= 0)
    throw new Error(`Cannot verify ${model}'s price; nothing was sent`);
  return price;
}

/** Throws when a conservative estimate is over the cap. */
export function refuseOverCap(estimateUsd: number, cap = CAP_USD): void {
  if (!(estimateUsd <= cap))
    throw new Error(
      `The conservative estimate $${estimateUsd.toFixed(4)} is over the $${cap.toFixed(2)} cap; nothing was sent`,
    );
}

/**
 * The tokens to count for a batch: the Gateway's reported count, or the
 * batch's conservative estimate when the reply has none, or not a
 * positive number. A batch of text can't cost no tokens, so a reported 0
 * is read as unknown, as a missing count is, and the running total is
 * never NaN.
 */
export function batchTokens(reported: unknown, conservative: number): number {
  return typeof reported === "number" &&
    Number.isFinite(reported) &&
    reported > 0
    ? reported
    : conservative;
}

/** What one embedding request gives back. */
export interface EmbedReply {
  embeddings: readonly (readonly number[])[];
  /** As the Gateway reports it; may be missing. */
  tokens?: unknown;
}

/**
 * Embeds `inputs` in batches through `embed`, stopping (by throwing)
 * before any batch whose conservative cost, added to what was counted
 * so far, would pass the cap; what earlier batches embedded has been
 * handed to `keep` by then.
 */
export async function embedWithinCap(options: {
  inputs: readonly string[];
  price: number;
  embed: (batch: string[]) => Promise<EmbedReply>;
  keep: (batch: string[], reply: EmbedReply, tokens: number) => void;
  batchSize?: number;
  cap?: number;
}): Promise<{ tokens: number; spent: number }> {
  const { inputs, price, embed, keep, batchSize = 64, cap = CAP_USD } = options;
  let tokens = 0;
  for (let at = 0; at < inputs.length; at += batchSize) {
    const batch = inputs.slice(at, at + batchSize);
    const conservative = batch.reduce(
      (n, one) => n + conservativeTokens(one),
      0,
    );
    if ((tokens + conservative) * price > cap)
      throw new Error(
        `Stopped before passing the $${cap.toFixed(2)} cap: $${(tokens * price).toFixed(4)} counted so far; the cache keeps what was embedded`,
      );
    const reply = await embed(batch);
    if (reply.embeddings.length !== batch.length)
      throw new Error("The reply has the wrong number of vectors");
    const counted = batchTokens(reply.tokens, conservative);
    tokens += counted;
    keep(batch, reply, counted);
  }
  return { tokens, spent: tokens * price };
}
