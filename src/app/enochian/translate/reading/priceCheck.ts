import { TERRA_BASE_RATE_BELOW, TERRA_MICRO_USD } from "./prices.ts";
import { READING_MODEL } from "./prompt.ts";

/**
 * The daily check that the prices the ceiling's holds assume (`prices.ts`)
 * are still the Gateway's (plan 081, S10): its public model list, read by
 * the daily job, which fails loudly on any difference so the holds are
 * never quietly too small.
 */

/** Vercel AI Gateway's public model list, with each model's prices. */
export const MODEL_LIST_URL = "https://ai-gateway.vercel.sh/v1/models";

/** How long the check waits for the list. */
const TIMEOUT_MS = 10_000;

/** The check's outcome: the prices agree, differ (which), or can't be read. */
export type PriceCheck =
  | { state: "ok" }
  | { state: "drift"; drift: string[] }
  | { state: "unavailable"; error: string };

/**
 * A number as the list may give it: a number, or a numeric string
 * ("0.000001", "272001"); undefined for anything else.
 */
const numeric = (value: unknown) => {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
};

/** Dollars a token as listed, in millionths of a dollar. */
const micro = (usd: unknown) => {
  const dollars = numeric(usd);
  return dollars === undefined ? undefined : Math.round(dollars * 1e12) / 1e6;
};

/** Compares the reading model's listed prices with `TERRA_MICRO_USD`. */
export async function checkListedPrices(
  fetcher: typeof fetch = fetch,
): Promise<PriceCheck> {
  let body: unknown;
  try {
    const response = await fetcher(MODEL_LIST_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok)
      return { state: "unavailable", error: `HTTP ${response.status}` };
    body = await response.json();
  } catch (error) {
    return {
      state: "unavailable",
      error: error instanceof Error ? error.name : typeof error,
    };
  }
  const models = (body as { data?: unknown })?.data;
  const model = Array.isArray(models)
    ? (models as { id?: unknown; pricing?: Record<string, unknown> }[]).find(
        (one) => one?.id === READING_MODEL,
      )
    : undefined;
  if (!model?.pricing)
    return { state: "drift", drift: [`${READING_MODEL} not listed`] };
  const { pricing } = model;
  const drift: string[] = [];
  for (const [field, assumed] of [
    ["input", TERRA_MICRO_USD.input],
    ["output", TERRA_MICRO_USD.output],
    ["input_cache_read", TERRA_MICRO_USD.cacheRead],
    ["input_cache_write", TERRA_MICRO_USD.cacheWrite],
  ] as const) {
    const listed = micro(pricing[field]);
    if (listed !== assumed)
      drift.push(`${field}: listed ${listed ?? "none"}, assumed ${assumed}`);
  }
  const tiers = pricing.input_tiers;
  const listedMax = Array.isArray(tiers)
    ? (tiers[0] as { max?: unknown } | undefined)?.max
    : undefined;
  const first = numeric(listedMax);
  if (listedMax !== undefined && first !== TERRA_BASE_RATE_BELOW)
    drift.push(
      `input tier: listed below ${String(first ?? listedMax)}, assumed ${TERRA_BASE_RATE_BELOW}`,
    );
  return drift.length ? { state: "drift", drift } : { state: "ok" };
}
