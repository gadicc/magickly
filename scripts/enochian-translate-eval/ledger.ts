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

/**
 * Plan 081's stage 2 (cheaper models on plan 077's tasks 1 and 2) books
 * into the same ledger, in the same output directory, since its runs reuse
 * the judges' verdict store and Opus's A0 and round-1 runs. It may add at
 * most `capUsd` to what the ledger held before `from`: plan 077's spend,
 * all of it booked by 13 November 2026.
 */
export const STAGE2 = {
  from: "2026-11-14T00:00:00.000Z",
  capUsd: 15,
} as const;

/**
 * The cap every check applies to the ledger's total: the experiment's,
 * lowered so that what is booked from `stage.from` on adds at most
 * `stage.capUsd` to what was booked before it. A late correction (a
 * `--reconcile` line, or the line settling a hold) counts on the date of the
 * entry it corrects (`bookedAt`), so a call booked before `stage.from` and
 * corrected after it stays before.
 */
export function ledgerCap(
  entries: readonly LedgerEntry[],
  stage: { from: string; capUsd: number } = STAGE2,
): { cap: number; before: number; since: number } {
  const at = bookedAt(entries);
  let before = 0;
  let since = 0;
  for (const one of entries)
    if (at(one) < stage.from) before += one.cost;
    else since += one.cost;
  return {
    cap: Math.min(EXPERIMENT_CAP_USD, before + stage.capUsd),
    before,
    since,
  };
}

/**
 * When an entry's cost counts as booked: a correction (`reconciles`) on the
 * date of the entry it corrects, a settling line (`settles`) on its hold's,
 * followed through chains (a reconciled settling line counts on the hold's
 * date); anything else, or a correction whose entry isn't in the ledger, on
 * its own.
 */
export function bookedAt(
  entries: readonly LedgerEntry[],
): (entry: LedgerEntry) => string {
  const byId = new Map(entries.map((one) => [one.id, one]));
  return (entry) => {
    let one = entry;
    const seen = new Set<string>();
    for (;;) {
      const next = byId.get(one.reconciles ?? one.settles ?? "");
      if (!next || seen.has(next.id)) return one.at;
      seen.add(next.id);
      one = next;
    }
  };
}

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

/**
 * Plan 077's prices (USD per million tokens, checked 11 November 2026), for
 * an offline projection only, where no saved price list has the model: input
 * and output as the plan gives them, a cache read at a twentieth of the input
 * price (as the plan says), a cache write at 1.25 times the input price for
 * Anthropic's models (as the saved list has it for Opus) and none for
 * OpenAI's, and batch at half of each.
 */
export const PLAN_PRICES: Readonly<
  Record<string, { input: number; output: number; cacheWrite?: number }>
> = {
  "anthropic/claude-opus-5.5": { input: 4, output: 20, cacheWrite: 5 },
  "anthropic/claude-fable-5.2": { input: 8, output: 40, cacheWrite: 10 },
  "anthropic/claude-sonnet-5.5": { input: 2, output: 10, cacheWrite: 2.5 },
  "openai/gpt-6.1-sol": { input: 2, output: 10 },
};

/**
 * Plan 081 stage 2's models as the gateway's public list gave them on
 * 15 November 2026 (`PRICES_URL`, base rates only: no regional, priority or
 * "fast" tiers), for an offline projection only. GPT-6.1 Terra and Gemini
 * 3.8 Flash have no batch rows, so they can't run by batch; Gemini lists no
 * cache write. Haiku's prices rise fivefold from 100,001 input tokens, and
 * the OpenAI models' from 272,001.
 */
export const LISTED_PRICES: Readonly<PriceList> = {
  "anthropic/claude-sonnet-5.5": {
    input: "0.000002",
    output: "0.00001",
    input_cache_read: "0.0000001",
    input_cache_write: "0.0000025",
  },
  "anthropic/claude-sonnet-5.5-batch": {
    input: "0.000001",
    output: "0.000005",
    input_cache_read: "0.00000005",
    input_cache_write: "0.00000125",
  },
  "anthropic/claude-haiku-5.5": {
    input: "0.0000001",
    output: "0.0000005",
    input_cache_read: "0.00000001",
    input_cache_write: "0.000000125",
    input_tiers: [
      { cost: "0.0000001", min: 0, max: 100001 },
      { cost: "0.0000005", min: 100001 },
    ],
    output_tiers: [
      { cost: "0.0000005", min: 0, max: 100001 },
      { cost: "0.0000025", min: 100001 },
    ],
    input_cache_read_tiers: [
      { cost: "0.00000001", min: 0, max: 100001 },
      { cost: "0.00000005", min: 100001 },
    ],
    input_cache_write_tiers: [
      { cost: "0.000000125", min: 0, max: 100001 },
      { cost: "0.000000625", min: 100001 },
    ],
  },
  "anthropic/claude-haiku-5.5-batch": {
    input: "0.00000005",
    output: "0.00000025",
    input_cache_read: "0.000000005",
    input_cache_write: "0.0000000625",
    input_tiers: [
      { cost: "0.00000005", min: 0, max: 100001 },
      { cost: "0.00000025", min: 100001 },
    ],
    output_tiers: [
      { cost: "0.00000025", min: 0, max: 100001 },
      { cost: "0.00000125", min: 100001 },
    ],
    input_cache_read_tiers: [
      { cost: "0.000000005", min: 0, max: 100001 },
      { cost: "0.000000025", min: 100001 },
    ],
    input_cache_write_tiers: [
      { cost: "0.0000000625", min: 0, max: 100001 },
      { cost: "0.0000003125", min: 100001 },
    ],
  },
  "openai/gpt-6.1-terra": {
    input: "0.000001",
    output: "0.000005",
    input_cache_read: "0.00000005",
    input_cache_write: "0.00000125",
    input_tiers: [
      { cost: "0.000001", min: 0, max: 272001 },
      { cost: "0.000002", min: 272001 },
    ],
    output_tiers: [
      { cost: "0.000005", min: 0, max: 272001 },
      { cost: "0.0000075", min: 272001 },
    ],
    input_cache_read_tiers: [
      { cost: "0.00000005", min: 0, max: 272001 },
      { cost: "0.0000001", min: 272001 },
    ],
    input_cache_write_tiers: [
      { cost: "0.00000125", min: 0, max: 272001 },
      { cost: "0.0000025", min: 272001 },
    ],
  },
  "openai/gpt-6-luna": {
    input: "0.0000001",
    output: "0.0000005",
    input_cache_read: "0.00000001",
    input_cache_write: "0.000000125",
    input_tiers: [
      { cost: "0.0000001", min: 0, max: 272001 },
      { cost: "0.0000002", min: 272001 },
    ],
    output_tiers: [
      { cost: "0.0000005", min: 0, max: 272001 },
      { cost: "0.00000075", min: 272001 },
    ],
    input_cache_read_tiers: [
      { cost: "0.00000001", min: 0, max: 272001 },
      { cost: "0.00000002", min: 272001 },
    ],
    input_cache_write_tiers: [
      { cost: "0.000000125", min: 0, max: 272001 },
      { cost: "0.00000025", min: 272001 },
    ],
  },
  "openai/gpt-6-luna-batch": {
    input: "0.00000005",
    output: "0.00000025",
    input_cache_read: "0.000000005",
    input_cache_write: "0.0000000625",
    input_tiers: [
      { cost: "0.00000005", min: 0, max: 272001 },
      { cost: "0.0000001", min: 272001 },
    ],
    output_tiers: [
      { cost: "0.00000025", min: 0, max: 272001 },
      { cost: "0.000000375", min: 272001 },
    ],
    input_cache_read_tiers: [
      { cost: "0.000000005", min: 0, max: 272001 },
      { cost: "0.00000001", min: 272001 },
    ],
    input_cache_write_tiers: [
      { cost: "0.0000000625", min: 0, max: 272001 },
      { cost: "0.000000125", min: 272001 },
    ],
  },
  "google/gemini-3.8-flash": {
    input: "0.00000075",
    output: "0.00000375",
    input_cache_read: "0.000000075",
  },
};

/**
 * Prices for an offline projection, as the gateway's list would give them:
 * `LISTED_PRICES` for a model it has (with its batch row where listed),
 * else `PLAN_PRICES` with batch rows at half.
 */
export function planPriceList(models: readonly string[]): PriceList {
  const out: PriceList = {};
  const perToken = (usd: number) => String(usd / 1e6);
  for (const model of models) {
    const listed = LISTED_PRICES[model];
    if (listed) {
      out[model] = listed;
      const batch = LISTED_PRICES[`${model}-batch`];
      if (batch) out[`${model}-batch`] = batch;
      continue;
    }
    const row = PLAN_PRICES[model];
    if (!row) throw new Error(`Plan 077 gives no price for ${model}`);
    for (const [id, scale] of [
      [model, 1],
      [`${model}-batch`, 0.5],
    ] as const)
      out[id] = {
        input: perToken(row.input * scale),
        output: perToken(row.output * scale),
        input_cache_read: perToken((row.input * scale) / 20),
        ...(row.cacheWrite
          ? { input_cache_write: perToken(row.cacheWrite * scale) }
          : {}),
      };
  }
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
 * A request's cost with `output` tokens out: its estimated input, priced as
 * a cache write where the call asks for caching (sync), since the first call
 * with a given prefix writes it. Input and output are priced together, so a
 * tiered price (Haiku's, fivefold from 100,001 input tokens) charges the
 * output at the tier its input falls in, as the provider does.
 */
function costWith(
  request: Projectable,
  price: Pricing,
  caching: boolean,
  output: number,
) {
  const input = estimateTokens(request.chars, request.charsPerToken);
  return estimateCost(
    caching && price.input_cache_write
      ? { ...NO_TOKENS, input, cacheWrite: input, output }
      : { ...NO_TOKENS, input, output },
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
  return costWith(
    request,
    price,
    caching,
    OUTPUT_ALLOWANCE[request.kind][request.effort],
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
  return costWith(
    request,
    price,
    caching,
    MAX_OUTPUT_TOKENS[request.kind][request.effort],
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

/** Calls' mean cost: how many, and their mean (none when there are none). */
export interface CallMean {
  calls: number;
  mean?: number;
}

/** What one group of calls cost (`callCosts`). */
export interface CallCosts {
  group: string;
  /** Every attempt, failed ones included. */
  calls: number;
  /** Their cost, corrections (`--reconcile`) included. */
  cost: number;
  /** The mean over every call: what a call cost on average, as run. */
  mean: number;
  /** Attempts that failed; counted in `calls` and `mean`, not below. */
  failed: number;
  /**
   * Replies that read nothing from the cache: the price of a call with a
   * cold cache, a first call's or one whose cache read missed.
   */
  cold: CallMean;
  /** Replies that read the shared prompt from the cache. */
  warm: CallMean & {
    /** The share of the warm replies' input that was read cached. */
    cachedShare: number;
  };
  /** Mean input and output tokens a reply. */
  input: number;
  output: number;
  /** The runs its calls came from, in the order first seen. */
  runs: string[];
}

/**
 * Calls by group (`groupOf` the entry), each attempt once at its own cost
 * with any correction of it added, split by whether the reply read the
 * cache: for plan 081's question of what a reading costs on each model, cold
 * and warm. A failed attempt counts in the mean over all calls but in
 * neither cold nor warm, since its tokens (none, or a cut-off reply's) say
 * nothing about the cache. A hold left unsettled (a crash) is no call.
 */
export function callCosts(
  entries: readonly LedgerEntry[],
  runs: readonly string[],
  groupOf: (entry: LedgerEntry) => string,
): CallCosts[] {
  const wanted = new Set(runs);
  const corrections = new Map<string, number>();
  for (const one of entries)
    if (one.reconciles)
      corrections.set(
        one.reconciles,
        (corrections.get(one.reconciles) ?? 0) + one.cost,
      );
  const out = new Map<string, LedgerEntry[]>();
  for (const one of entries)
    if (wanted.has(one.run) && isCall(one)) {
      const group = groupOf(one);
      out.set(group, [...(out.get(group) ?? []), one]);
    }
  // A call's own cost: a settling line's `actual` (its line books only the
  // difference from the hold), plus what `--reconcile` corrected.
  const cost = (one: LedgerEntry) =>
    (one.actual ?? one.cost) + (corrections.get(one.id) ?? 0);
  const sum = (list: LedgerEntry[], of: (one: LedgerEntry) => number) =>
    list.reduce((total, one) => total + of(one), 0);
  const mean = (list: LedgerEntry[]): CallMean =>
    list.length
      ? { calls: list.length, mean: sum(list, cost) / list.length }
      : { calls: 0 };
  return [...out].map(([group, calls]) => {
    const replies = calls.filter((one) => !one.failed);
    const warm = replies.filter((one) => one.tokens.cached > 0);
    const cold = replies.filter((one) => one.tokens.cached === 0);
    const warmInput = sum(warm, (one) => one.tokens.input);
    const total = sum(calls, cost);
    return {
      group,
      calls: calls.length,
      cost: total,
      mean: total / calls.length,
      failed: calls.length - replies.length,
      cold: mean(cold),
      warm: {
        ...mean(warm),
        cachedShare: warmInput
          ? sum(warm, (one) => one.tokens.cached) / warmInput
          : 0,
      },
      input: replies.length
        ? sum(replies, (one) => one.tokens.input) / replies.length
        : 0,
      output: replies.length
        ? sum(replies, (one) => one.tokens.output) / replies.length
        : 0,
      runs: [...new Set(calls.map((one) => one.run))],
    };
  });
}

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
