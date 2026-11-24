import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import dictionary from "magick-data/enochian/dictionary";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { chatDailyUsage } from "@/db/schema/chatUsage";
import {
  enochianReadingSpend,
  enochianReadingSwitch,
  enochianReadings,
} from "@/db/schema/enochianReadings";
import { clientSubject } from "@/limits/client";
import { READING_CLIENT } from "@/limits/policies";
import { buildKeysTable } from "../keysTable.ts";
import { createTranslator } from "../lookup.ts";
import type { ReadingDatabase } from "./database.ts";
import { DAILY_CEILING_MICRO_USD } from "./ledger.ts";
import {
  type ReadingCall,
  ReadingCallError,
  type ReadingModel,
  type ReadingReply,
} from "./model.ts";
import { worstCaseMicroUsd } from "./prices.ts";
import { buildReadingPrompt, outputCap, partRequest } from "./request.ts";
import {
  LEASE_MS,
  MAX_BODY_BYTES,
  type ReadingDependencies,
  type ReadingEvent,
  type ReadingLog,
  respondToReading,
} from "./respond.ts";
import { readingStoreVersion } from "./store.ts";

vi.mock("@/db/neon", () => ({
  get db() {
    return harness.db;
  },
}));
const harness = await createMemoryPgliteHarness({
  schema: {
    chatDailyUsage,
    enochianReadings,
    enochianReadingSpend,
    enochianReadingSwitch,
  },
});
const db = harness.db as unknown as ReadingDatabase;
afterAll(() => harness.client.close());
beforeEach(async () => {
  await harness.db.delete(chatDailyUsage);
  await harness.db.delete(enochianReadingSpend);
  await harness.db.delete(enochianReadingSwitch);
  await harness.db.delete(enochianReadings);
});
afterEach(() => vi.restoreAllMocks());

const translator = createTranslator(buildKeysTable(), dictionary);
// A small prompt: what is sent is tested in `stage2b.test.ts`.
const prompt = buildReadingPrompt({
  dictionary: { ZIR: dictionary.ZIR },
  rows: [],
  grammar: "Notes.",
});
const secret = "synthetic-auth-test-secret-over-thirty-two-characters";
const NOW = new Date("2026-11-17T12:00:00Z");

/** `n` words of ours, none in a run of Dee's lines. */
const ours = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => ["ZIR", "IAD", "MAD", "BALT"][i % 4],
  ).join(" ");
const TWO = "VORSG SONF";
const LONG = ours(120);

/** The model's answer to a call: an item for each numbered word. */
function answer(
  call: ReadingCall,
  extra: Partial<ReadingReply> = {},
): ReadingReply {
  const items = [
    ...call.prompt.matchAll(/\[(\d+)\] ([A-Za-z' -]+?)(?= \[|\n|$)/g),
  ].map(([, token, source]) => ({
    source,
    target: "sentinelword",
    basis: "coined",
    token: Number(token),
  }));
  return {
    text: `Thinking.\n\`\`\`json\n${JSON.stringify({ items, sentence: "Sentinel sentence." })}\n\`\`\``,
    finishReason: "stop",
    cost: "0.0165",
    routing: { provider: "openai", zeroDataRetention: true },
    responseModel: "gpt-6.1-terra",
    inputTokens: 60_000,
    outputTokens: 1_000,
    cachedTokens: 59_000,
    ...extra,
  };
}

function setup(over: Partial<ReadingDependencies> = {}) {
  const work: Promise<unknown>[] = [];
  const logs: ReadingLog[] = [];
  const model = vi.fn<ReadingModel>(async (call) => answer(call));
  const deps: ReadingDependencies = {
    db,
    translator: () => translator,
    prompt: () => prompt,
    userId: async () => null,
    clientSubject: (request, day) =>
      clientSubject(
        secret,
        READING_CLIENT,
        request.headers.get("x-real-ip"),
        day,
      ),
    model,
    waitUntil: (one) => {
      work.push(one);
    },
    now: () => NOW,
    log: (line) => logs.push(line),
    ...over,
  };
  return { deps, work, logs, model };
}

const request = (
  body: unknown,
  headers: Record<string, string> = {},
): Request =>
  new Request("http://localhost/api/enochian/read", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      "x-real-ip": "203.0.113.5",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/** Sends a request and reads every event, the calls finished. */
async function send(
  body: unknown,
  run = setup(),
  headers: Record<string, string> = {},
) {
  const response = await respondToReading(request(body, headers), run.deps);
  const text = await response.text();
  await Promise.all(run.work);
  return {
    status: response.status,
    headers: response.headers,
    events: text
      .split("\n")
      .filter(Boolean)
      .map((one) => JSON.parse(one) as ReadingEvent),
    ...run,
  };
}

const counters = async () =>
  Object.fromEntries(
    (await harness.db.select().from(chatDailyUsage)).map((row) => [
      row.subject,
      row.submissions,
    ]),
  );
const spent = async () =>
  (await harness.db.select().from(enochianReadingSpend))[0]?.microUsd ?? 0;
const rows = () => harness.db.select().from(enochianReadings);

describe("the reading route (plan 081, S5)", () => {
  it("reads, checks, stores and streams a passage, then a summary", async () => {
    const { status, headers, events, model } = await send({ text: TWO });
    expect(status).toBe(200);
    expect(headers.get("content-type")).toMatch(/application\/x-ndjson/);
    expect(model).toHaveBeenCalledOnce();
    expect(events).toHaveLength(2);
    const [part, done] = events;
    expect(part).toMatchObject({
      type: "part",
      part: 1,
      parts: 1,
      from: "model",
      status: "read",
    });
    if (part.type !== "part" || part.status !== "read") throw new Error();
    expect(part.reading.words.map((one) => one.word)).toEqual([
      "VORSG",
      "SONF",
    ]);
    expect(part.reading.words.map((one) => one.state)).toEqual([
      "unconfirmed",
      "unconfirmed",
    ]);
    expect(done).toEqual({
      type: "done",
      state: "read",
      from: "model",
      units: 1,
    });
    // Stored as checked, never as the model's reply.
    const [row] = await rows();
    expect(row).toMatchObject({
      version: readingStoreVersion(prompt.version),
      passage: "VORSG SONF",
      complete: true,
      claim: null,
      pendingUntil: null,
    });
    expect(row.parts).toEqual([{ status: "read", reading: part.reading }]);
    expect(JSON.stringify(row.parts)).not.toContain("Thinking");
    // One unit from the pool and the client; the hold settled to the cost.
    expect(Object.values(await counters()).sort()).toEqual([1, 1]);
    expect(await spent()).toBe(16_500);
  });

  it("sends the part's request: numbered words, the cap, the routing, a timeout", async () => {
    const { model } = await send({ text: "VORSG, SONF." });
    const call = model.mock.calls[0][0];
    expect(call.prompt.endsWith("\n\n[1] VORSG [2] SONF")).toBe(true);
    expect(call.instructions).toEqual(prompt.instructions);
    // 60 a word, but never under 2,000 (reasoning and the json don't shrink).
    expect(call.maxOutputTokens).toBe(2_000);
    expect(call.routing).toEqual({ only: ["openai"], zeroDataRetention: true });
    expect(call.model).toBe("openai/gpt-6.1-terra");
    expect(call.effort).toBe("medium");
    expect(call.signal).toBeInstanceOf(AbortSignal);
  });

  it("reads a long passage in two parts, the first alone, and streams each as it lands", async () => {
    let second!: (reply: ReadingReply) => void;
    const run = setup();
    run.model.mockImplementationOnce(async (call) => answer(call));
    run.model.mockImplementationOnce(
      (call) =>
        new Promise((resolve) => {
          second = (reply) => resolve(reply);
          void call;
        }),
    );
    const response = await respondToReading(request({ text: LONG }), run.deps);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("no body");
    const first = JSON.parse(
      new TextDecoder().decode((await reader.read()).value),
    );
    expect(first).toMatchObject({ type: "part", part: 1, parts: 2 });
    // The first part's reading is stored before the second is asked for.
    expect((await rows())[0].parts).toEqual(
      [first, null].map((one) =>
        one ? { status: "read", reading: one.reading } : null,
      ),
    );
    await vi.waitFor(() => expect(run.model).toHaveBeenCalledTimes(2));
    second(answer(run.model.mock.calls[1][0]));
    let rest = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      rest += new TextDecoder().decode(value);
    }
    await Promise.all(run.work);
    const events = rest
      .split("\n")
      .filter(Boolean)
      .map((one) => JSON.parse(one));
    expect(events.map((one) => [one.type, one.part ?? one.state])).toEqual([
      ["part", 2],
      ["done", "read"],
    ]);
    expect(events[1].units).toBe(2);
    expect((await rows())[0].complete).toBe(true);
    // Each part's call settled to its own cost.
    expect(await spent()).toBe(33_000);
  });

  it("finishes and stores the reading when the reader leaves", async () => {
    let second!: () => void;
    const run = setup();
    run.model.mockImplementationOnce(async (call) => answer(call));
    run.model.mockImplementationOnce(
      (call) =>
        new Promise((resolve) => {
          second = () => resolve(answer(call));
        }),
    );
    const response = await respondToReading(request({ text: LONG }), run.deps);
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.cancel();
    await vi.waitFor(() => expect(run.model).toHaveBeenCalledTimes(2));
    second();
    await Promise.all(run.work);
    const [row] = await rows();
    expect(row.complete).toBe(true);
    expect(row.parts).toHaveLength(2);
  });
});

describe("the store (S7)", () => {
  it("answers the same passage within a day from the store, at no cost", async () => {
    await send({ text: TWO });
    const before = { counters: await counters(), spent: await spent() };
    const again = await send(
      { text: "VORSG   SONF!" },
      setup({ userId: async () => "u1" }),
    );
    expect(again.model).not.toHaveBeenCalled();
    expect(
      again.events.map((one) => [one.type, "from" in one && one.from]),
    ).toEqual([
      ["part", "store"],
      ["done", "store"],
    ]);
    expect(again.events[1]).toMatchObject({ units: 0 });
    expect({ counters: await counters(), spent: await spent() }).toEqual(
      before,
    );
  });

  it("never serves a reading a day old, and deletes it", async () => {
    await send({ text: TWO });
    const later = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const next = await send({ text: TWO }, setup({ now: () => later }));
    expect(next.model).toHaveBeenCalledOnce();
    expect(next.events[0]).toMatchObject({ from: "model" });
    const [row] = await rows();
    expect(row.createdAt).toEqual(later);
  });

  it("deletes expired rows on every request", async () => {
    await harness.db.insert(enochianReadings).values({
      version: "old",
      passage: "ZIR IAD",
      parts: [null],
      complete: false,
      createdAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000),
    });
    await send({ text: TWO });
    expect((await rows()).map((one) => one.version)).toEqual([
      readingStoreVersion(prompt.version),
    ]);
  });

  it("tells a concurrent identical request it is being read, at no cost", async () => {
    let finish!: () => void;
    const first = setup();
    first.model.mockImplementation(
      (call) =>
        new Promise((resolve) => {
          finish = () => resolve(answer(call));
        }),
    );
    const pending = respondToReading(request({ text: TWO }), first.deps);
    await vi.waitFor(() => expect(first.model).toHaveBeenCalledOnce());
    const counted = await counters();
    const busy = await send({ text: TWO });
    expect(busy.status).toBe(409);
    expect(busy.events).toEqual([{ type: "refused", state: "busy" }]);
    expect(busy.model).not.toHaveBeenCalled();
    expect(await counters()).toEqual(counted);
    // Even "Read again" waits.
    expect((await send({ text: TWO, again: true })).status).toBe(409);
    finish();
    await (await pending).text();
    await Promise.all(first.work);
  });

  it("lets a lease lapse when the request holding it died", async () => {
    await harness.db.insert(enochianReadings).values({
      version: readingStoreVersion(prompt.version),
      passage: TWO,
      parts: [null],
      complete: false,
      claim: "dead",
      pendingUntil: new Date(NOW.getTime() - 1),
      createdAt: NOW,
    });
    expect((await send({ text: TWO })).status).toBe(200);
    expect(LEASE_MS).toBeGreaterThan(300_000);
  });

  it("reads again at the reader's cost and replaces the stored reading", async () => {
    await send({ text: TWO });
    const run = setup();
    run.model.mockImplementation(async (call) => {
      const one = answer(call);
      return { ...one, text: one.text.replaceAll("sentinelword", "other") };
    });
    const again = await send({ text: TWO, again: true }, run);
    expect(again.model).toHaveBeenCalledOnce();
    expect(again.events.at(-1)).toMatchObject({ from: "model", units: 1 });
    const [row] = await rows();
    expect(JSON.stringify(row.parts)).toContain("other");
    expect(Object.values(await counters()).sort()).toEqual([2, 2]);
  });

  it("keeps the stored reading when reading again fails", async () => {
    await send({ text: TWO });
    const before = (await rows())[0].parts;
    const run = setup();
    run.model.mockRejectedValue(new Error("down"));
    const again = await send({ text: TWO, again: true }, run);
    expect(
      again.events.map((one) => one.type === "part" && one.status),
    ).toEqual(["failed", false]);
    const [row] = await rows();
    expect(row.parts).toEqual(before);
    expect(row).toMatchObject({ complete: true, claim: null });
  });

  it("reads only the failed second part on a retry, for its units alone", async () => {
    const run = setup();
    run.model.mockImplementationOnce(async (call) => answer(call));
    run.model.mockImplementationOnce(async (call) =>
      answer(call, { finishReason: "length" }),
    );
    const failed = await send({ text: ours(150) }, run);
    expect(
      failed.events.map((one) =>
        one.type === "part" ? one.status : one.state,
      ),
    ).toEqual(["read", "failed", "partial"]);
    expect(failed.events[1]).toMatchObject({ state: "truncated" });
    expect(failed.events[2]).toMatchObject({ units: 2 });
    const stored = (await rows())[0];
    expect(stored.complete).toBe(false);
    expect(stored.parts).toEqual([
      expect.objectContaining({ status: "read" }),
      { status: "failed", state: "truncated" },
    ]);

    const retry = await send({ text: ours(150) });
    expect(retry.model).toHaveBeenCalledOnce();
    expect(retry.model.mock.calls[0][0].maxOutputTokens).toBe(60 * 75);
    expect(
      retry.events.map((one) => [
        one.type,
        "from" in one ? one.from : one.state,
      ]),
    ).toEqual([
      ["part", "store"],
      ["part", "model"],
      ["done", "model"],
    ]);
    // 75 words: one unit, not the passage's two.
    expect(retry.events[2]).toMatchObject({ state: "read", units: 1 });
    expect((await rows())[0].complete).toBe(true);
  });

  it("keeps no passage whose every part failed", async () => {
    const run = setup();
    run.model.mockRejectedValue(new Error("down"));
    const failed = await send({ text: TWO }, run);
    expect(failed.events.at(-1)).toMatchObject({
      type: "done",
      state: "failed",
    });
    expect(await rows()).toEqual([]);
    // Still counted: a failed call may have cost.
    expect(Object.values(await counters())).toEqual([1, 1]);
  });
});

describe("a part's failures (S5)", () => {
  const failing = async (reply: Partial<ReadingReply>) => {
    const run = setup();
    run.model.mockImplementation(async (call) => answer(call, reply));
    return send({ text: TWO }, run);
  };

  it.each([
    [
      "routed without zero retention",
      { routing: { provider: "openai", zeroDataRetention: false } },
      "routing",
    ],
    [
      "routed to another provider",
      { routing: { provider: "azure", zeroDataRetention: true } },
      "routing",
    ],
    ["with no routing reported", { routing: {} }, "routing"],
    ["cut at the output cap", { finishReason: "length" }, "truncated"],
    ["refused by the provider", { finishReason: "content-filter" }, "refused"],
    ["with no readable answer", { text: "I won't." }, "unreadable"],
  ] as const)("fails a part %s", async (_, reply, state) => {
    const { events } = await failing(reply);
    expect(events).toEqual([
      { type: "part", part: 1, parts: 1, status: "failed", state },
      { type: "done", state: "failed", from: "model", units: 1 },
    ]);
    expect(await rows()).toEqual([]);
  });

  it("sends no second part after the first was routed other than asked", async () => {
    const run = setup();
    run.model.mockImplementation(async (call) =>
      answer(call, {
        routing: { provider: "openai", zeroDataRetention: false },
      }),
    );
    const { events } = await send({ text: LONG }, run);
    expect(run.model).toHaveBeenCalledOnce();
    expect(events.slice(0, 2)).toMatchObject([
      { state: "routing" },
      { state: "not read" },
    ]);
    // The second part's hold is given back; the first settles to its cost.
    expect(await spent()).toBe(16_500);
  });

  it("times a call out, and keeps its hold when no cost came", async () => {
    const run = setup({ callTimeoutMs: 5 });
    run.model.mockImplementation(
      (call) =>
        new Promise((_, reject) =>
          call.signal.addEventListener("abort", () =>
            reject(call.signal.reason),
          ),
        ),
    );
    const { events } = await send({ text: TWO }, run);
    expect(events[0]).toMatchObject({ status: "failed", state: "timeout" });
    const call = partRequest(prompt, {
      text: TWO,
      input: "[1] VORSG [2] SONF",
      words: 2,
    });
    expect(await spent()).toBe(
      worstCaseMicroUsd(call.chars, call.maxOutputTokens),
    );
  });
});

describe("refusals", () => {
  it.each([
    ["a cross-site page", { "sec-fetch-site": "cross-site" }],
    [
      "another origin",
      { "sec-fetch-site": "", origin: "https://elsewhere.example" },
    ],
  ])("refuses %s before reading anything", async (_, headers) => {
    const run = setup({ userId: vi.fn() });
    const sent = await send({ text: TWO }, run, headers);
    expect(sent.status).toBe(403);
    expect(sent.events).toEqual([{ type: "refused", state: "forbidden" }]);
    expect(run.deps.userId).not.toHaveBeenCalled();
  });

  it("takes a matching Origin from a browser without Sec-Fetch-Site", async () => {
    const headers = new Headers({
      "content-type": "application/json",
      origin: "http://localhost",
      host: "localhost",
    });
    const response = await respondToReading(
      new Request("http://localhost/api/enochian/read", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: TWO }),
      }),
      setup().deps,
    );
    expect(response.status).toBe(200);
  });

  it.each([
    ["no JSON", "text=VORSG SONF", { "content-type": "text/plain" }],
    ["broken JSON", "{", {}],
    ["no text", { again: true }, {}],
    ["a text that isn't a string", { text: 5 }, {}],
    ["again that isn't a flag", { text: TWO, again: "yes" }, {}],
    ["an array", [TWO], {}],
    ["a body over 8 KB", { text: TWO, pad: "x".repeat(9000) }, {}],
  ])("refuses %s as invalid", async (_, body, headers) => {
    const sent = await send(body, setup(), headers);
    expect(sent.status).toBe(400);
    expect(sent.events).toEqual([{ type: "refused", state: "invalid" }]);
  });

  it("refuses a text the reading doesn't take, with the reason", async () => {
    const sent = await send({ text: "OL SONF VORSG" });
    expect(sent.status).toBe(422);
    expect(sent.events).toEqual([
      {
        type: "refused",
        state: "not admitted",
        reason: "dee's lines",
        words: 3,
      },
    ]);
    expect(sent.model).not.toHaveBeenCalled();
  });

  it("stops before any call when the session can't be read", async () => {
    const run = setup({
      userId: async () => {
        throw new Error("session store down");
      },
    });
    const sent = await send({ text: TWO }, run);
    expect(sent.status).toBe(503);
    expect(sent.events).toEqual([{ type: "refused", state: "unavailable" }]);
    expect(run.model).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  });

  it("stops before any call when the database fails", async () => {
    const broken = {
      ...db,
      select: () => {
        throw new Error("connection refused");
      },
      delete: () => {
        throw new Error("connection refused");
      },
    } as unknown as ReadingDatabase;
    const run = setup({ db: broken });
    const sent = await send({ text: TWO }, run);
    expect(sent.events).toEqual([{ type: "refused", state: "unavailable" }]);
    expect(run.model).not.toHaveBeenCalled();
  });

  it("is off for everyone at once when the switch says so", async () => {
    await send({ text: "ZIR IAD" });
    await harness.db
      .insert(enochianReadingSwitch)
      .values({ id: "readings", off: true });
    const before = await counters();
    const off = await send({ text: TWO });
    expect(off.status).toBe(503);
    expect(off.events).toEqual([{ type: "refused", state: "off" }]);
    expect(off.model).not.toHaveBeenCalled();
    expect(await counters()).toEqual(before);
    // No claimed row is left behind, and nothing is served, a stored
    // reading included: it may be off for what a reading says.
    expect((await rows()).map((one) => one.passage)).toEqual(["ZIR IAD"]);
    expect((await send({ text: "ZIR IAD" })).events).toEqual([
      { type: "refused", state: "off" },
    ]);
    await harness.db.update(enochianReadingSwitch).set({ off: false });
    expect((await send({ text: "ZIR IAD" })).events.at(-1)).toMatchObject({
      from: "store",
    });
  });

  it("stops readings for the day at the ceiling, saying when they resume", async () => {
    await harness.db
      .insert(enochianReadingSpend)
      .values({ day: "2026-11-17", microUsd: DAILY_CEILING_MICRO_USD - 1_000 });
    const sent = await send({ text: TWO });
    expect(sent.status).toBe(503);
    expect(sent.events).toEqual([
      {
        type: "refused",
        state: "ceiling",
        resetAt: "2026-11-18T00:00:00.000Z",
      },
    ]);
    expect(sent.model).not.toHaveBeenCalled();
    expect(await counters()).toEqual({});
    expect(await rows()).toEqual([]);
  });

  it("refuses with what is left of the allowance, giving the hold back", async () => {
    await harness.db.insert(chatDailyUsage).values({
      subject: "user:u1",
      day: "2026-11-17",
      submissions: 99,
    });
    const sent = await send(
      { text: ours(120) },
      setup({ userId: async () => "u1" }),
    );
    expect(sent.status).toBe(429);
    expect(sent.headers.get("retry-after")).toBe(
      "Wed, 18 Nov 2026 00:00:00 GMT",
    );
    expect(sent.events).toEqual([
      {
        type: "refused",
        state: "allowance",
        scope: "user",
        units: 2,
        left: 1,
        limit: 100,
        resetAt: "2026-11-18T00:00:00.000Z",
      },
    ]);
    expect(sent.model).not.toHaveBeenCalled();
    expect(await spent()).toBe(0);
    expect(await rows()).toEqual([]);
  });

  it("caps a signed-out client at 10 units a day", async () => {
    for (let i = 0; i < 10; i++)
      expect((await send({ text: `${ours(2 + i)}` })).status).toBe(200);
    const capped = await send({ text: ours(20) });
    expect(capped.events[0]).toMatchObject({
      state: "allowance",
      scope: "client",
      left: 0,
      limit: 10,
    });
    // Another address is another bucket.
    expect(
      (await send({ text: ours(20) }, setup(), { "x-real-ip": "203.0.113.9" }))
        .status,
    ).toBe(200);
  });
});

describe("the log (S10)", () => {
  /** Every word of the passages, the replies and the errors below. */
  const SECRET_WORDS = [
    "VORSG",
    "SONF",
    "ZIR",
    "BALT",
    "sentinelword",
    "Sentinel",
    "Thinking",
  ];

  it("never holds the passage, the reply or its sentence, on any path", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map(
      (method) => vi.spyOn(console, method).mockImplementation(() => {}),
    );
    const quiet = (over: Partial<ReadingDependencies> = {}) => {
      const run = setup(over);
      // The route's own log, not the test's.
      delete (run.deps as { log?: unknown }).log;
      return run;
    };
    // Read; read from the store; read in two parts.
    await send({ text: TWO }, quiet());
    await send({ text: TWO }, quiet());
    await send({ text: LONG }, quiet());
    // A failed call whose error carries the whole request.
    const failing = quiet();
    failing.model.mockRejectedValue(
      Object.assign(new Error(`Bad request: ${TWO} sentinelword`), {
        requestBodyValues: { prompt: TWO },
      }),
    );
    await send({ text: "ZIR IAD", again: true }, failing);
    // Every failure of a reply.
    for (const extra of [
      { finishReason: "length" },
      { finishReason: "content-filter" },
      { text: `Sentinel ${TWO}` },
      { routing: {} },
    ] as const) {
      const run = quiet();
      run.model.mockImplementation(async (call) => answer(call, extra));
      await send({ text: "MAD BALT", again: true }, run);
    }
    // Refusals, and a failing session.
    await send(
      { text: `${TWO} OL SONF VORSG`.split(" ").slice(2).join(" ") },
      quiet(),
    );
    await send(
      { text: TWO },
      quiet({
        userId: async () => {
          throw new Error(`session for ${TWO}`);
        },
      }),
    );
    const logged = spies
      .flatMap((spy) => spy.mock.calls)
      .map((args) => args.map(String).join(" "));
    expect(logged.length).toBeGreaterThan(10);
    for (const one of logged) {
      expect(one.startsWith("enochian-read ")).toBe(true);
      for (const word of SECRET_WORDS) expect(one).not.toContain(word);
    }
  });
});

describe("the review's scenarios (2D review)", () => {
  const at = (iso: string) => () => new Date(iso);
  const states = (events: ReadingEvent[]) =>
    events.map((one) =>
      one.type === "part"
        ? `${one.part}:${one.status === "read" ? "read" : one.state}`
        : `${one.type}:${one.state}`,
    );

  it("A: sends no further part once the switch is turned off", async () => {
    const run = setup();
    run.model.mockImplementation(async (call) => {
      await harness.db
        .insert(enochianReadingSwitch)
        .values({ id: "readings", off: true })
        .onConflictDoNothing();
      return answer(call);
    });
    const { events } = await send({ text: LONG }, run);
    expect(run.model).toHaveBeenCalledOnce();
    expect(states(events)).toEqual(["1:read", "2:off", "done:partial"]);
    // The second part's hold is given back.
    expect(await spent()).toBe(16_500);
  });

  it("A2: gives the units back when the switch is turned off before the first call", async () => {
    const run = setup({
      // Called while reserving, after the route's own look at the switch.
      clientSubject: (request, day) => {
        void harness.db
          .insert(enochianReadingSwitch)
          .values({ id: "readings", off: true })
          .onConflictDoNothing()
          .then(() => {});
        return clientSubject(
          secret,
          READING_CLIENT,
          request.headers.get("x-real-ip"),
          day,
        );
      },
    });
    const { events } = await send({ text: LONG }, run);
    expect(run.model).not.toHaveBeenCalled();
    expect(states(events)).toEqual(["1:off", "2:off", "done:failed"]);
    expect(events.at(-1)).toMatchObject({ units: 0 });
    expect(await counters()).toEqual({});
    expect(await spent()).toBe(0);
    expect(await rows()).toEqual([]);
  });

  it("A3: gives the units back when the switch can't be read before the first call", async () => {
    let armed = false;
    const flaky = new Proxy(db, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (key === "select")
          return (...args: unknown[]) => {
            const builder = (value as (...a: unknown[]) => object).apply(
              target,
              args,
            );
            return new Proxy(builder, {
              get(inner, name) {
                const member = Reflect.get(inner, name);
                if (name === "from")
                  return (table: unknown) => {
                    if (armed && table === enochianReadingSwitch)
                      throw new Error("connection lost");
                    return (member as (t: unknown) => unknown).call(
                      inner,
                      table,
                    );
                  };
                return typeof member === "function"
                  ? member.bind(inner)
                  : member;
              },
            });
          };
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const run = setup({
      db: flaky,
      clientSubject: (request, day) => {
        armed = true;
        return clientSubject(
          secret,
          READING_CLIENT,
          request.headers.get("x-real-ip"),
          day,
        );
      },
    });
    const { events } = await send({ text: TWO }, run);
    expect(run.model).not.toHaveBeenCalled();
    // Our side failed, not the model: "unavailable" (2H).
    expect(states(events)).toEqual(["1:unavailable", "done:failed"]);
    expect(events.at(-1)).toMatchObject({ units: 0 });
    expect(await counters()).toEqual({});
    expect(await spent()).toBe(0);
  });

  it("A4: keeps the units once any call was made", async () => {
    const run = setup();
    run.model.mockImplementation(async (call) => {
      await harness.db
        .insert(enochianReadingSwitch)
        .values({ id: "readings", off: true })
        .onConflictDoNothing();
      return answer(call, { finishReason: "length" });
    });
    const { events } = await send({ text: LONG }, run);
    expect(states(events)).toEqual(["1:truncated", "2:off", "done:failed"]);
    expect(events.at(-1)).toMatchObject({ units: 2 });
    expect(Object.values(await counters())).toEqual([2, 2]);
  });

  it("B: keeps the complete reading when reading again fails part way, and serves it free", async () => {
    await send({ text: LONG });
    const before = (await rows())[0];
    const run = setup();
    run.model
      .mockImplementationOnce(async (call) => answer(call))
      .mockImplementationOnce(async (call) =>
        answer(call, { finishReason: "length" }),
      );
    const again = await send({ text: LONG, again: true }, run, {
      "x-real-ip": "203.0.113.9",
    });
    expect(states(again.events)).toEqual([
      "1:read",
      "2:truncated",
      "done:partial",
    ]);
    const after = (await rows())[0];
    expect(after).toMatchObject({ complete: true, claim: null });
    expect(after.parts).toEqual(before.parts);
    expect(after.createdAt).toEqual(before.createdAt);
    const next = await send({ text: LONG }, setup(), {
      "x-real-ip": "203.0.113.10",
    });
    expect(next.model).not.toHaveBeenCalled();
    expect(next.events.at(-1)).toEqual({
      type: "done",
      state: "read",
      from: "store",
      units: 0,
    });
  });

  it("C: never sweeps a row another request holds a live lease on", async () => {
    const first = setup({ now: at("2026-11-16T12:00:30Z") });
    first.model
      .mockImplementationOnce(async (call) => answer(call))
      .mockImplementationOnce(async (call) =>
        answer(call, { finishReason: "length" }),
      );
    await send({ text: LONG }, first);
    // Just under a day later the second part is retried; while its call
    // runs, a request after the day is out sweeps expired rows.
    const retry = setup({ now: at("2026-11-17T12:00:00Z") });
    retry.model.mockImplementation(async (call) => {
      await send(
        { text: "ZIR IAD" },
        setup({ now: at("2026-11-17T12:01:00Z") }),
        {
          "x-real-ip": "203.0.113.77",
        },
      );
      return answer(call);
    });
    const out = await send({ text: LONG }, retry);
    expect(states(out.events)).toEqual(["1:read", "2:read", "done:read"]);
    const long = (await rows()).filter((one) => one.passage.length > 50);
    expect(long).toHaveLength(1);
    expect(long[0]).toMatchObject({ complete: true, claim: null });
  });

  it("D: a client with no allowance left never holds any of the day's spending", async () => {
    for (let i = 0; i < 10; i++)
      expect((await send({ text: ours(2 + i) })).status).toBe(200);
    const holds: unknown[] = [];
    const watched = new Proxy(db, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (key === "insert")
          return (table: unknown) => {
            if (table === enochianReadingSpend) holds.push(table);
            return (value as (one: unknown) => unknown).call(target, table);
          };
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const before = await spent();
    const refused = await send({ text: LONG }, setup({ db: watched }));
    expect(refused.events[0]).toMatchObject({
      state: "allowance",
      scope: "client",
    });
    expect(holds).toEqual([]);
    expect(await spent()).toBe(before);
  });

  it("E: concurrent readings against a nearly full ceiling: those that fit read, the rest give their units back", async () => {
    const three = partRequest(prompt, {
      text: "",
      input: "[1] a [2] b [3] c",
      words: 3,
    });
    const one = worstCaseMicroUsd(three.chars, three.maxOutputTokens);
    const start = DAILY_CEILING_MICRO_USD - 3 * one - 100;
    await harness.db
      .insert(enochianReadingSpend)
      .values({ day: "2026-11-17", microUsd: start });
    const texts = [
      "ZIR IAD MAD",
      "IAD MAD ZIR",
      "MAD ZIR IAD",
      "BALT ZIR IAD",
      "ZIR BALT IAD",
      "IAD BALT ZIR",
      "MAD BALT ZIR",
      "BALT MAD ZIR",
      "ZIR MAD BALT",
      "IAD ZIR BALT",
      "MAD IAD BALT",
      "BALT IAD MAD",
    ];
    const outs = await Promise.all(
      texts.map((text, i) => {
        const run = setup({ userId: async () => `u${i}` });
        run.model.mockImplementation(async (call) =>
          answer(call, { cost: undefined }),
        );
        return send({ text }, run);
      }),
    );
    const first = outs.map((out) => states(out.events)[0]);
    expect(first.filter((one) => one === "1:read")).toHaveLength(3);
    expect(first.filter((one) => one === "refused:ceiling")).toHaveLength(9);
    expect(
      outs.reduce((sum, out) => sum + out.model.mock.calls.length, 0),
    ).toBe(3);
    // No cost reported: each call keeps its hold; never past the ceiling.
    const after = await spent();
    expect(after).toBeLessThanOrEqual(DAILY_CEILING_MICRO_USD);
    expect(after - start).toBeGreaterThan(2.9 * one);
    expect(Object.values(await counters())).toEqual([1, 1, 1]);
  });

  it("F: caps a short passage's output at 2,000 tokens, a longer one at 60 a word", async () => {
    for (const [text, cap] of [
      [TWO, 2_000],
      [ours(5), 2_000],
      [ours(40), 2_400],
    ] as const) {
      await harness.db.delete(chatDailyUsage);
      const out = await send({ text });
      expect(out.model.mock.calls[0][0].maxOutputTokens).toBe(cap);
    }
    expect(outputCap(75)).toBe(4_500);
  });

  it("G: stops reading a body past 8 KB, whatever its length header says", async () => {
    const big = new TextEncoder().encode(
      JSON.stringify({ text: TWO, pad: "x".repeat(200_000) }),
    );
    for (const length of [undefined, "40"]) {
      let pulled = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          const chunk = big.subarray(pulled, pulled + 1024);
          pulled += chunk.byteLength;
          if (chunk.byteLength) controller.enqueue(chunk);
          else controller.close();
        },
      });
      const response = await respondToReading(
        new Request("http://localhost/api/enochian/read", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "sec-fetch-site": "same-origin",
            ...(length ? { "content-length": length } : {}),
          },
          body,
          duplex: "half",
        } as RequestInit),
        setup().deps,
      );
      expect(response.status).toBe(400);
      expect(pulled).toBeLessThan(MAX_BODY_BYTES + 4 * 1024);
    }
  });
});

describe("the final review's fixes (2H)", () => {
  it("S1: gives the units back when the ceiling's hold fails with an error", async () => {
    let throws = 1;
    const flaky = new Proxy(db, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (key === "insert")
          return (table: unknown) => {
            if (table === enochianReadingSpend && throws > 0) {
              throws--;
              throw new Error("connection lost");
            }
            return (value as (t: unknown) => unknown).call(target, table);
          };
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const run = setup({ db: flaky });
    const { status, events } = await send({ text: TWO }, run);
    expect(status).toBe(503);
    expect(events).toEqual([{ type: "refused", state: "unavailable" }]);
    expect(run.model).not.toHaveBeenCalled();
    expect(await counters()).toEqual({});
    expect(await spent()).toBe(0);
    expect(await rows()).toEqual([]);
    // The next request reads, the lease given back.
    const next = await send({ text: TWO }, setup({ db: flaky }));
    expect(next.events.at(-1)).toMatchObject({ type: "done", units: 1 });
  });

  it.each([401, 403, 404, 429])(
    "S4: settles a call the gateway refused with %i to nothing",
    async (statusCode) => {
      const run = setup();
      run.model.mockImplementation(async () => {
        throw new ReadingCallError("GatewayError", statusCode, true);
      });
      const { events } = await send({ text: TWO }, run);
      expect(events[0]).toMatchObject({ status: "failed", state: "failed" });
      expect(await spent()).toBe(0);
      // The units stay counted: a call was made.
      expect(events.at(-1)).toMatchObject({ units: 1 });
    },
  );

  it.each([
    ["a 500", new ReadingCallError("GatewayError", 500, true)],
    ["a 429 after output", new ReadingCallError("GatewayError", 429, false)],
    [
      "a 429 not known to come before output",
      Object.assign(new Error("limited"), { statusCode: 429 }),
    ],
  ])("S4: keeps the hold of a call that failed with %s", async (_, error) => {
    const run = setup();
    run.model.mockImplementation(async () => {
      throw error;
    });
    await send({ text: TWO }, run);
    const call = partRequest(prompt, {
      text: TWO,
      input: "[1] VORSG [2] SONF",
      words: 2,
    });
    expect(await spent()).toBe(
      worstCaseMicroUsd(call.chars, call.maxOutputTokens),
    );
  });

  it.each([
    ["timed out", "timeout", new DOMException("late", "TimeoutError")],
    ["failed", "failed", new ReadingCallError("GatewayError", 500, true)],
    [
      "failed after output",
      "failed",
      new ReadingCallError("GatewayError", 429, false),
    ],
  ])(
    "sends no second part after the first %s, its routing unconfirmed",
    async (_, state, error) => {
      const run = setup();
      run.model.mockImplementationOnce(async () => {
        throw error;
      });
      const { events } = await send({ text: LONG }, run);
      expect(run.model).toHaveBeenCalledOnce();
      expect(events.slice(0, 2)).toMatchObject([
        { part: 1, status: "failed", state },
        { part: 2, status: "failed", state: "not read" },
      ]);
    },
  );

  it("sends the second part after the gateway refused the first before any output", async () => {
    const run = setup();
    run.model
      .mockImplementationOnce(async () => {
        throw new ReadingCallError("GatewayRateLimitError", 429, true);
      })
      .mockImplementationOnce(async (call) => answer(call));
    const { events } = await send({ text: LONG }, run);
    expect(run.model).toHaveBeenCalledTimes(2);
    expect(events.slice(0, 2)).toMatchObject([
      { state: "failed" },
      { status: "read" },
    ]);
  });

  it("sends no second part after a stream cut short with no routing confirmed", async () => {
    const run = setup();
    run.model.mockImplementation(async (call) =>
      answer(call, { finishReason: "other", routing: {} }),
    );
    const { events } = await send({ text: LONG }, run);
    expect(run.model).toHaveBeenCalledOnce();
    expect(events.slice(0, 2)).toMatchObject([
      { part: 1, status: "failed", state: "failed" },
      { part: 2, status: "failed", state: "not read" },
    ]);
    // With routing confirmed, a cut stream doesn't stop the next part.
    const confirmed = setup();
    confirmed.model
      .mockImplementationOnce(async (call) =>
        answer(call, { finishReason: "other" }),
      )
      .mockImplementationOnce(async (call) => answer(call));
    const next = await send({ text: LONG }, confirmed);
    expect(confirmed.model).toHaveBeenCalledTimes(2);
    expect(next.events.slice(0, 2)).toMatchObject([
      { state: "failed" },
      { status: "read" },
    ]);
  });
});

describe("more of the review's fixes", () => {
  it("sends a word not ours as its letters only", async () => {
    const { model } = await send({ text: "ZIR IAD MAD BALT QQ-X'Y" });
    expect(model.mock.calls[0][0].prompt.endsWith("[5] QQXY")).toBe(true);
  });

  it("gives the lease back when building a request throws", async () => {
    const broken = Object.defineProperty({ ...prompt }, "instructionChars", {
      get() {
        throw new Error("no prompt");
      },
    });
    const run = setup({ prompt: () => broken });
    const out = await send({ text: TWO }, run);
    expect(out.events).toEqual([{ type: "refused", state: "unavailable" }]);
    expect(run.model).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
    expect(await counters()).toEqual({});
  });

  it("never serves a reading checked by another version of the check", async () => {
    const old = { ...(await send({ text: TWO })) };
    expect(old.model).toHaveBeenCalledOnce();
    await harness.db
      .update(enochianReadings)
      .set({ version: `${prompt.version}.c0.p1` });
    const next = await send({ text: TWO });
    expect(next.model).toHaveBeenCalledOnce();
  });

  it("logs the generation id, and a failed call's class and status, never its message", async () => {
    const run = setup();
    run.model
      .mockImplementationOnce(async (call) => ({
        ...answer(call),
        generationId: "gen_01synthetic",
      }))
      .mockImplementationOnce(async () => {
        throw Object.assign(new Error(`limited: ${TWO}`), {
          name: "GatewayRateLimitError",
          statusCode: 429,
        });
      });
    await send({ text: LONG }, run);
    const parts = run.logs.filter((one) => one.event === "part");
    expect(parts[0]).toMatchObject({
      state: "read",
      generation: "gen_01synthetic",
      model: "gpt-6.1-terra",
      costMicroUsd: 16_500,
    });
    expect(parts[1]).toMatchObject({
      state: "failed",
      error: "GatewayRateLimitError",
      status: 429,
    });
    expect(JSON.stringify(run.logs)).not.toContain("VORSG");
  });
});
