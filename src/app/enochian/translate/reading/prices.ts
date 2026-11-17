/**
 * GPT-6.1 Terra's prices, which the reading's daily ceiling holds against
 * (plan 081, S4), in millionths of a US dollar a token.
 *
 * Source: Vercel AI Gateway's public model list
 * (https://ai-gateway.vercel.sh/v1/models), `openai/gpt-6.1-terra`, as read
 * on 15 November 2026 for plan 081's model test and recorded in the
 * experiment's `LISTED_PRICES` (a test holds the two equal). Base rates,
 * which apply below 272,001 input tokens; a reading's prompt is about
 * 52,000 to 82,000 (plan 081, "The model test's results").
 */
export const TERRA_MICRO_USD = {
  /** Input read uncached: $1 a million tokens. */
  input: 1,
  /** Input written to the cache: $1.25 a million. */
  cacheWrite: 1.25,
  /** Input read from the cache: $0.05 a million. */
  cacheRead: 0.05,
  /** Output, reasoning included: $5 a million. */
  output: 5,
} as const;

/** Below this many input tokens the base rates apply. */
export const TERRA_BASE_RATE_BELOW = 272_001;

/**
 * Characters a token, assumed on the high side for the hold, as the
 * experiment's projection assumes (`CHARS_PER_TOKEN`): Enochian and
 * tab-separated tables tokenise worse than prose.
 */
export const HOLD_CHARS_PER_TOKEN = 1.8;

/**
 * A call's worst case, held against the ceiling before it is made: its
 * prompt's characters as input at the dearer of the uncached and cache-write
 * rates (a cold call writes the cache), and its output cap at the output
 * rate, in whole millionths of a dollar, rounded up.
 */
export function worstCaseMicroUsd(
  promptChars: number,
  maxOutputTokens: number,
): number {
  const input = Math.ceil(promptChars / HOLD_CHARS_PER_TOKEN);
  const rate = Math.max(TERRA_MICRO_USD.input, TERRA_MICRO_USD.cacheWrite);
  return Math.ceil(input * rate + maxOutputTokens * TERRA_MICRO_USD.output);
}

/**
 * The cost the gateway reported for a call (`providerMetadata.gateway.cost`,
 * a decimal string of dollars), in whole millionths, if it gave a usable one.
 */
export function reportedMicroUsd(cost: unknown): number | undefined {
  const dollars =
    typeof cost === "string" && cost.trim()
      ? Number(cost)
      : typeof cost === "number"
        ? cost
        : Number.NaN;
  return Number.isFinite(dollars) && dollars >= 0
    ? Math.round(dollars * 1_000_000)
    : undefined;
}
