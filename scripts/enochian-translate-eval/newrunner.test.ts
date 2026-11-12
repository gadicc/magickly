import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import realDictionary from "magick-data/enochian/dictionary";
import keys from "magick-data/enochian/keys";
import { afterEach, describe, expect, it } from "vitest";
import type { AnswerItem } from "./answer.ts";
import { a1Task3 } from "./baseline.ts";
import { dictionary as fixtureDictionary, row } from "./fixtures.ts";
import {
  type JudgeRow,
  NEW_JUDGE_INSTRUCTIONS,
  newJudgeRequest,
  verdictKey,
} from "./judge.ts";
import {
  estimateCost,
  Ledger,
  NO_TOKENS,
  type PriceList,
  planPriceList,
} from "./ledger.ts";
import { MODELS } from "./models.ts";
import {
  barValues,
  difference,
  measureNewTextBars,
  type NewTextReport,
  PROPOSED_NEW_BARS,
} from "./newbars.ts";
import {
  NEW_ARMS,
  NEW_TASK_TEXT,
  newRequest,
  newTextParts,
  PART_ROWS,
  partRows,
  partsOf,
  planNewSpecs,
  roundTripRequest,
  SUBSETS,
  type Task3Sentence,
  task3Parts,
} from "./newprompt.ts";
import {
  blockedCalls,
  cacheCheck,
  cacheProjection,
  mergeRoundTrips,
  newRunJudgeCases,
  retryBlocked,
  roundTripStorePath,
  scoreNewRequests,
  task3Pool,
} from "./newrunner.ts";
import {
  type NewRowScore,
  type NewScores,
  newJudgeCase,
  newReport,
  newTextContext,
  scoreNewText,
  share,
} from "./newscore.ts";
import {
  ENGLISH_CANDIDATES,
  englishStems,
  KNOWN_CANDIDATES,
  type NewTextRow,
  type NewTextSet,
  newTextRows,
  withPlantedKnowns,
} from "./newtext.ts";
import { englishWords, stemEnglish } from "./normalise.ts";
import { planSpecs, requestId } from "./prompt.ts";
import {
  type EvalData,
  execute,
  ledgerPath,
  type Manifest,
  manifestRequest,
  pendingRequests,
  type Runtime,
  readJson,
  readRaw,
  runDir,
  runJudges,
  writeJson,
} from "./runner.ts";
import {
  blindId,
  candidate,
  DAMAGES,
  damagedControls,
  dealCases,
  parseRoundTrip,
  parseRubricVerdicts,
  type RoundTripStore,
  roundTripCases,
  roundTripKey,
  rubricCases,
  rubricRequest,
  type Task3Candidate,
  task3Report,
  translationText,
} from "./task3.ts";
import { rowsFromKeys } from "./testset.ts";
import {
  CACHE_BREAKPOINT,
  cachePrefix,
  callSettings,
  type Gateway,
  type ModelRequest,
  type ModelResult,
  runSync,
  tokensOf,
} from "./transport.ts";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const grammar = readFileSync(
  here("../../packages/magick-data/src/enochian/grammar.md"),
  "utf8",
);
const set: NewTextSet = JSON.parse(
  readFileSync(here("./data/newtext.json"), "utf8"),
);
const task3: Task3Sentence[] = JSON.parse(
  readFileSync(here("./data/task3-sentences.json"), "utf8"),
).sentences;
const keyRows = rowsFromKeys(keys);
const data: EvalData = {
  dictionary: realDictionary,
  rows: keyRows,
  grammar,
  folds: [],
  newText: set,
  task3,
};
const rows = newTextRows(set);
const opus = MODELS.opus;

/** Every new-text and task-3 request a model could be sent. */
function allRequests() {
  const out: ModelRequest[] = [];
  for (const subset of SUBSETS)
    out.push(
      ...planNewSpecs(
        {
          arms: NEW_ARMS,
          tasks: [1, 2],
          subset,
          model: opus,
          efforts: ["medium", "high"],
        },
        data,
      ).map((spec) => newRequest(spec, data)),
    );
  out.push(
    ...planNewSpecs(
      {
        arms: NEW_ARMS,
        tasks: [3],
        subset: "all",
        model: opus,
        efforts: ["medium"],
      },
      data,
    ).map((spec) => newRequest(spec, data)),
  );
  return out;
}

// --- Fakes ---------------------------------------------------------------------

const prices: PriceList = {
  m: {
    input: "0.000004",
    output: "0.00002",
    input_cache_read: "0.0000002",
    input_cache_write: "0.000005",
  },
  "m-batch": { input: "0.000002", output: "0.00001" },
  [MODELS.opus]: { input: "0.000004", output: "0.00002" },
  [MODELS.gpt]: { input: "0.000004", output: "0.00002" },
};

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function tempOut() {
  const dir = mkdtempSync(join(tmpdir(), "translate-eval-new-"));
  dirs.push(dir);
  return dir;
}

/** A fake gateway: canned replies, every call counted, never the network. */
function fakeGateway(
  reply: (request: ModelRequest, call: number) => Partial<ModelResult>,
  more: Partial<Gateway> = {},
): Gateway & { calls: string[]; events: string[] } {
  const calls: string[] = [];
  const events: string[] = [];
  return {
    calls,
    events,
    async generate(request) {
      calls.push(request.id);
      events.push(`start ${request.id}`);
      await setTimeout(2);
      events.push(`end ${request.id}`);
      return {
        id: request.id,
        ok: true,
        text: "",
        finishReason: "stop",
        tokens: { ...NO_TOKENS, input: 1000, output: 500, reasoning: 200 },
        ...reply(request, calls.length),
      };
    },
    startBatch: async () => {
      throw new Error("no batch");
    },
    batchStatus: async () => ({ status: "completed" }),
    async *batchResults() {},
    generationCost: async () => undefined,
    ...more,
  };
}

function runtime(out: string, gateway: Gateway, concurrency = 1): Runtime {
  return {
    out,
    gateway,
    prices,
    ledger: new Ledger(ledgerPath(out)),
    log: () => {},
    concurrency,
  };
}

/** A small request with reference material, so it has a cache prefix. */
const contextRequest = (id: string, context = "C"): ModelRequest => ({
  id,
  kind: "judge",
  model: "m",
  effort: "medium",
  instructions: ["Say it.", context.repeat(1000)],
  prompt: `Now ${id}.`,
});

const json = (value: unknown) => `\`\`\`json\n${JSON.stringify(value)}\n\`\`\``;

// --- The planted knowns ----------------------------------------------------------

describe("the planted knowns' meanings", () => {
  it("are ordinary nouns no dictionary meaning, Dee or plant uses", () => {
    const stems = englishStems({ dictionary: realDictionary, rows: keyRows });
    const known = Object.values(KNOWN_CANDIDATES).join(" ").split(" ");
    const plantList = new Set(
      Object.values(ENGLISH_CANDIDATES).join(" ").split(" "),
    );
    for (const word of known) expect(plantList.has(word), word).toBe(false);
    const plantNouns = rows
      .filter((one) => one.kind === "plant")
      .flatMap((one) => englishWords(one.english))
      .map(stemEnglish);
    expect(set.plantedKnowns).toHaveLength(20);
    for (const one of set.plantedKnowns) {
      expect(one.meaning).toMatch(/^[a-z]+$/);
      expect(known).toContain(one.meaning);
      expect(stems.has(stemEnglish(one.meaning))).toBe(false);
      expect(plantNouns).not.toContain(stemEnglish(one.meaning));
    }
    // A few of each kind.
    for (const list of Object.values(KNOWN_CANDIDATES))
      expect(
        set.plantedKnowns.filter((one) => list.split(" ").includes(one.meaning))
          .length,
      ).toBe(4);
  });
});

// --- Requests ---------------------------------------------------------------------

describe("requests on the new text and task 3", () => {
  it("break parts only at sentence ends, about 75 rows each", () => {
    for (const subset of SUBSETS) {
      const parts = newTextParts(set, subset);
      const sentences = parts.flat();
      expect(new Set(sentences).size).toBe(sentences.length);
      for (const part of parts) {
        const n = partRows(set, part).length;
        expect(n).toBeGreaterThan(PART_ROWS / 2);
        expect(n).toBeLessThan(PART_ROWS * 1.5);
      }
    }
    expect(newTextParts(set, "all")).toHaveLength(8);
    expect(newTextParts(set, "all").flat()).toEqual(
      set.sentences.map((one) => one.id),
    );
    expect(newTextParts(set, "first30").flat()).toEqual(
      set.sentences.slice(0, 30).map((one) => one.id),
    );
    expect(newTextParts(set, "repeat").flat()).toEqual(set.repeat.sentences);
    expect(task3Parts(task3).map((one) => one.length)).toEqual([20, 20, 20]);
    expect(partsOf([5, 5, 5, 5], (x) => x, 10)).toEqual([
      [5, 5],
      [5, 5],
    ]);
  });

  it("number task 1's words through a part, a sentence a line", () => {
    const [part] = newTextParts(set, "all");
    const request = newRequest(
      {
        arm: "A3",
        task: 1,
        subset: "all",
        part: 1,
        sentences: part,
        model: opus,
        effort: "medium",
      },
      data,
    );
    const input = request.prompt.split("\n\n").at(-1) as string;
    const lines = input.split("\n");
    expect(lines).toHaveLength(part.length);
    const its = partRows(set, part);
    expect([...input.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))).toEqual(
      its.map((_, i) => i + 1),
    );
    expect(lines[0]).toContain(`[1] ${its[0].enochian}`);
    expect(request.prompt).toContain(NEW_TASK_TEXT[1]);
  });

  it("have ids unique, and apart from the folds'", () => {
    const ids = allRequests().map((one) => one.id);
    expect(new Set(ids).size).toBe(ids.length);
    const folds = planSpecs({
      keys: Array.from({ length: 19 }, (_, i) => i + 1),
      arms: ["A0", "A2", "A2c", "A3"],
      tasks: [1, 2],
      books: ["open", "closed"],
      model: opus,
      efforts: ["medium", "high"],
    }).map(requestId);
    for (const id of ids) {
      expect(folds).not.toContain(id);
      expect(id).toMatch(/^(?:N|T3)-[A-Za-z0-9_-]+$/);
    }
  });

  it("share one identical prefix within each prompt", () => {
    const all = allRequests();
    const prefix = (one: ModelRequest) => JSON.stringify(one.instructions);
    const of = (test: (one: ModelRequest) => boolean) =>
      new Set(all.filter(test).map(prefix));
    const t12 = (one: ModelRequest) => one.id.startsWith("N-");
    // A3: one prefix for every part, task and subset of tasks 1 and 2; A2
    // too; and A2's is the start of A3's.
    expect(of((one) => t12(one) && one.id.startsWith("N-A3-")).size).toBe(1);
    expect(of((one) => t12(one) && one.id.startsWith("N-A2-")).size).toBe(1);
    const a2 = all.find((one) => one.id.startsWith("N-A2-")) as ModelRequest;
    const a3 = all.find((one) => one.id.startsWith("N-A3-")) as ModelRequest;
    expect(a3.instructions.slice(0, 2)).toEqual(a2.instructions);
    // Task 3 caches apart: its context is another.
    const t3 = all.find((one) => one.id.startsWith("T3-A3-")) as ModelRequest;
    expect(of((one) => one.id.startsWith("T3-A3-")).size).toBe(1);
    expect(t3.instructions[1]).not.toBe(a3.instructions[1]);
    expect(t3.instructions[0]).toBe(a3.instructions[0]);
    expect(t3.instructions[2]).toBe(a3.instructions[2]);
    // A0 has nothing.
    for (const one of all.filter((r) => /^(?:N|T3)-A0-/.test(r.id)))
      expect(one.instructions).toHaveLength(1);
    // The context holds all 19 Keys, every row.
    const rowLines = a3.instructions[1]
      .split("\n")
      .filter((line) => /^\d+\.\d+\t/.test(line));
    expect(rowLines).toHaveLength(keyRows.length);
    expect(new Set(rowLines.map((line) => line.split(".")[0])).size).toBe(19);
    // The cache prefix groups them the same way.
    expect(cachePrefix(a3)).toBe(cachePrefix({ ...a3, prompt: "other" }));
    expect(cachePrefix(a2)).not.toBe(cachePrefix(a3));
  });

  it("hold the planted knowns in tasks 1 and 2 only", () => {
    const all = allRequests();
    const t12 = all.find((one) => one.id.startsWith("N-A2-")) as ModelRequest;
    const t3 = all.find((one) => one.id.startsWith("T3-A2-")) as ModelRequest;
    const trip = roundTripRequest(
      {
        part: 1,
        input: [{ id: "c1", enochian: "OL" }],
        model: opus,
        effort: "medium",
      },
      realDictionary,
    );
    const judge = rubricRequest({ dictionary: realDictionary, grammar })(
      { answer: "T3J-x", key: 0, rows: [] },
      "opus",
    );
    for (const known of set.plantedKnowns) {
      const line = `${known.headword}\t${known.meaning} [${known.source}]`;
      expect(t12.instructions[1]).toContain(line);
      for (const one of [t3, trip, judge])
        expect(one.instructions.join("\n")).not.toContain(known.headword);
    }
    // Interleaved in order, as ordinary entries.
    const headwords = t12.instructions[1]
      .split("\n")
      .filter((line) => /^[A-Za-z].*\t/.test(line))
      .map((line) => line.split("\t")[0]);
    const first = headwords.indexOf(set.plantedKnowns[0].headword);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(headwords.length - 1);
  });

  it("present a passage, never held-out Keys or a test", () => {
    for (const one of allRequests()) {
      const text = [
        ...one.instructions.filter((part) => !part.includes(grammar.trim())),
        one.prompt,
      ].join("\n");
      expect(text).not.toMatch(/held[- ]out|\btests?\b|other Keys/i);
    }
  });

  it("give the answer checker the planted knowns", () => {
    const out = tempOut();
    const run = "r";
    const dir = runDir(out, run);
    const part = newTextParts(set, "first30")[0];
    const its = partRows(set, part);
    const spec = {
      arm: "A3" as const,
      task: 1 as const,
      subset: "first30" as const,
      part: 1,
      sentences: part,
      model: opus,
      effort: "medium" as const,
    };
    const request = newRequest(spec, data);
    const known = set.plantedKnowns.find((k) =>
      its.some((one) => one.enochian === k.headword),
    );
    expect(known).toBeDefined();
    const items: AnswerItem[] = its.map((one, i) =>
      one.kind === "known"
        ? {
            source: one.enochian,
            target: (
              set.plantedKnowns.find((k) => k.headword === one.enochian) as {
                meaning: string;
              }
            ).meaning,
            basis: "attested",
            ref: one.enochian,
            token: i + 1,
          }
        : {
            source: one.enochian,
            target: "unknown",
            basis: "unknown",
            token: i + 1,
          },
    );
    writeJson(join(dir, "manifest.json"), {
      runId: run,
      kind: "newtext",
      createdAt: "",
      transport: "sync",
      budget: 1,
      projection: 0,
      requests: [manifestRequest(request, { newtext: spec })],
    } satisfies Manifest);
    writeJson(join(dir, "requests", `${request.id}.json`), {
      id: request.id,
      promptHash: "",
      model: opus,
      effort: "medium",
      transport: "sync",
      ok: true,
      finishReason: "stop",
      text: json({ items }),
      tokens: NO_TOKENS,
      cost: 0,
      exact: true,
      attempt: 1,
      at: "",
    });
    const { scored } = scoreNewRequests(
      readJson<Manifest>(join(dir, "manifest.json")) as Manifest,
      dir,
      data,
    );
    const knownRows = scored[0].scores.rows.filter(
      (one) => one.kind === "known",
    );
    expect(knownRows.length).toBeGreaterThan(0);
    for (const one of knownRows) expect(one.outcome).toBe("correct");
    expect(
      scored[0].scores.items.filter((one) => one.check === "invention"),
    ).toEqual([]);
  });
});

// --- Transport and the cache check --------------------------------------------------

describe("cached tokens and the cache check", () => {
  it("count cache reads and writes from usage, raw usage or metadata", () => {
    const usage = (details: object, raw?: object) =>
      ({
        inputTokens: 100,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
          ...details,
        },
        outputTokens: 10,
        outputTokenDetails: { textTokens: 5, reasoningTokens: 5 },
        totalTokens: 110,
        ...(raw ? { raw } : {}),
      }) as Parameters<typeof tokensOf>[0];
    expect(
      tokensOf(usage({ cacheReadTokens: 80, cacheWriteTokens: 0 })),
    ).toMatchObject({
      cached: 80,
      cacheWrite: 0,
    });
    expect(
      tokensOf(
        usage(
          {},
          { cache_read_input_tokens: 70, cache_creation_input_tokens: 20 },
        ),
      ),
    ).toMatchObject({ cached: 70, cacheWrite: 20 });
    expect(
      tokensOf(usage({}), { anthropic: { cacheCreationInputTokens: 90 } }),
    ).toMatchObject({ cached: 0, cacheWrite: 90 });
    expect(
      tokensOf(usage({}), { openai: { cachedPromptTokens: 64 } }),
    ).toMatchObject({ cached: 64 });
    expect(tokensOf(undefined)).toEqual(NO_TOKENS);
  });

  it("mark the reference material as cache breakpoints", () => {
    const settings = callSettings(contextRequest("a"));
    expect(settings.instructions[0]).not.toHaveProperty("providerOptions");
    expect(settings.instructions[1].providerOptions).toEqual(CACHE_BREAKPOINT);
  });

  it("send each prefix's first call alone", async () => {
    const gateway = fakeGateway(() => ({}));
    const requests = ["a", "b", "c", "d"].map((id) => contextRequest(id));
    await runSync(requests, {
      gateway,
      concurrency: 4,
      reserve: () => true,
      prefixOf: cachePrefix,
      onResult: () => {},
    });
    expect(gateway.events.slice(0, 2)).toEqual(["start a", "end a"]);
    // The rest then go together.
    expect(gateway.events.slice(2, 5)).toEqual([
      "start b",
      "start c",
      "start d",
    ]);
  });

  it("projects cost with cache reads and without", () => {
    const requests = ["a", "b", "c"].map((id) => contextRequest(id));
    const sync = cacheProjection(requests, prices, "sync");
    const batch = cacheProjection(requests, prices, "batch");
    expect(sync.withReads).toBeLessThan(sync.without);
    expect(batch.withReads).toBe(batch.without);
    // One write, two reads, of the 2,004-character prefix (1,114 tokens).
    const prefix = Math.ceil(("Say it.".length + 1000) / 1.8);
    const input = prefix + Math.ceil("Now a.".length / 1.8);
    const out = 5000;
    const price = prices.m;
    expect(sync.withReads).toBeCloseTo(
      estimateCost(
        { ...NO_TOKENS, input, cacheWrite: prefix, output: out },
        price,
      ) +
        2 *
          estimateCost(
            { ...NO_TOKENS, input, cached: prefix, output: out },
            price,
          ),
      10,
    );
  });

  it("books both calls, one after the other, with their cached tokens", async () => {
    const out = tempOut();
    const gateway = fakeGateway(
      (_request, call) => ({
        tokens:
          call === 1
            ? {
                ...NO_TOKENS,
                input: 1200,
                cacheWrite: 1100,
                output: 300,
                reasoning: 100,
              }
            : {
                ...NO_TOKENS,
                input: 1200,
                cached: 1100,
                output: 300,
                reasoning: 100,
              },
        generationId: `gen-${call}`,
      }),
      {
        generationInfo: async (id) => ({
          cost: 0.01,
          promptTokens: 1200,
          cachedTokens: id === "gen-2" ? 1100 : 0,
          cacheCreationTokens: id === "gen-1" ? 1100 : 0,
        }),
      },
    );
    const rt = runtime(out, gateway, 4);
    const requests = [contextRequest("a"), contextRequest("b")] as const;
    // Refused before any call when the budget can't hold one call's worst case.
    await expect(
      cacheCheck(rt, {
        run: "cc",
        dir: runDir(out, "cc"),
        requests,
        budget: 0.01,
      }),
    ).rejects.toThrow(/Refused/);
    expect(gateway.calls).toEqual([]);
    const result = await cacheCheck(rt, {
      run: "cc",
      dir: runDir(out, "cc"),
      requests,
      budget: 5,
    });
    expect(gateway.events).toEqual(["start a", "end a", "start b", "end b"]);
    expect(result.calls.map((one) => [one.cached, one.cacheWrite])).toEqual([
      [0, 1100],
      [1100, 0],
    ]);
    expect(result.secondReadShare).toBeCloseTo(1100 / 1200, 10);
    expect(result.reads).toBe(true);
    expect(result.calls[1].generation?.cachedTokens).toBe(1100);
    // Priced from the tokens at the cache prices, the gateway giving none.
    expect(result.calls[0].cost).toBeCloseTo(
      estimateCost(
        { ...NO_TOKENS, input: 1200, cacheWrite: 1100, output: 300 },
        prices.m,
      ),
      10,
    );
    expect(result.calls[1].cost).toBeLessThan(result.calls[0].cost);
    // The ledger: a hold and its settling line for each call, the tokens kept.
    const entries = rt.ledger.entries();
    expect(entries.filter((one) => one.hold)).toHaveLength(2);
    const settled = entries.filter((one) => one.settles);
    expect(settled.map((one) => one.tokens.cached)).toEqual([0, 1100]);
    expect(settled.map((one) => one.tokens.cacheWrite)).toEqual([1100, 0]);
    expect(rt.ledger.total()).toBeCloseTo(
      result.calls[0].cost + result.calls[1].cost,
      10,
    );
    expect(readJson(join(runDir(out, "cc"), "cache-check.json"))).toEqual(
      JSON.parse(JSON.stringify(result)),
    );
  });

  it("calls no reads a fail", async () => {
    const out = tempOut();
    const gateway = fakeGateway(() => ({
      tokens: { ...NO_TOKENS, input: 1200, cacheWrite: 1100, output: 300 },
    }));
    const result = await cacheCheck(runtime(out, gateway), {
      run: "cc",
      dir: runDir(out, "cc"),
      requests: [contextRequest("a"), contextRequest("b")],
      budget: 5,
    });
    expect(result.reads).toBe(false);
    await expect(
      cacheCheck(runtime(out, gateway), {
        run: "cc2",
        dir: runDir(out, "cc2"),
        requests: [contextRequest("a"), contextRequest("b", "D")],
        budget: 5,
      }),
    ).rejects.toThrow(/share their context/);
  });
});

describe("blocked replies", () => {
  it("are retried once, then stand and are counted", async () => {
    const out = tempOut();
    const gateway = fakeGateway((request) => ({
      finishReason:
        request.id === "a" || request.id === "b" ? "content-filter" : "stop",
    }));
    const rt = runtime(out, gateway);
    const dir = runDir(out, "r");
    const requests = ["a", "b", "c"].map((id) => contextRequest(id));
    await execute(rt, {
      run: "r",
      dir,
      requests,
      transport: "sync",
      budget: 10,
    });
    expect(
      await retryBlocked(rt, { run: "r", dir, requests, budget: 10 }),
    ).toEqual(["a", "b"]);
    // Blocked again: no third try.
    expect(
      await retryBlocked(rt, { run: "r", dir, requests, budget: 10 }),
    ).toEqual([]);
    expect(gateway.calls).toEqual(["a", "b", "c", "a", "b"]);
    expect(readRaw(dir, "a")?.attempt).toBe(2);
    // Nor does --retry-failed try them a third time.
    expect(pendingRequests(dir, requests, true)).toEqual([]);
    expect(blockedCalls(dir)).toEqual({
      calls: 5,
      blocked: 4,
      ids: expect.any(Array),
    });
  });
});

// --- The judges on the new text ------------------------------------------------------

describe("the judges on the new text", () => {
  const context = newTextContext(
    withPlantedKnowns(realDictionary, set.plantedKnowns),
    keyRows,
  );
  const swapped = rows.find(
    (one) => one.kind === "swapped" && one.multi,
  ) as NewTextRow;
  const join1 = rows.find((one) => one.kind === "join") as NewTextRow;

  it("show a swapped row every sense, and a join both parts", () => {
    const items: AnswerItem[] = [
      {
        source: swapped.enochian,
        target: "zzz",
        basis: "derived",
        row: swapped.id,
      },
      {
        source: join1.enochian,
        target: "something else",
        basis: "derived",
        row: join1.id,
      },
    ];
    const scores = scoreNewText([swapped, join1], items, 1, context);
    for (const one of scores.rows) one.outcome = "to judge";
    const item = newJudgeCase(
      "x",
      [swapped, join1],
      scores,
      withPlantedKnowns(realDictionary, set.plantedKnowns),
      keyRows,
    );
    const [s, j] = item.rows;
    expect(s.senses).toEqual(swapped.glosses);
    expect(j.join?.small).toBe(join1.join?.small);
    expect(j.join?.english).toBe(join1.join?.english);
    const request = newJudgeRequest(item, "opus");
    expect(request.instructions).toEqual([NEW_JUDGE_INSTRUCTIONS]);
    expect(request.prompt).toContain('"senses"');
    expect(request.prompt).toContain('"join"');
    expect(NEW_JUDGE_INSTRUCTIONS).toMatch(/every English Dee gives this word/);
    expect(NEW_JUDGE_INSTRUCTIONS).toMatch(/renders both parts/);
  });

  it("keep different questions apart in the verdict store", () => {
    const base: JudgeRow = {
      row: "S01.01",
      enochian: "OL",
      dee: "I",
      answer: "I",
      meanings: [],
    };
    const keys = new Set([
      verdictKey(base),
      verdictKey({ ...base, question: JSON.stringify(["newtext", "OL", "I"]) }),
      verdictKey({
        ...base,
        question: JSON.stringify(["newtext", "SONF", "reign"]),
      }),
      verdictKey({ ...base, question: "task3-rubric" }),
      verdictKey({
        ...base,
        row: `${base.row}-rt`,
        question: "task3-roundtrip",
      }),
    ]);
    expect(keys.size).toBe(5);
    // Without a question, a fold's key is as it was.
    expect(verdictKey(base)).toBe(["S01.01", "i", "", ""].join("\t"));
  });

  it("go through the run's judges with the new request", async () => {
    const out = tempOut();
    const part = newTextParts(set, "all")[0];
    const its = partRows(set, part);
    const scores: NewScores = scoreNewText(
      its,
      its.map((one, i) => ({
        source: one.enochian,
        target: "a vague thing",
        basis: "derived",
        token: i + 1,
      })),
      1,
      context,
    );
    const toJudge = scores.rows.filter(
      (one) => one.outcome === "to judge",
    ).length;
    expect(toJudge).toBeGreaterThan(0);
    const cases = newRunJudgeCases(
      [
        {
          id: "N-A3-t1-all-p01-opus-medium",
          spec: {
            arm: "A3",
            task: 1,
            subset: "all",
            part: 1,
            sentences: part,
            model: opus,
            effort: "medium",
          },
          scores,
        },
      ],
      data,
    );
    expect(cases[0].rows).toHaveLength(toJudge);
    const gateway = fakeGateway((request) => ({
      text: json({
        verdicts: cases[0].rows.map((one) => ({
          row: one.row,
          verdict: request.model === MODELS.opus ? "same" : "different",
          reason: "r",
        })),
      }),
    }));
    const result = await runJudges(runtime(out, gateway), {
      run: "j",
      dir: join(out, "judge"),
      cases,
      existing: {},
      budget: 10,
      source: "x",
      request: newJudgeRequest,
    });
    expect(gateway.calls.sort()).toEqual([
      "N-A3-t1-all-p01-opus-medium_judge-gpt",
      "N-A3-t1-all-p01-opus-medium_judge-opus",
    ]);
    const judged = Object.values(result.judged["N-A3-t1-all-p01-opus-medium"]);
    expect(judged.every((one) => one.outcome === "split")).toBe(true);
  });
});

// --- Task 3 -------------------------------------------------------------------------

describe("task 3's damaged controls", () => {
  const sentences = task3;
  const a1 = a1Task3(sentences, realDictionary, keyRows);
  const a1Candidates = sentences.map((one) =>
    candidate("A1", one, a1.get(one.id) ?? []),
  );
  const controls = damagedControls(a1Candidates, {
    dictionary: realDictionary,
    rows: keyRows,
  });

  it("are 15, a third of each kind, each of another sentence, by seed", () => {
    expect(controls).toHaveLength(15);
    for (const damage of DAMAGES)
      expect(controls.filter((one) => one.damage === damage)).toHaveLength(5);
    expect(new Set(controls.map((one) => one.sentence)).size).toBe(15);
    expect(
      damagedControls(a1Candidates, {
        dictionary: realDictionary,
        rows: keyRows,
      }),
    ).toEqual(controls);
    expect(
      damagedControls(
        a1Candidates,
        { dictionary: realDictionary, rows: keyRows },
        78,
      ),
    ).not.toEqual(controls);
  });

  it("are damaged as they say", () => {
    const headwords = new Set(Object.keys(realDictionary));
    for (const one of controls) {
      const from = a1Candidates.find(
        (a) => a.sentence === one.sentence,
      ) as Task3Candidate;
      expect(translationText(one.items)).not.toBe(translationText(from.items));
      if (one.damage === "dropped clause")
        expect(one.items.length).toBeLessThanOrEqual(from.items.length - 2);
      else {
        expect(one.items).toHaveLength(from.items.length);
        const changed = one.items.filter(
          (item, i) => item.target !== from.items[i].target,
        );
        expect(changed).toHaveLength(1);
        expect(changed[0].basis).toBe("attested");
        expect(headwords.has(changed[0].target)).toBe(
          one.damage === "wrong word",
        );
      }
    }
  });

  it("go in blind: same ids, shuffled, never beside their own sentence", () => {
    const pool = [...a1Candidates, ...controls];
    for (const one of pool) expect(one.id).toMatch(/^c[0-9a-f]{10}$/);
    expect(new Set(pool.map((one) => one.id)).size).toBe(pool.length);
    const cases = rubricCases(pool, keyRows);
    expect(cases.flatMap((one) => one.rows)).toHaveLength(pool.length);
    expect(rubricCases(pool, keyRows)).toEqual(cases);
    const isControl = new Set(controls.map((one) => one.id));
    const where: number[] = [];
    for (const item of cases) {
      const sentenceOf = item.rows.map(
        (one) => pool.find((p) => p.id === one.row)?.sentence,
      );
      expect(new Set(sentenceOf).size).toBe(sentenceOf.length);
      item.rows.forEach((one, i) => {
        if (isControl.has(one.row)) where.push(i);
      });
      const request = rubricRequest({ dictionary: realDictionary, grammar })(
        item,
        "gpt",
      );
      expect(request.prompt).not.toMatch(
        /\b(?:control|damage|wrong word|coinage|dropped)/i,
      );
      expect(request.prompt).not.toMatch(/\bA1\b/);
      expect(request.id).toMatch(/^T3J-[0-9a-f]{10}_judge-gpt$/);
    }
    // Controls sit in several places, not one.
    expect(new Set(where).size).toBeGreaterThan(3);
    // Controls aren't all in the first or last case.
    expect(dealCases(pool, 15).length).toBe(cases.length);
  });
});

describe("task 3's scoring", () => {
  const sentences: Task3Sentence[] = [
    { id: "T01", kind: "x", english: "I am the earth" },
    { id: "T02", kind: "x", english: "be friendly unto me" },
    { id: "T03", kind: "x", english: "God of the earth" },
  ];
  const keyRowsFixture = [
    row(1, 1, "OL", "I"),
    row(1, 2, "CAOSG", "the earth"),
  ];
  const a1 = a1Task3(sentences, fixtureDictionary, keyRowsFixture);
  const item = (target: string, source: string, ref?: string): AnswerItem => ({
    source,
    target,
    basis: ref ? "attested" : "coined",
    ...(ref ? { ref } : {}),
  });

  it("counts judged accepts, round trips and attested forms per source", () => {
    const model = [
      candidate("run:A3 opus medium", sentences[0], [
        item("OL", "I", "OL"),
        item("CAOSG", "earth", "CAOSG"),
      ]),
      candidate("run:A3 opus medium", sentences[1], [
        item("ZORGE", "be friendly unto me", "ZORGE"),
      ]),
      // An invention: cited as attested, in no entry.
      candidate("run:A3 opus medium", sentences[2], [
        item("IADX", "God", "IADX"),
        item("CAOSG", "earth", "CAOSG"),
      ]),
    ];
    const a1Candidates = sentences.map((one) =>
      candidate("A1", one, a1.get(one.id) ?? []),
    );
    const controls = [0, 1, 2, 3].map((i) => ({
      ...candidate(`control-${i}`, sentences[i % 3], [item("OL", "I", "OL")]),
      damage: "wrong word" as const,
      of: a1Candidates[i % 3].id,
    }));
    const all = [...model, ...a1Candidates, ...controls];
    const verdict = (
      one: Task3Candidate,
      outcome: "correct" | "rejected" | "split",
    ) => [one.id, { answer: translationText(one.items), outcome }] as const;
    const rubric = new Map([
      verdict(model[0], "correct"),
      verdict(model[1], "split"),
      verdict(model[2], "rejected"),
      ...a1Candidates.map((one) => verdict(one, "correct")),
      ...controls.map((one) => verdict(one, "correct")),
    ]);
    const trips = new Map(all.map((one) => [one.id, `back ${one.id}`]));
    const roundTrip = new Map(
      all.map((one, i) => [
        `${one.id}-rt`,
        {
          answer: `back ${one.id}`,
          outcome: i % 2 ? ("correct" as const) : ("rejected" as const),
        },
      ]),
    );
    const report = task3Report({
      candidates: all,
      sentences,
      rubric,
      roundTrip,
      roundTrips: trips,
      a1,
      dictionary: fixtureDictionary,
      keyRows: keyRowsFixture,
    });
    const a3 = report.sources["run:A3 opus medium"];
    expect(a3.accepted).toEqual(share(1, 3));
    expect(a3.split).toBe(1);
    expect(a3.waiting).toBe(0);
    expect(a3.silentInventions).toBe(1);
    expect(a3.items).toBe(5);
    expect(report.sources.A1.accepted.count).toBe(3);
    expect(report.sources.A1.attestedForms.share).toBe(1);
    expect(a3.attestedForms.count).toBeLessThan(
      report.sources.A1.attestedForms.count + 1,
    );
    expect(report.controls).toMatchObject({
      count: 4,
      counted: 4,
      accepted: 4,
      unmeasurable: expect.stringMatching(/only 4/),
    });
    // A missing translation counts against its source; a verdict on another
    // translation of the sentence doesn't apply.
    const lost = task3Report({
      candidates: [
        { ...model[0], items: [item("OL", "I", "OL")] },
        { ...model[1], missing: "blocked twice" },
      ],
      sentences,
      rubric,
      roundTrip,
      roundTrips: trips,
      a1,
      dictionary: fixtureDictionary,
      keyRows: keyRowsFixture,
    }).sources["run:A3 opus medium"];
    expect(lost.accepted.count).toBe(0);
    expect(lost.missing).toBe(2);
    expect(lost.waiting).toBe(1);
  });

  it("reads the judges' replies and round trips", () => {
    const rubric = parseRubricVerdicts(
      json({
        verdicts: [
          { row: "c1", verdict: "accept", reason: "ok" },
          { row: "c2", verdict: "reject" },
        ],
      }),
    );
    expect(rubric.verdicts.get("c1")?.verdict).toBe("same");
    expect(rubric.verdicts.get("c2")?.verdict).toBe("different");
    expect(parseRubricVerdicts("no block").error).toMatch(/json/);
    expect(
      parseRoundTrip(
        json({ sentences: [{ id: "c1", english: "I am" }] }),
      ).english.get("c1"),
    ).toBe("I am");
  });

  it("round-trips each translation once, and only the one asked about", () => {
    const out = tempOut();
    const one = candidate("A1", sentences[0], a1.get("T01") ?? []);
    const other = { ...candidate("A1", sentences[1], a1.get("T02") ?? []) };
    const run = "rt";
    const dir = runDir(out, run);
    const spec = {
      part: 1,
      input: [
        { id: one.id, enochian: translationText(one.items) },
        { id: other.id, enochian: "SOMETHING ELSE" },
      ],
      model: opus,
      effort: "medium" as const,
    };
    const request = roundTripRequest(spec, fixtureDictionary);
    writeJson(join(dir, "manifest.json"), {
      runId: run,
      kind: "roundtrip",
      createdAt: "",
      transport: "sync",
      budget: 1,
      projection: 0,
      requests: [manifestRequest(request, { roundtrip: spec })],
    } satisfies Manifest);
    writeJson(join(dir, "requests", `${request.id}.json`), {
      id: request.id,
      ok: true,
      finishReason: "stop",
      text: json({
        sentences: [
          { id: one.id, english: "I the earth" },
          { id: other.id, english: "x" },
        ],
      }),
      tokens: NO_TOKENS,
      attempt: 1,
    });
    expect(mergeRoundTrips(out, run, [one, other])).toEqual({
      added: 1,
      left: [other.id],
    });
    const store = readJson<RoundTripStore>(
      roundTripStorePath(out),
    ) as RoundTripStore;
    expect(store[roundTripKey(one)]).toEqual({ english: "I the earth", run });
    const cases = roundTripCases(
      [one, other],
      new Map([[one.id, "I the earth"]]),
    );
    expect(cases.flatMap((c) => c.rows.map((r) => r.row))).toEqual([
      `${one.id}-rt`,
    ]);
  });

  it("builds a pool of A1, the controls and the task-3 runs", () => {
    const out = tempOut();
    const pool = task3Pool(out, data, []);
    expect(pool.candidates.filter((one) => one.source === "A1")).toHaveLength(
      60,
    );
    expect(pool.candidates.filter((one) => one.damage)).toHaveLength(15);
    expect(blindId("A1", "T01")).not.toBe(blindId("A1", "T02"));
  });
});

// --- Bars ---------------------------------------------------------------------------

/** A report of some rows, each with an outcome. */
function reportOf(
  list: [NewRowScore["kind"], string, number, boolean?][],
): NewTextReport {
  const rowsOut: NewRowScore[] = [];
  for (const [kind, outcome, n, multi] of list)
    for (let i = 0; i < n; i++)
      rowsOut.push({
        id: `${kind}${outcome}${i}`,
        sentence: "S01",
        kind,
        multi: Boolean(multi),
        gdSpelling: false,
        outcome: outcome as NewRowScore["outcome"],
      });
  return newReport({ task: 1, rows: rowsOut, items: [] });
}

describe("the new text's bars", () => {
  const a3 = reportOf([
    ["unchanged", "correct", 370],
    ["unchanged", "rejected", 10],
    ["swapped", "correct", 108],
    ["swapped", "recalled", 6],
    ["swapped", "split", 6],
    ["plant", "unknown", 36],
    ["plant", "attested", 4],
    ["known", "correct", 18],
    ["known", "unknown", 2],
    ["join", "correct", 31],
    ["join", "rejected", 9],
  ]);
  const a1k = reportOf([
    ["unchanged", "correct", 375],
    ["unchanged", "rejected", 5],
    ["swapped", "correct", 117],
    ["swapped", "rejected", 3],
  ]);
  const a0 = reportOf([
    ["swapped", "correct", 60],
    ["swapped", "rejected", 60],
    ["known", "correct", 1],
    ["known", "unknown", 19],
  ]);

  it("measure each bar as a count with its line, met and marginal", () => {
    const { bars, a3MinusA0Swapped } = measureNewTextBars({
      a3Task1: a3,
      a3Task2: a3,
      a0Task1: a0,
      a1kTask1: a1k,
      a1kTask2: a1k,
      blocked: { calls: 40, blocked: 2 },
    });
    const by = Object.fromEntries(bars.map((one) => [one.id, one]));
    // A3 478 of 500; A1k 492 of 500 less 2 points: 482 rows. Not met.
    expect(by.toEnglish.measured).toEqual(share(478, 500));
    expect(by.toEnglish.line).toBeCloseTo(482, 6);
    expect(by.toEnglish.met).toBe(false);
    expect(by.toEnglish.marginal).toBe(false);
    // Swapped 108 of 120: exactly the bar, met and marginal.
    expect(by.swappedRight).toMatchObject({ met: true, marginal: true });
    expect(by.recalled).toMatchObject({ met: true, marginal: true });
    expect(by.plantFailures1).toMatchObject({ met: true, marginal: true });
    expect(by.knownsRight).toMatchObject({ met: true, marginal: true });
    // 31 of 40 joins: under 32, within one row.
    expect(by.joinsRight).toMatchObject({ met: false, marginal: true });
    expect(by.blocked).toMatchObject({ met: true, line: 2 });
    expect(by.task3Accept.unmeasurable).toMatch(/no task 3/);
    // A3 − A0 on swapped rows, with Newcombe's interval around it.
    expect(a3MinusA0Swapped?.difference).toBeCloseTo(0.9 - 0.5, 10);
    const [low, high] = a3MinusA0Swapped?.interval ?? [0, 0];
    expect(low).toBeLessThan(0.4);
    expect(high).toBeGreaterThan(0.4);
    expect(bars.map((one) => one.id)).toEqual([
      "toEnglish",
      "toEnochian",
      "swappedRight",
      "recalled",
      "plantFailures1",
      "plantFailures2",
      "knownsRight",
      "joinsRight",
      "silentInventions1",
      "silentInventions2",
      "silentInventions3",
      "task3Accept",
      "task3RoundTrip",
      "task3AttestedForms",
      "blocked",
    ]);
  });

  it("take their values from the caller", () => {
    const { bars } = measureNewTextBars(
      { a3Task1: a3, a1kTask1: a1k },
      { toEnglishMargin: 0.05, joinsRight: 0.75 },
    );
    const by = Object.fromEntries(bars.map((one) => [one.id, one]));
    expect(by.toEnglish.met).toBe(true);
    expect(by.joinsRight.met).toBe(true);
    expect(() => barValues({ nonsense: 1 } as never)).toThrow(/not a bar/);
    expect(barValues()).toEqual(PROPOSED_NEW_BARS);
  });

  it("refuse rows still waiting for the judges, and failed controls", () => {
    const waiting = reportOf([
      ["unchanged", "to judge", 3],
      ["unchanged", "correct", 10],
    ]);
    const { bars } = measureNewTextBars({
      a3Task1: waiting,
      a1kTask1: a1k,
      a0Task1: a0,
      task3: {
        a3: {
          sentences: 60,
          accepted: share(50, 60),
          roundTrip: share(50, 60),
          attestedForms: share(95, 100),
          waiting: 0,
          roundTripWaiting: 0,
          missing: 0,
          silentInventions: 0,
          items: 500,
          agreed: 60,
          split: 0,
        },
        a1: {
          sentences: 60,
          accepted: share(30, 60),
          roundTrip: share(55, 60),
          attestedForms: share(100, 100),
          waiting: 0,
          roundTripWaiting: 0,
          missing: 0,
          silentInventions: 0,
          items: 400,
          agreed: 60,
          split: 0,
        },
        controlsUnmeasurable:
          "the judges accepted 4 of 15 damaged controls, more than a fifth",
      },
    });
    const by = Object.fromEntries(bars.map((one) => [one.id, one]));
    expect(by.toEnglish.unmeasurable).toMatch(/3 rows still waiting/);
    expect(by.swappedRight.unmeasurable).toMatch(/waiting/);
    expect(by.task3Accept.unmeasurable).toMatch(/damaged controls/);
    expect(by.task3AttestedForms).toMatchObject({ met: true });
  });

  it("put the round trip's line at two thirds or A1 less 10 points", () => {
    const figures = (accepted: number, kept: number) => ({
      sentences: 60,
      accepted: share(accepted, 60),
      roundTrip: share(kept, 60),
      attestedForms: share(1, 1),
      waiting: 0,
      roundTripWaiting: 0,
      missing: 0,
      silentInventions: 0,
      items: 100,
      agreed: 60,
      split: 0,
    });
    const { bars } = measureNewTextBars({
      task3: { a3: figures(45, 50), a1: figures(30, 60), controlsWaiting: 0 },
    });
    const by = Object.fromEntries(bars.map((one) => [one.id, one]));
    // A1 50% + 15 points = 65% of 60 = 39; A3 45: met.
    expect(by.task3Accept).toMatchObject({ met: true });
    expect(by.task3Accept.line).toBeCloseTo(39, 6);
    // A1 100% − 10 points = 90% of 60 = 54, above two thirds; A3 50: not met.
    expect(by.task3RoundTrip.line).toBeCloseTo(54, 6);
    expect(by.task3RoundTrip.met).toBe(false);
    expect(difference(share(1, 2), share(1, 2)).difference).toBe(0);
  });
});

describe("offline prices", () => {
  it("follow the plan: a cached read at a twentieth, batch at half", () => {
    const list = planPriceList([MODELS.fable, MODELS.gpt]);
    expect(Number(list[MODELS.fable].input)).toBeCloseTo(8e-6, 15);
    expect(Number(list[MODELS.fable].input_cache_read)).toBeCloseTo(4e-7, 15);
    expect(Number(list[`${MODELS.gpt}-batch`].output)).toBeCloseTo(5e-6, 15);
    expect(list[MODELS.gpt].input_cache_write).toBeUndefined();
    expect(() => planPriceList(["x/y"])).toThrow(/no price/);
  });
});
