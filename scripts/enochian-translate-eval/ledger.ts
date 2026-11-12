import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  type Effort,
  MAX_OUTPUT_TOKENS,
  OUTPUT_ALLOWANCE,
  type RequestKind,
} from "./models.ts";

/**
 * What the experiment spends (plan 077, "Models and budget"): the gateway's
 * public prices, each call's cost, an append-only ledger, and the checks that
 * keep a run inside its budget and the experiment inside its cap.
 */

/** The whole experiment's cap, in US dollars. The only place it is set. */
export const EXPERIMENT_CAP_USD = 100;

/** The gateway's public price list; needs no key. */
export const PRICES_URL = "https://ai-gateway.vercel.sh/v1/models";

/** How a request is sent: one call at a time, or in a batch at half price. */
export type TransportName = "sync" | "batch";

/** A price tier: `cost` per token from `min` input tokens up to `max`. */
export interface PriceTier {
  cost: string;
  min: number;
  max?: number;
}

/** A model's prices as the list gives them: USD per token, as decimals. */
export interface Pricing {
  input: string;
  output: string;
  input_cache_read?: string;
  input_cache_write?: string;
  input_tiers?: PriceTier[];
  output_tiers?: PriceTier[];
  input_cache_read_tiers?: PriceTier[];
  input_cache_write_tiers?: PriceTier[];
}

/** Prices by gateway model id ("anthropic/claude-opus-5.5-batch" included). */
export type PriceList = Record<string, Pricing>;

/** The list's row for a model sent by a transport: batch has its own. */
export function priceRow(
  prices: PriceList,
  model: string,
  transport: TransportName,
): Pricing {
  const id = transport === "batch" ? `${model}-batch` : model;
  const row = prices[id];
  if (!row) throw new Error(`The gateway's price list has no ${id}`);
  return row;
}

/**
 * Fetches the price list and keeps only the given models and their batch
 * rows. The caller saves it in the run's directory, so a run's estimates can
 * be redone with the prices it ran under.
 */
export async function fetchPrices(
  models: readonly string[],
  fetcher: typeof fetch = fetch,
): Promise<PriceList> {
  const response = await fetcher(PRICES_URL);
  if (!response.ok)
    throw new Error(`${PRICES_URL}: ${response.status} ${response.statusText}`);
  const body = (await response.json()) as {
    data: { id: string; pricing?: Pricing }[];
  };
  const wanted = new Set(models.flatMap((one) => [one, `${one}-batch`]));
  const out: PriceList = {};
  for (const model of body.data)
    if (wanted.has(model.id) && model.pricing) out[model.id] = model.pricing;
  for (const one of models)
    if (!out[one]) throw new Error(`The gateway's price list has no ${one}`);
  return out;
}

/** Token counts as the ledger keeps them. */
export interface Tokens {
  /** All input tokens, cached or not. */
  input: number;
  /** Input tokens read from the cache. */
  cached: number;
  /** Input tokens written to the cache. */
  cacheWrite: number;
  /** All output tokens, thinking included. */
  output: number;
  /** The thinking part of `output`, where reported. */
  reasoning: number;
}

export const NO_TOKENS: Tokens = {
  input: 0,
  cached: 0,
  cacheWrite: 0,
  output: 0,
  reasoning: 0,
};

/** The per-token price that applies, by tier when the list has tiers. */
function rate(
  flat: string | undefined,
  tiers: PriceTier[] | undefined,
  inputTokens: number,
): number {
  const tier = tiers?.find(
    (one) =>
      inputTokens >= one.min &&
      (one.max === undefined || inputTokens < one.max),
  );
  return Number(tier?.cost ?? flat ?? 0);
}

/**
 * A call's cost from its tokens and the list's prices: uncached input at the
 * input price, cache reads and writes at theirs (the input price where the
 * list has none), output at the output price.
 */
export function estimateCost(tokens: Tokens, price: Pricing): number {
  const n = tokens.input;
  const input = rate(price.input, price.input_tiers, n);
  const read = price.input_cache_read
    ? rate(price.input_cache_read, price.input_cache_read_tiers, n)
    : input;
  const write = price.input_cache_write
    ? rate(price.input_cache_write, price.input_cache_write_tiers, n)
    : input;
  const output = rate(price.output, price.output_tiers, n);
  const plain = Math.max(0, n - tokens.cached - tokens.cacheWrite);
  return (
    plain * input +
    tokens.cached * read +
    tokens.cacheWrite * write +
    tokens.output * output
  );
}

/**
 * A call's cost: the gateway's own figure (`providerMetadata.gateway.cost`, a
 * decimal string) when it gave one, exact; else estimated from the tokens.
 */
export function costOf(
  gatewayCost: unknown,
  tokens: Tokens,
  price: Pricing,
): { cost: number; exact: boolean } {
  const exact =
    typeof gatewayCost === "string" || typeof gatewayCost === "number"
      ? Number(gatewayCost)
      : Number.NaN;
  if (Number.isFinite(exact)) return { cost: exact, exact: true };
  return { cost: estimateCost(tokens, price), exact: false };
}

/**
 * Characters per token assumed before a run has measured any: on the high
 * side, as Enochian and tab-separated tables tokenise worse than prose.
 * Measured figures (`Calibration`) only ever lower it.
 */
export const CHARS_PER_TOKEN = 1.8;

/** Roughly how many tokens a prompt is, before sending it. */
export function estimateTokens(
  chars: number,
  charsPerToken = CHARS_PER_TOKEN,
): number {
  return Math.ceil(chars / Math.min(charsPerToken, CHARS_PER_TOKEN));
}

/**
 * The smallest characters per input token seen so far, by kind of prompt
 * (`<out>/calibration.json`): "translate" (with context), "translate-A0",
 * "judge" and "probe".
 */
export type Calibration = Record<string, number>;

/** What the budget is told about a request before it runs. */
export interface Projectable {
  kind: RequestKind;
  effort: Effort;
  chars: number;
  /** Measured characters per token for its kind of prompt, if any. */
  charsPerToken?: number;
}

/**
 * A request's input cost: its estimated tokens, priced as a cache write
 * where the call asks for caching (sync), since the first call with a given
 * prefix writes it.
 */
function inputCost(request: Projectable, price: Pricing, caching: boolean) {
  const input = estimateTokens(request.chars, request.charsPerToken);
  return estimateCost(
    caching && price.input_cache_write
      ? { ...NO_TOKENS, input, cacheWrite: input }
      : { ...NO_TOKENS, input },
    price,
  );
}

/**
 * What a request is expected to cost: its input and the expected output for
 * its kind and effort (`OUTPUT_ALLOWANCE`).
 */
export function projectCost(
  request: Projectable,
  price: Pricing,
  caching = false,
): number {
  return (
    inputCost(request, price, caching) +
    estimateCost(
      { ...NO_TOKENS, output: OUTPUT_ALLOWANCE[request.kind][request.effort] },
      price,
    )
  );
}

/**
 * The most a request can cost: its input and the most output it may produce
 * (`MAX_OUTPUT_TOKENS`). What a batch reserves, and what a sync call holds
 * while it runs.
 */
export function worstCost(
  request: Projectable,
  price: Pricing,
  caching = false,
): number {
  return (
    inputCost(request, price, caching) +
    estimateCost(
      {
        ...NO_TOKENS,
        output: MAX_OUTPUT_TOKENS[request.kind][request.effort],
      },
      price,
    )
  );
}

/** One line of the ledger. */
export interface LedgerEntry {
  /** Unique, so a later reconciliation can name the entry it corrects. */
  id: string;
  at: string;
  run: string;
  request: string;
  model: string;
  transport: TransportName;
  tokens: Tokens;
  cost: number;
  /** The gateway's figure, or an estimate from the price list. */
  exact: boolean;
  /**
   * A failed call whose cost isn't known: booked at its worst case until
   * `spent --reconcile` finds the real cost by `generationId`.
   */
  unknown?: boolean;
  generationId?: string;
  /** Set when the request failed (it may still have cost something). */
  failed?: boolean;
  /** Set when the request was a `--retry-failed` re-run. */
  retry?: number;
  /**
   * A correction of an earlier entry (by its `id`): `cost` is the real cost
   * less what was booked.
   */
  reconciles?: string;
  /**
   * A sync call's hold: its worst case, booked before it is launched, so a
   * crash or Ctrl-C leaves it booked. Settled by the line that `settles` it.
   */
  hold?: boolean;
  /** Settles a hold (by its `id`): `cost` is the call's cost less the hold. */
  settles?: string;
  /** The call's own cost, on a settling line. */
  actual?: number;
  /** A note: the generation id a held call reported (by the hold's `id`). */
  holdFor?: string;
}

/** The ledger: one JSON line per call, appended, never rewritten. */
export class Ledger {
  constructor(readonly path: string) {}

  entries(): LedgerEntry[] {
    if (!existsSync(this.path)) return [];
    return readFileSync(this.path, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LedgerEntry);
  }

  append(entry: LedgerEntry) {
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, `${JSON.stringify(entry)}\n`);
  }

  /** Everything spent, by every run. */
  total(): number {
    return this.entries().reduce((sum, one) => sum + one.cost, 0);
  }
}

/**
 * Entries whose cost isn't known and not yet reconciled: a failed call booked
 * at its worst case, or a hold never settled (a crash or Ctrl-C). Each with
 * what is booked for it and the generation id to look it up by, if any.
 */
export function unreconciled(entries: readonly LedgerEntry[]): (LedgerEntry & {
  booked: number;
  lookup?: string;
})[] {
  const done = new Set(entries.map((one) => one.reconciles).filter(Boolean));
  const settled = new Map(
    entries.filter((one) => one.settles).map((one) => [one.settles, one]),
  );
  const holds = new Map(
    entries.filter((one) => one.hold).map((one) => [one.id, one]),
  );
  const noted = new Map(
    entries
      .filter((one) => one.holdFor && one.generationId)
      .map((one) => [one.holdFor, one.generationId]),
  );
  const out: (LedgerEntry & { booked: number; lookup?: string })[] = [];
  for (const one of entries) {
    if (done.has(one.id)) continue;
    if (one.hold && !settled.has(one.id))
      out.push({ ...one, booked: one.cost, lookup: noted.get(one.id) });
    else if (one.unknown && !one.hold) {
      const hold = one.settles ? holds.get(one.settles) : undefined;
      out.push({
        ...one,
        booked: one.cost + (hold?.cost ?? 0),
        lookup: one.generationId ?? noted.get(one.settles ?? ""),
      });
    }
  }
  return out;
}

/** Whether an entry is a call's own line (not a hold, note or correction). */
const isCall = (one: LedgerEntry) =>
  !one.hold && !one.reconciles && !one.holdFor;

/** Totals by model and by run, for `spent`. */
export function ledgerTotals(entries: readonly LedgerEntry[]) {
  const open = unreconciled(entries);
  const unknownBy = new Map(open.map((one) => [one.id, one.booked]));
  const by = (key: (one: LedgerEntry) => string) => {
    const out: Record<
      string,
      { calls: number; cost: number; estimated: number; unknown: number }
    > = {};
    for (const one of entries) {
      const row = (out[key(one)] ??= {
        calls: 0,
        cost: 0,
        estimated: 0,
        unknown: 0,
      });
      if (isCall(one)) row.calls++;
      row.cost += one.cost;
      if (isCall(one) && !one.exact && !one.unknown)
        row.estimated += one.actual ?? one.cost;
      row.unknown += unknownBy.get(one.id) ?? 0;
    }
    return out;
  };
  return {
    total: entries.reduce((sum, one) => sum + one.cost, 0),
    /** Booked at worst case, awaiting reconciliation. */
    unknown: open.reduce((sum, one) => sum + one.booked, 0),
    byModel: by((one) => one.model),
    byRun: by((one) => one.run),
  };
}

/** What the check before a run weighs. */
export interface BudgetCheck {
  /** Spent so far by every run, with batches not yet collected reserved. */
  spent: number;
  /** What the run is checked at: expected (sync) or worst case (batch). */
  projection: number;
  /** This run's `--budget`. */
  budget: number;
  cap?: number;
  /** What the projection is called in the reason. */
  what?: string;
}

/**
 * Why a run may not start, or `undefined` when it may: it would take the
 * experiment past its cap, or its projection is more than its budget.
 */
export function refusal(check: BudgetCheck): string | undefined {
  const cap = check.cap ?? EXPERIMENT_CAP_USD;
  const what = check.what ?? "projected";
  const usd = (x: number) => `$${x.toFixed(2)}`;
  if (!(check.budget > 0)) return "--budget must be a positive number of USD";
  if (check.spent + check.projection > cap)
    return `spent ${usd(check.spent)} + ${what} ${usd(check.projection)} would pass the experiment's cap of ${usd(cap)}`;
  if (check.projection > check.budget)
    return `${what} ${usd(check.projection)} is more than --budget ${usd(check.budget)}`;
  return undefined;
}

/**
 * Whether a sync run may launch a call whose worst case is `next`: only if
 * what this run has spent, what its calls in flight hold (each its worst
 * case) and `next` fit both in its budget and in what is left of the cap.
 */
export function mayLaunch(state: {
  /** Spent before this run, batch reservations included. */
  spentBefore: number;
  spentThisRun: number;
  inFlight: number;
  next: number;
  budget: number;
  cap?: number;
}): boolean {
  const cap = state.cap ?? EXPERIMENT_CAP_USD;
  const held = state.spentThisRun + state.inFlight + state.next;
  return held <= state.budget && state.spentBefore + held <= cap;
}
