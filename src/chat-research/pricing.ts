/** Inactive fixed-model pricing observations and exact request quotes. No key, private upload, activation or provider generation. */
import "server-only";
import { createHash } from "node:crypto";
import { is, sql } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { parseBoundedResearchJson } from "./boundedJson";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline,
} from "./boundedWork";
import type { ResearchAnswerJobOptions, ResearchJobQuote } from "./coordinator";
import {
  RESEARCH_MODEL_ID,
  RESEARCH_OUTPUT_TOKEN_LIMIT,
  RESEARCH_REQUEST_BYTE_LIMIT,
} from "./modelRequest";
import {
  inspectResearchRequestArtifact,
  type PreparedResearchRequestArtifact,
} from "./requestArtifact";
import {
  createSqlResearchAdmission,
  type ResearchAccountingScope,
  type ResearchAccountingStorage,
  type ResearchAdmissionDatabase,
} from "./sqlAdmission";
export const RESEARCH_PRICE_ERROR = "Private research quote unavailable";
export const RESEARCH_PRICE_CATALOG_URL =
  "https://ai-gateway.vercel.sh/v1/models";
export const RESEARCH_PRICE_BYTE_LIMIT = 2 * 1024 * 1024;
export const RESEARCH_PRICE_MAX_CHUNKS = 8192;
export const RESEARCH_PRICE_LIFETIME_MS = 60000;
/** Canonical full pricing object observed2026-11-10; see the historical public pricing-fact fixture. Any pricing-contract drift refuses a quote. */
export const RESEARCH_PRICE_PROFILE_SHA256 =
  "bfd8167e1e476848a4027c9680f8fe9a5243c96b67bec1384ba4b3589749cc99";
export const RESEARCH_INPUT_PICO_PER_TOKEN = 2750000;
export const RESEARCH_OUTPUT_PICO_PER_TOKEN = 11000000;
export const RESEARCH_INPUT_TOKEN_OVERHEAD = 2048;
const fail = (): never => {
  throw Error(RESEARCH_PRICE_ERROR);
};
const sha = (b: string | Uint8Array) =>
  createHash("sha256").update(b).digest("hex");
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return fail();
  return v as Record<string, unknown>;
};
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
    );
  return v;
}
/** Data-only public facts. This parser never produces a fresh network/clock/quote handle. */
export interface ResearchCatalogPriceFacts {
  readonly catalog_sha256: string;
  readonly pricing_profile_sha256: string;
  readonly model: typeof RESEARCH_MODEL_ID;
  readonly context_window: number;
  readonly max_output_tokens: number;
}
/** Accept bounded unambiguous bytes for the controlled model and frozen default/cache/regional pricing contract only. */
export function parseResearchPriceCatalog(
  bytes: Uint8Array,
): ResearchCatalogPriceFacts {
  try {
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength === 0 ||
      bytes.byteLength > RESEARCH_PRICE_BYTE_LIMIT
    )
      fail();
    const owned = Uint8Array.from(bytes),
      root = object(
        parseBoundedResearchJson(
          new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
            owned,
          ),
          RESEARCH_PRICE_BYTE_LIMIT,
        ),
      );
    if (
      !Array.isArray(root.data) ||
      root.data.length === 0 ||
      root.data.length > 4096
    )
      fail();
    const models = (root.data as unknown[])
      .map(object)
      .filter((m) => m.id === RESEARCH_MODEL_ID);
    if (models.length !== 1) fail();
    const model = models[0],
      pricing = object(model.pricing),
      profile = sha(JSON.stringify(canonical(pricing))),
      context = model.context_window,
      maximum = model.max_tokens;
    if (
      profile !== RESEARCH_PRICE_PROFILE_SHA256 ||
      typeof context !== "number" ||
      !Number.isSafeInteger(context) ||
      context <
        RESEARCH_REQUEST_BYTE_LIMIT +
          RESEARCH_INPUT_TOKEN_OVERHEAD +
          RESEARCH_OUTPUT_TOKEN_LIMIT ||
      typeof maximum !== "number" ||
      !Number.isSafeInteger(maximum) ||
      maximum < RESEARCH_OUTPUT_TOKEN_LIMIT
    )
      return fail();
    return {
      catalog_sha256: sha(owned),
      pricing_profile_sha256: profile,
      model: RESEARCH_MODEL_ID,
      context_window: context,
      max_output_tokens: maximum,
    };
  } catch {
    return fail();
  }
}
/** Opaque local fresh public HTTP observation; parsed/cached JSON cannot recreate it. */
export interface ResearchPriceObservation {
  readonly revision: string;
}
const observations = new WeakMap<
  object,
  { facts: ResearchCatalogPriceFacts; deadline: number }
>();
function discard(response: Response | undefined) {
  try {
    if (response?.body && !response.body.locked)
      void response.body.cancel().catch(() => {});
  } catch {}
}
/** One credential-free GET to a literal public endpoint, clean EOF and owned bytes. Trusted test fetch only; no retries. */
export function createResearchPriceObserver(
  config: { requestFetch?: typeof fetch } = {},
) {
  const requestFetch =
    config.requestFetch === undefined ? globalThis.fetch : config.requestFetch;
  if (typeof requestFetch !== "function") fail();
  return async (signal: AbortSignal): Promise<ResearchPriceObservation> => {
    const before = performance.now();
    let response: Response | undefined,
      reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const facts = await withinResearchDeadline(signal, async (combined) => {
        response = await requestFetch(RESEARCH_PRICE_CATALOG_URL, {
          method: "GET",
          redirect: "error",
          cache: "no-store",
          credentials: "omit",
          referrerPolicy: "no-referrer",
          headers: { accept: "application/json", "cache-control": "no-cache" },
          signal: combined,
        });
        if (combined.aborted) {
          discard(response);
          fail();
        }
        if (
          response.status !== 200 ||
          response.redirected ||
          response.bodyUsed ||
          response.body?.locked ||
          (response.url !== "" &&
            response.url !== RESEARCH_PRICE_CATALOG_URL) ||
          response.headers
            .get("content-type")
            ?.split(";")[0]
            .trim()
            .toLowerCase() !== "application/json" ||
          !response.body
        )
          return fail();
        reader = response.body.getReader();
        const ownedReader = reader,
          chunks: Uint8Array[] = [];
        let bytes = 0,
          count = 0;
        while (true) {
          combined.throwIfAborted();
          const { done, value } = await ownedReader.read();
          combined.throwIfAborted();
          if (done) break;
          if (
            !(value instanceof Uint8Array) ||
            ++count > RESEARCH_PRICE_MAX_CHUNKS
          )
            fail();
          bytes += value.byteLength;
          if (bytes > RESEARCH_PRICE_BYTE_LIMIT) fail();
          chunks.push(Uint8Array.from(value));
        }
        return parseResearchPriceCatalog(Buffer.concat(chunks));
      });
      const deadline = before + RESEARCH_PRICE_LIFETIME_MS;
      if (performance.now() >= deadline) fail();
      const handle = Object.freeze({
        revision: sha(
          JSON.stringify([
            "research-public-price-observation-v1",
            facts,
            before,
            deadline,
          ]),
        ),
      });
      observations.set(handle, { facts, deadline });
      return handle;
    } catch {
      return fail();
    } finally {
      if (reader) {
        try {
          void reader.cancel().catch(() => {});
        } catch {}
        try {
          reader.releaseLock();
        } catch {}
      } else discard(response);
    }
  };
}
/** One confirmed READ ONLY database clock sample, bound to the actual root object. Not identity, permission or spending authority. */
export interface ResearchQuoteClock {
  readonly kind: "research_quote_clock";
}
const clocks = new WeakMap<
  object,
  {
    database: ResearchAdmissionDatabase;
    nowMs: number;
    before: number;
    deadline: number;
  }
>();
/** Uses native SQL time, rejecting savepoints, ignored transaction mode, cancellation and late acknowledgements. */
export async function observeResearchQuoteClock(
  database: ResearchAdmissionDatabase,
  signal: AbortSignal,
): Promise<ResearchQuoteClock> {
  try {
    if (is(database, PgTransaction) || "rollback" in database) fail();
    const before = performance.now();
    const now = await withinResearchDeadline(signal, (s) =>
      database.transaction(
        async (tx) => {
          await tx.execute(sql`set local statement_timeout='8s'`);
          const [r] = await tx
            .select({
              now: sql<number>`floor(extract(epoch from pg_catalog.clock_timestamp())*1000)::double precision`,
              readOnly: sql<string>`pg_catalog.current_setting('transaction_read_only')`,
              isolation: sql<string>`pg_catalog.current_setting('transaction_isolation')`,
            })
            .from(sql`(select 1) research_quote_clock`);
          s.throwIfAborted();
          if (
            !r ||
            r.readOnly !== "on" ||
            r.isolation !== "read committed" ||
            !Number.isSafeInteger(r.now) ||
            r.now < 0
          )
            fail();
          return r.now;
        },
        { accessMode: "read only", isolationLevel: "read committed" },
      ),
    );
    const deadline = before + RESEARCH_OPERATION_TIMEOUT_MS;
    if (performance.now() >= deadline) fail();
    const handle = Object.freeze({ kind: "research_quote_clock" as const });
    clocks.set(handle, { database, nowMs: now, before, deadline });
    return handle;
  } catch {
    return fail();
  }
}
/** Trusted quote target. Validation does not create a window, grant or database connection. */
export interface ResearchQuoteTarget {
  readonly database: ResearchAdmissionDatabase;
  readonly scope: ResearchAccountingScope;
  readonly storage?: ResearchAccountingStorage;
}
function target(value: ResearchQuoteTarget) {
  const database = value.database,
    scope = structuredClone(value.scope),
    storage = structuredClone(value.storage ?? {});
  createSqlResearchAdmission(database, scope, storage);
  return {
    database,
    scope: Object.freeze(scope),
    storage: Object.freeze(storage),
    binding: sha(
      JSON.stringify(canonical([scope, storage.schemaName ?? "public"])),
    ),
  };
}
/** Opaque exact prepared quote. It is an estimate under the frozen public price profile, never an account spending cap or adoption. */
export interface PreparedResearchQuote {
  readonly revision: string;
}
interface QuoteState {
  artifact: PreparedResearchRequestArtifact;
  target: ReturnType<typeof target>;
  quote: ResearchJobQuote;
  deadline: number;
  facts: ResearchCatalogPriceFacts;
  input: number;
  output: number;
}
const quotes = new WeakMap<object, QuoteState>();
/** Conservative full-wire UTF-8 byte token estimate,8192 output and cache/regional unit ceilings. Uses no application wall clock for expiry. */
export function prepareResearchQuote(
  artifact: PreparedResearchRequestArtifact,
  observation: ResearchPriceObservation,
  clock: ResearchQuoteClock,
  value: ResearchQuoteTarget,
): PreparedResearchQuote {
  try {
    const p = observations.get(observation),
      c = clocks.get(clock),
      a = inspectResearchRequestArtifact(artifact),
      t = target(value),
      packet = a.packet,
      now = performance.now();
    if (
      !p ||
      !c ||
      c.database !== t.database ||
      now >= p.deadline ||
      now >= c.deadline ||
      packet.window_id !== t.scope.windowId ||
      packet.context.subject.user_id !== t.scope.actorId ||
      packet.context.corpus_version !== t.scope.corpusVersion ||
      packet.model !== t.scope.model ||
      packet.processor_profile !== t.scope.processorProfile
    )
      fail();
    const input =
        Buffer.byteLength(packet.body_json) + RESEARCH_INPUT_TOKEN_OVERHEAD,
      output = RESEARCH_OUTPUT_TOKEN_LIMIT;
    const upper =
      BigInt(input) * BigInt(RESEARCH_INPUT_PICO_PER_TOKEN) +
      BigInt(output) * BigInt(RESEARCH_OUTPUT_PICO_PER_TOKEN);
    if (
      input + output > p!.facts.context_window ||
      output > p!.facts.max_output_tokens ||
      upper > BigInt(Number.MAX_SAFE_INTEGER) ||
      upper > BigInt(t.scope.perRequestPico) ||
      upper > BigInt(t.scope.totalPico)
    )
      fail();
    const remaining = Math.floor(
      Math.min(
        p!.deadline - now,
        packet.context.expires_at_ms - c!.nowMs,
        t.scope.expiresAtMs - c!.nowMs,
      ),
    );
    const quoteExpiresAtMs = c!.nowMs + remaining,
      deadline = Math.min(p!.deadline, c!.before + remaining);
    if (
      remaining <= 0 ||
      !Number.isSafeInteger(quoteExpiresAtMs) ||
      deadline <= now
    )
      fail();
    const quote = Object.freeze({
      request_artifact_sha256: a.packet_sha256,
      upperPico: Number(upper),
      quoteExpiresAtMs,
    });
    const handle = Object.freeze({
      revision: sha(
        JSON.stringify([
          "research-controlled-quote-v1",
          quote,
          p!.facts,
          t.binding,
        ]),
      ),
    });
    quotes.set(handle, {
      artifact,
      target: t,
      quote,
      deadline,
      facts: p!.facts,
      input,
      output,
    });
    return handle;
  } catch {
    return fail();
  }
}
/** Owned server inspection only. No private request body, source text or context is exposed. */
export function inspectPreparedResearchQuote(handle: PreparedResearchQuote) {
  const q = quotes.get(handle);
  if (!q) return fail();
  return {
    quote: structuredClone(q.quote),
    catalog: structuredClone(q.facts),
    input_tokens_ceiling: q.input,
    output_tokens_ceiling: q.output,
    monotonic_deadline: q.deadline,
  };
}
/** Synchronous exact request/target/lease check for the final same-stack capture hook. No I/O, renewal or wall-clock comparison. */
export function assertResearchQuoteFresh(
  handle: PreparedResearchQuote,
  artifact: PreparedResearchRequestArtifact,
  value: ResearchQuoteTarget,
  signal: AbortSignal,
): undefined {
  try {
    signal.throwIfAborted();
    const q = quotes.get(handle),
      t = target(value);
    if (
      !q ||
      q.artifact !== artifact ||
      q.target.database !== t.database ||
      q.target.binding !== t.binding ||
      performance.now() >= q.deadline
    )
      fail();
    return undefined;
  } catch {
    return fail();
  }
}
/** Adapts only the price part of the job ports. The live adapter must also enforce activation/source authority and non-price readiness. */
export function createResearchQuotePort(
  handle: PreparedResearchQuote,
  artifact: PreparedResearchRequestArtifact,
  value: ResearchQuoteTarget,
) {
  const t = target(value);
  assertResearchQuoteFresh(handle, artifact, t, new AbortController().signal);
  const inspection = inspectPreparedResearchQuote(handle);
  const requireFreshQuote: ResearchAnswerJobOptions["requireFreshQuote"] =
    async (_stage, actual, signal) => {
      try {
        assertResearchQuoteFresh(handle, actual.artifact, actual, signal);
        if (
          actual.quote.request_artifact_sha256 !==
            inspection.quote.request_artifact_sha256 ||
          actual.quote.upperPico !== inspection.quote.upperPico ||
          actual.quote.quoteExpiresAtMs !== inspection.quote.quoteExpiresAtMs
        )
          fail();
      } catch {
        return fail();
      }
    };
  return Object.freeze({
    quote: Object.freeze({ ...inspection.quote }),
    requireFreshQuote,
    assertDispatchQuoteReady: (signal: AbortSignal) =>
      assertResearchQuoteFresh(handle, artifact, t, signal),
  });
}
