import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import {
  chatResearchPermits as permits,
  chatResearchWindows as windows,
} from "../db/schema/chatResearch";
import { createUuidV7 } from "../lib/ids";
import {
  RESEARCH_MODEL_ID,
  RESEARCH_OUTPUT_TOKEN_LIMIT,
  RESEARCH_PROCESSOR_PROFILE,
  RESEARCH_REQUEST_BYTE_LIMIT,
} from "./modelRequest";
import {
  assertResearchQuoteFresh,
  createResearchPriceObserver,
  createResearchQuotePort,
  inspectPreparedResearchQuote,
  observeResearchQuoteClock,
  parseResearchPriceCatalog,
  prepareResearchQuote,
  RESEARCH_INPUT_PICO_PER_TOKEN,
  RESEARCH_INPUT_TOKEN_OVERHEAD,
  RESEARCH_OUTPUT_PICO_PER_TOKEN,
  RESEARCH_PRICE_BYTE_LIMIT,
  RESEARCH_PRICE_CATALOG_URL,
  RESEARCH_PRICE_ERROR,
  RESEARCH_PRICE_LIFETIME_MS,
  RESEARCH_PRICE_MAX_CHUNKS,
  RESEARCH_PRICE_PROFILE_SHA256,
  type ResearchQuoteTarget,
} from "./pricing";
import {
  inspectResearchRequestArtifact,
  prepareResearchRequestArtifact,
} from "./requestArtifact";
import { artifactRequestFixture } from "./requestArtifact.fixture";
import type { ResearchAdmissionDatabase } from "./sqlAdmission";

vi.mock("server-only", () => ({}));
const { db, client } = await createMemoryPgliteHarness({
  schema: { windows, permits },
});
beforeAll(() =>
  client.exec(
    readFileSync(
      new URL("../../drizzle/0023_lethal_hydra.sql", import.meta.url),
      "utf8",
    ),
  ),
);
afterAll(() => client.close());
const facts = JSON.parse(
  readFileSync(
    new URL("./fixtures/pricing-fact.json", import.meta.url),
    "utf8",
  ),
);
const active = () => new AbortController().signal;
const sha = (b: string | Uint8Array) =>
  createHash("sha256").update(b).digest("hex");
const value = () => ({
  data: [
    {
      id: facts.model_id,
      pricing: structuredClone(facts.pricing),
      context_window: facts.context_window,
      max_tokens: facts.max_tokens,
    },
  ],
});
const bytes = (v: unknown = value()) => Buffer.from(JSON.stringify(v));
const reply = (
  b: BodyInit = bytes(),
  status = 200,
  type = "application/json",
) => new Response(b, { status, headers: { "content-type": type } });
const observation = () =>
  createResearchPriceObserver({ requestFetch: vi.fn(async () => reply()) })(
    active(),
  );
function input(expires = Date.now() + 600000) {
  const f = artifactRequestFixture(expires),
    p = f.evidenceInput.subject;
  const scope = {
    windowId: createUuidV7(),
    approvalSha256: sha(createUuidV7()),
    actorId: p.user_id,
    corpusVersion: f.catalog.revision,
    model: RESEARCH_MODEL_ID,
    processorProfile: RESEARCH_PROCESSOR_PROFILE,
    beginsAtMs: Date.now() - 1000,
    expiresAtMs: Date.now() + 3599000,
    maxRequests: 3,
    perRequestPico: 350000000000,
    totalPico: 1050000000000,
  };
  return {
    artifact: prepareResearchRequestArtifact(
      f.request,
      scope.windowId,
      createUuidV7(),
    ),
    target: { database: db, scope } satisfies ResearchQuoteTarget,
    request: f.request,
  };
}
beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("Unexpected real network");
    }),
  ),
);
afterEach(() => {
  for (const [url, init] of vi.mocked(fetch).mock.calls) {
    expect(url).toBe(RESEARCH_PRICE_CATALOG_URL);
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
    expect(init?.body).toBeUndefined();
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("parses only public data with an unchanged canonical price contract", () => {
  const raw = bytes(),
    p = parseResearchPriceCatalog(raw);
  expect(p).toMatchObject({
    catalog_sha256: sha(raw),
    pricing_profile_sha256: RESEARCH_PRICE_PROFILE_SHA256,
    model: RESEARCH_MODEL_ID,
    context_window: 1050000,
    max_output_tokens: 128000,
  });
  raw.fill(0);
  expect(p.catalog_sha256).not.toBe(sha(raw));
});
it("accepts property-order changes without accepting a different price", () => {
  const reverse = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(reverse)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .reverse()
              .map(([k, x]) => [k, reverse(x)]),
          )
        : v;
  expect(
    parseResearchPriceCatalog(bytes(reverse(value()))).pricing_profile_sha256,
  ).toBe(RESEARCH_PRICE_PROFILE_SHA256);
});
it.each([
  "missing",
  "duplicate",
  "empty",
  "too-many",
  "nonobject",
  "price",
  "regional",
  "context",
  "output",
  "fractional",
])("refuses incompatible catalog %s", (kind) => {
  const v = value();
  if (kind === "missing") v.data[0].id = "other/model";
  if (kind === "duplicate") v.data.push(structuredClone(v.data[0]));
  if (kind === "empty") v.data = [];
  if (kind === "too-many") v.data = Array(4097).fill(v.data[0]);
  if (kind === "nonobject") v.data = [null as never];
  if (kind === "price") v.data[0].pricing.input = "0.000003";
  if (kind === "regional") v.data[0].pricing.regional.eu.output = "0.000012";
  if (kind === "context") v.data[0].context_window = 1;
  if (kind === "output") v.data[0].max_tokens = 1;
  if (kind === "fractional") v.data[0].max_tokens = 8192.5;
  expect(() => parseResearchPriceCatalog(bytes(v))).toThrow(
    RESEARCH_PRICE_ERROR,
  );
});
it.each([
  Buffer.alloc(0),
  Buffer.from([0xff]),
  Buffer.from("\ufeff{}"),
  Buffer.from('{"data":[],"d\\u0061ta":[]}'),
  Buffer.from('{"data":'),
  new Uint8Array(RESEARCH_PRICE_BYTE_LIMIT + 1),
])("rejects malformed or oversized raw catalog bytes %#", (raw) =>
  expect(() => parseResearchPriceCatalog(raw)).toThrow(RESEARCH_PRICE_ERROR),
);
it("never coerces nonbyte input or object JSON", () => {
  expect(() => parseResearchPriceCatalog(value() as never)).toThrow(
    RESEARCH_PRICE_ERROR,
  );
  expect(() => parseResearchPriceCatalog(bytes(null))).toThrow(
    RESEARCH_PRICE_ERROR,
  );
  expect(() => parseResearchPriceCatalog(bytes({ data: "wrong" }))).toThrow(
    RESEARCH_PRICE_ERROR,
  );
});
it("makes exactly one literal public GET without credentials, private body, redirects or caches", async () => {
  const requestFetch = vi.fn<typeof fetch>(async (url, init) => {
    expect(url).toBe(RESEARCH_PRICE_CATALOG_URL);
    expect(init).toMatchObject({
      method: "GET",
      redirect: "error",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get("authorization")).toBeNull();
    return reply();
  });
  const config: { requestFetch: typeof fetch } = { requestFetch },
    observe = createResearchPriceObserver(config);
  config.requestFetch = async () => {
    throw Error("Mutated fetch");
  };
  const result = await observe(active());
  expect(result.revision).toMatch(/^[a-f0-9]{64}$/);
  expect(requestFetch).toHaveBeenCalledOnce();
});
it("can use an explicitly stubbed global public transport and rejects a malformed configured fetch", async () => {
  vi.mocked(fetch).mockResolvedValue(reply());
  expect((await createResearchPriceObserver()(active())).revision).toHaveLength(
    64,
  );
  expect(fetch).toHaveBeenCalledOnce();
  expect(() =>
    createResearchPriceObserver({ requestFetch: null as never }),
  ).toThrow(RESEARCH_PRICE_ERROR);
});
it.each([
  "http",
  "media",
  "redirected",
  "url",
  "no-body",
  "bad-json",
  "wrong-chunk",
])("refuses a failed public fetch/capture %s", async (kind) => {
  let response =
    kind === "no-body"
      ? new Response(null, { headers: { "content-type": "application/json" } })
      : kind === "wrong-chunk"
        ? reply(
            new ReadableStream({
              start(c) {
                c.enqueue("wrong");
                c.close();
              },
            }),
          )
        : reply(
            kind === "bad-json" ? "not JSON" : bytes(),
            kind === "http" ? 503 : 200,
            kind === "media" ? "text/plain" : "application/json",
          );
  if (kind === "redirected")
    Object.defineProperty(response, "redirected", { value: true });
  if (kind === "url")
    Object.defineProperty(response, "url", {
      value: "https://unrelated.invalid/",
    });
  await expect(
    createResearchPriceObserver({ requestFetch: vi.fn(async () => response) })(
      active(),
    ),
  ).rejects.toThrow(RESEARCH_PRICE_ERROR);
});
it("leaves a borrowed body lock alone", async () => {
  const r = reply(),
    borrowed = r.body!.getReader();
  try {
    await expect(
      createResearchPriceObserver({ requestFetch: vi.fn(async () => r) })(
        active(),
      ),
    ).rejects.toThrow(RESEARCH_PRICE_ERROR);
    expect(r.body!.locked).toBe(true);
  } finally {
    borrowed.releaseLock();
  }
});
it("enforces the real byte cap and a finite zero-byte chunk budget", async () => {
  for (const body of [
    new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(RESEARCH_PRICE_BYTE_LIMIT + 1));
        c.close();
      },
    }),
    new ReadableStream({
      start(c) {
        for (let i = 0; i <= RESEARCH_PRICE_MAX_CHUNKS; i++)
          c.enqueue(new Uint8Array());
        c.close();
      },
    }),
  ])
    await expect(
      createResearchPriceObserver({
        requestFetch: vi.fn(async () => reply(body)),
      })(active()),
    ).rejects.toThrow(RESEARCH_PRICE_ERROR);
});
it("bounds a non-cooperative fetch, propagates cancellation and discards a late response", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  let resolve!: (r: Response) => void, supplied: AbortSignal | undefined;
  const pending = createResearchPriceObserver({
      requestFetch: vi.fn(async (_u, init) => {
        supplied = init?.signal ?? undefined;
        return await new Promise<Response>((r) => {
          resolve = r;
        });
      }),
    })(active()),
    observed = expect(pending).rejects.toThrow(RESEARCH_PRICE_ERROR);
  await vi.advanceTimersByTimeAsync(8000);
  await observed;
  expect(supplied?.aborted).toBe(true);
  const cancel = vi.fn();
  resolve(reply(new ReadableStream({ cancel })));
  await vi.advanceTimersByTimeAsync(0);
  expect(cancel).toHaveBeenCalledOnce();
});
it("refuses cancellation before public dispatch without invoking the port", async () => {
  const controller = new AbortController();
  controller.abort();
  const requestFetch = vi.fn(async () => reply());
  await expect(
    createResearchPriceObserver({ requestFetch })(controller.signal),
  ).rejects.toThrow(RESEARCH_PRICE_ERROR);
  expect(requestFetch).not.toHaveBeenCalled();
});
it("observes native read-only SQL time and compiles exact byte/output arithmetic under the actual clock", async () => {
  const f = input(),
    obs = await observation(),
    clock = await observeResearchQuoteClock(db, active()),
    q = prepareResearchQuote(f.artifact, obs, clock, f.target),
    p = inspectPreparedResearchQuote(q),
    a = inspectResearchRequestArtifact(f.artifact);
  expect(p.input_tokens_ceiling).toBe(
    Buffer.byteLength(a.packet.body_json) + RESEARCH_INPUT_TOKEN_OVERHEAD,
  );
  expect(p.output_tokens_ceiling).toBe(RESEARCH_OUTPUT_TOKEN_LIMIT);
  expect(p.quote.upperPico).toBe(
    p.input_tokens_ceiling * RESEARCH_INPUT_PICO_PER_TOKEN +
      RESEARCH_OUTPUT_TOKEN_LIMIT * RESEARCH_OUTPUT_PICO_PER_TOKEN,
  );
  expect(p.quote.quoteExpiresAtMs).toBeLessThanOrEqual(Date.now() + 60000);
  expect(p.quote.quoteExpiresAtMs).toBeGreaterThan(Date.now());
  expect(p.quote.upperPico).toBeLessThanOrEqual(350000000000);
  expect(p.quote.request_artifact_sha256).toBe(a.packet_sha256);
  expect(
    assertResearchQuoteFresh(q, f.artifact, f.target, active()),
  ).toBeUndefined();
  (p.quote as { upperPico: number }).upperPico = 1;
  expect(inspectPreparedResearchQuote(q).quote.upperPico).not.toBe(1);
  const port = createResearchQuotePort(q, f.artifact, f.target);
  await port.requireFreshQuote(
    "prepare",
    { artifact: f.artifact, quote: port.quote, ...f.target, storage: {} },
    active(),
  );
  await port.requireFreshQuote(
    "dispatch",
    { artifact: f.artifact, quote: port.quote, ...f.target, storage: {} },
    active(),
  );
  expect(port.assertDispatchQuoteReady(active())).toBeUndefined();
});
it("does not derive quote expiry from an application wall clock", async () => {
  const f = input(),
    obs = await observation(),
    clock = await observeResearchQuoteClock(db, active()),
    realNow = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(0);
  const q = prepareResearchQuote(f.artifact, obs, clock, f.target);
  expect(
    inspectPreparedResearchQuote(q).quote.quoteExpiresAtMs,
  ).toBeGreaterThan(realNow);
  assertResearchQuoteFresh(q, f.artifact, f.target, active());
});
it.each(["write", "repeatable", "lost-ack"])(
  "refuses an invalid or uncertain root clock %s",
  async (kind) => {
    const database: ResearchAdmissionDatabase = {
      transaction: async (work, config) => {
        const result = await db.transaction(
          work,
          kind === "write"
            ? { isolationLevel: "read committed", accessMode: "read write" }
            : kind === "repeatable"
              ? { isolationLevel: "repeatable read", accessMode: "read only" }
              : config,
        );
        if (kind === "lost-ack") throw Error("Synthetic private ACK detail");
        return result;
      },
    };
    await expect(observeResearchQuoteClock(database, active())).rejects.toThrow(
      RESEARCH_PRICE_ERROR,
    );
  },
);
it("refuses a savepoint clock and an aborted clock", async () => {
  await db.transaction(async (tx) => {
    await expect(
      observeResearchQuoteClock(tx as never, active()),
    ).rejects.toThrow(RESEARCH_PRICE_ERROR);
  });
  const c = new AbortController();
  c.abort();
  await expect(observeResearchQuoteClock(db, c.signal)).rejects.toThrow(
    RESEARCH_PRICE_ERROR,
  );
});
it.each([
  "price",
  "clock",
  "database",
  "artifact-window",
  "actor",
  "corpus",
  "model",
  "processor",
  "per-request",
  "total",
  "expired-window",
  "expired-context",
])("refuses unbound or over-budget quote input %s", async (kind) => {
  const f = input(kind === "expired-context" ? Date.now() - 1000 : undefined),
    obs = await observation(),
    clock = await observeResearchQuoteClock(db, active());
  let o = obs,
    c = clock;
  if (kind === "price") o = { revision: obs.revision };
  if (kind === "clock") c = { kind: "research_quote_clock" };
  if (kind === "database")
    f.target.database = { transaction: db.transaction.bind(db) } as typeof db;
  if (kind === "artifact-window") f.target.scope.windowId = createUuidV7();
  if (kind === "actor") f.target.scope.actorId = createUuidV7();
  if (kind === "corpus") f.target.scope.corpusVersion = "a".repeat(64);
  if (kind === "model")
    f.target.scope.model = "other/model" as typeof RESEARCH_MODEL_ID;
  if (kind === "processor") f.target.scope.processorProfile = "other_profile";
  if (kind === "per-request") f.target.scope.perRequestPico = 1;
  if (kind === "total") f.target.scope.totalPico = 1;
  if (kind === "expired-window") {
    f.target.scope.beginsAtMs = Date.now() - 3600000;
    f.target.scope.expiresAtMs = Date.now() - 1000;
  }
  expect(() => prepareResearchQuote(f.artifact, o, c, f.target)).toThrow(
    RESEARCH_PRICE_ERROR,
  );
});
it("refuses a stale public observation, stale DB sample and exact-expiry readiness without renewing them", async () => {
  const f = input(),
    obs = await observation(),
    base = performance.now();
  let elapsed = 0;
  vi.spyOn(performance, "now").mockImplementation(() => base + elapsed);
  const clock = await observeResearchQuoteClock(db, active()),
    q = prepareResearchQuote(f.artifact, obs, clock, f.target),
    deadline = inspectPreparedResearchQuote(q).monotonic_deadline;
  elapsed = deadline - base;
  expect(() =>
    assertResearchQuoteFresh(q, f.artifact, f.target, active()),
  ).toThrow(RESEARCH_PRICE_ERROR);
  elapsed = RESEARCH_PRICE_LIFETIME_MS + 1;
  const freshClock = await observeResearchQuoteClock(db, active());
  expect(() =>
    prepareResearchQuote(f.artifact, obs, freshClock, f.target),
  ).toThrow(RESEARCH_PRICE_ERROR);
  elapsed = 8001;
  const freshObs = await observation();
  expect(() =>
    prepareResearchQuote(f.artifact, freshObs, clock, f.target),
  ).toThrow(RESEARCH_PRICE_ERROR);
});
it("does not let parsed data or copied handles certify quote/clock/HTTP freshness", async () => {
  const f = input(),
    facts = parseResearchPriceCatalog(bytes()),
    clock = await observeResearchQuoteClock(db, active());
  expect(() =>
    prepareResearchQuote(f.artifact, facts as never, clock, f.target),
  ).toThrow(RESEARCH_PRICE_ERROR);
  expect(() =>
    inspectPreparedResearchQuote({ revision: "a".repeat(64) }),
  ).toThrow(RESEARCH_PRICE_ERROR);
  const obs = await observation(),
    q = prepareResearchQuote(f.artifact, obs, clock, f.target);
  expect(() =>
    createResearchQuotePort(
      JSON.parse(JSON.stringify(q)),
      f.artifact,
      f.target,
    ),
  ).toThrow(RESEARCH_PRICE_ERROR);
});
it("binds the ready lease to exact artifact identity, database, namespace and immutable scope", async () => {
  const f = input(),
    obs = await observation(),
    clock = await observeResearchQuoteClock(db, active()),
    q = prepareResearchQuote(f.artifact, obs, clock, f.target),
    p = inspectResearchRequestArtifact(f.artifact),
    equivalent = prepareResearchRequestArtifact(
      f.request,
      p.packet.window_id,
      p.packet.operation_id,
    );
  expect(equivalent.revision).toBe(f.artifact.revision);
  expect(() =>
    assertResearchQuoteFresh(q, equivalent, f.target, active()),
  ).toThrow(RESEARCH_PRICE_ERROR);
  expect(() =>
    assertResearchQuoteFresh(
      q,
      f.artifact,
      { ...f.target, database: { transaction: db.transaction.bind(db) } },
      active(),
    ),
  ).toThrow(RESEARCH_PRICE_ERROR);
  expect(() =>
    assertResearchQuoteFresh(
      q,
      f.artifact,
      { ...f.target, storage: { schemaName: "other" } },
      active(),
    ),
  ).toThrow(RESEARCH_PRICE_ERROR);
  assertResearchQuoteFresh(
    q,
    f.artifact,
    { ...f.target, storage: { schemaName: "public" } },
    active(),
  );
  const port = createResearchQuotePort(q, f.artifact, f.target),
    originalScope = structuredClone(f.target.scope);
  f.target.scope.approvalSha256 = "b".repeat(64);
  expect(() =>
    assertResearchQuoteFresh(q, f.artifact, f.target, active()),
  ).toThrow(RESEARCH_PRICE_ERROR);
  await port.requireFreshQuote(
    "prepare",
    {
      artifact: f.artifact,
      quote: port.quote,
      database: db,
      scope: originalScope,
      storage: {},
    },
    active(),
  );
  const aborted = new AbortController();
  aborted.abort();
  expect(() => port.assertDispatchQuoteReady(aborted.signal)).toThrow(
    RESEARCH_PRICE_ERROR,
  );
});

it("accepts exact advertised minimum capacity with the unchanged pricing profile", () => {
  const v = value();
  v.data[0].context_window =
    RESEARCH_REQUEST_BYTE_LIMIT +
    RESEARCH_INPUT_TOKEN_OVERHEAD +
    RESEARCH_OUTPUT_TOKEN_LIMIT;
  v.data[0].max_tokens = RESEARCH_OUTPUT_TOKEN_LIMIT;
  expect(parseResearchPriceCatalog(bytes(v)).max_output_tokens).toBe(
    RESEARCH_OUTPUT_TOKEN_LIMIT,
  );
});
it("checks all actual quote values supplied by the coordinator instead of accepting an underpriced copy", async () => {
  const f = input(),
    obs = await observation(),
    clock = await observeResearchQuoteClock(db, active()),
    q = prepareResearchQuote(f.artifact, obs, clock, f.target),
    port = createResearchQuotePort(q, f.artifact, f.target);
  expect(Object.isFrozen(port.quote)).toBe(true);
  for (const changed of [
    { ...port.quote, upperPico: 1 },
    { ...port.quote, quoteExpiresAtMs: port.quote.quoteExpiresAtMs + 1 },
    { ...port.quote, request_artifact_sha256: "b".repeat(64) },
  ])
    await expect(
      port.requireFreshQuote(
        "prepare",
        { artifact: f.artifact, quote: changed, ...f.target, storage: {} },
        active(),
      ),
    ).rejects.toThrow(RESEARCH_PRICE_ERROR);
  const createSourceReaders = vi.fn(() => {
      throw Error("Must not reach source preparation with a bad quote");
    }),
    requestFetch = vi.fn<typeof fetch>();
  const { createResearchAnswerJob } = await import("./coordinator");
  const job = createResearchAnswerJob({
    artifact: f.artifact,
    quote: { ...port.quote, upperPico: 1 },
    database: db,
    scope: f.target.scope,
    apiKey: "synthetic-priced-job-key",
    requireActive: async () => {},
    requireFreshQuote: port.requireFreshQuote,
    assertHandoffReady: () => undefined,
    createSourceReaders,
    requestFetch,
  });
  await expect(job.execute(active())).rejects.toThrow();
  expect(createSourceReaders).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
});

it.each([false, true])(
  "does not let a rejecting public-body cancellation escape or hang (owned reader=%s)",
  async (owned) => {
    const cancel = vi.fn(async () => {
      throw Error("Synthetic public cleanup detail");
    });
    const body = new ReadableStream({
      start(c) {
        if (owned) c.enqueue("not bytes");
      },
      cancel,
    });
    await expect(
      createResearchPriceObserver({
        requestFetch: vi.fn(async () => reply(body, owned ? 200 : 503)),
      })(active()),
    ).rejects.toThrow(RESEARCH_PRICE_ERROR);
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledOnce();
  },
);
it("completes a real priced job with a final synchronous quote lease and no actual generation", async () => {
  const { createResearchAnswerJob } = await import("./coordinator"),
    { gatewayResponseFixture } = await import("./gatewayResponse.fixture"),
    { collectResearchAnswer } = await import("./answerStream");
  const f = input(),
    a = inspectResearchRequestArtifact(f.artifact),
    obs = await observation(),
    clock = await observeResearchQuoteClock(db, active()),
    prepared = prepareResearchQuote(f.artifact, obs, clock, f.target),
    port = createResearchQuotePort(prepared, f.artifact, f.target),
    scope = f.target.scope;
  await db.insert(windows).values({
    id: scope.windowId,
    approvalSha256: scope.approvalSha256,
    actorId: scope.actorId,
    corpusVersion: scope.corpusVersion,
    model: scope.model,
    processorProfile: scope.processorProfile,
    beginsAt: new Date(scope.beginsAtMs),
    expiresAt: new Date(scope.expiresAtMs),
    maxRequests: scope.maxRequests,
    perRequestPico: scope.perRequestPico,
    totalPico: scope.totalPico,
  });
  const createSourceReaders = () => {
    const principal = {
      subject: a.packet.context.subject,
      session_binding_sha256: sha("synthetic-priced-session"),
      expires_at_ms: a.packet.context.expires_at_ms + 10000,
    };
    const capabilities = {
      generation: true,
      answer: true,
      metadata: true,
      excerpt: false,
      image: false,
      download: false,
      processor_profiles: [a.packet.processor_profile],
    };
    return {
      now: () => Date.now(),
      readPrincipal: async () => principal,
      loadSnapshot: async () => ({
        subject: a.packet.context.subject,
        corpus_version: a.packet.context.corpus_version,
        authorization_version: "1",
        publication_state: "published",
        sources: a.packet.context.bindings.map((binding) => ({
          binding,
          state: "active",
          valid_from_ms: null,
          valid_until_ms: null,
          rights: capabilities,
          grants: capabilities,
        })),
      }),
      readFence: async () => ({ principal, authorization_version: "1" }),
    };
  };
  const requestFetch = vi.fn<typeof fetch>(async (_url, init) => {
    expect(init?.body).toBe(a.packet.body_json);
    return new Response(JSON.stringify(gatewayResponseFixture()), {
      headers: { "content-type": "application/json" },
    });
  });
  const ready = vi.fn((stage: string, signal: AbortSignal) => {
    signal.throwIfAborted();
    if (stage === "dispatch") return port.assertDispatchQuoteReady(signal);
    return undefined;
  });
  const job = createResearchAnswerJob({
    artifact: f.artifact,
    quote: port.quote,
    database: db,
    scope,
    apiKey: "synthetic-priced-job-key",
    requireActive: async () => {},
    requireFreshQuote: port.requireFreshQuote,
    assertHandoffReady: ready,
    createSourceReaders,
    requestFetch,
  });
  const signal = active(),
    result = await job.execute(signal);
  expect(result).toMatchObject({
    state: "completed",
    upperPico: port.quote.upperPico,
    reportedPico: 3000000000,
  });
  const realPerformance = performance.now.bind(performance);
  vi.spyOn(performance, "now").mockImplementation(
    () => realPerformance() + RESEARCH_PRICE_LIFETIME_MS + 1,
  );
  expect(() => port.assertDispatchQuoteReady(active())).toThrow(
    RESEARCH_PRICE_ERROR,
  );
  const response = await job.createAnswerResponse(signal);
  expect(
    (await collectResearchAnswer(response, a.packet.answer_id, signal)).origin,
  ).toBe("model");
  expect(requestFetch).toHaveBeenCalledOnce();
  expect(ready.mock.calls.map(([stage]) => stage)).toEqual([
    "dispatch",
    "delivery",
  ]);
});

it("refuses a disturbed unlocked body even when its unread suffix is a valid catalog", async () => {
  const response = reply(
      new ReadableStream({
        start(c) {
          c.enqueue(Buffer.from("already consumed prefix"));
          c.enqueue(bytes());
          c.close();
        },
      }),
    ),
    borrowed = response.body!.getReader();
  expect((await borrowed.read()).value).toEqual(
    Buffer.from("already consumed prefix"),
  );
  borrowed.releaseLock();
  expect(response.bodyUsed).toBe(true);
  expect(response.body!.locked).toBe(false);
  await expect(
    createResearchPriceObserver({ requestFetch: vi.fn(async () => response) })(
      active(),
    ),
  ).rejects.toThrow(RESEARCH_PRICE_ERROR);
});
it.each(["database", "scope", "namespace", "artifact"] as const)(
  "checks the coordinator's actual %s against the price target before source or ledger work",
  async (change) => {
    const { createResearchAnswerJob } = await import("./coordinator"),
      f = input(),
      obs = await observation(),
      clock = await observeResearchQuoteClock(db, active()),
      q = prepareResearchQuote(f.artifact, obs, clock, f.target),
      port = createResearchQuotePort(q, f.artifact, f.target),
      p = inspectResearchRequestArtifact(f.artifact);
    const database =
        change === "database" ? { transaction: db.transaction.bind(db) } : db,
      scope =
        change === "scope"
          ? { ...f.target.scope, approvalSha256: "c".repeat(64) }
          : f.target.scope,
      storage = change === "namespace" ? { schemaName: "other" } : {},
      artifact =
        change === "artifact"
          ? prepareResearchRequestArtifact(
              f.request,
              p.packet.window_id,
              p.packet.operation_id,
            )
          : f.artifact;
    const createSourceReaders = vi.fn(() => {
        throw Error(
          "A mismatched price target must not reach source authorization",
        );
      }),
      requestFetch = vi.fn<typeof fetch>(),
      transactions = vi.spyOn(database, "transaction");
    const job = createResearchAnswerJob({
      artifact,
      quote: port.quote,
      database,
      scope,
      storage,
      apiKey: "synthetic-target-price-key",
      requireActive: async () => {},
      requireFreshQuote: port.requireFreshQuote,
      assertHandoffReady: () => undefined,
      createSourceReaders,
      requestFetch,
    });
    await expect(job.execute(active())).rejects.toThrow();
    expect(createSourceReaders).not.toHaveBeenCalled();
    expect(transactions).not.toHaveBeenCalled();
    expect(requestFetch).not.toHaveBeenCalled();
  },
);
