import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bookedAt,
  callCosts,
  EXPERIMENT_CAP_USD,
  estimateCost,
  Ledger,
  type LedgerEntry,
  LISTED_PRICES,
  ledgerCap,
  NO_TOKENS,
  type PriceList,
  planPriceList,
  projectCost,
  STAGE2,
  worstCost,
} from "./ledger.ts";
import {
  CACHING,
  expectsReasoning,
  MODELS,
  type ModelName,
  modelId,
  STAGE2_MODELS,
  shortName,
} from "./models.ts";
import { type NewSpec, newRequestId } from "./newprompt.ts";
import { blockedRuns, runRequestKeys } from "./newrunner.ts";
import {
  earlierRuns,
  execute,
  ledgerPath,
  type Manifest,
  type ManifestRequest,
  manifestRequest,
  noReasoningReplies,
  type RawResult,
  type Runtime,
  readRaw,
  repeatCheck,
  runDir,
  runRefusal,
  writeJson,
} from "./runner.ts";
import {
  CACHE_BREAKPOINT,
  callSettings,
  type Gateway,
  type ModelRequest,
} from "./transport.ts";

/**
 * Plan 081's stage 2: cheaper models on plan 077's tasks 1 and 2, arm A3, in
 * the same ledger under a cap of its own.
 */

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function tempOut() {
  const dir = mkdtempSync(join(tmpdir(), "translate-eval-stage2-"));
  dirs.push(dir);
  return dir;
}

const entry = (cost: number, at: string, id = at): LedgerEntry => ({
  id,
  at,
  run: "r",
  request: "x",
  model: "m",
  transport: "sync",
  tokens: NO_TOKENS,
  cost,
  exact: true,
});

describe("the stage-2 models", () => {
  it("are known by short names, plan 077's unchanged", () => {
    expect(modelId("opus")).toBe("anthropic/claude-opus-5.5");
    expect(modelId("fable")).toBe("anthropic/claude-fable-5.2");
    expect(modelId("gpt")).toBe("openai/gpt-6.1-sol");
    expect(modelId("sonnet")).toBe("anthropic/claude-sonnet-5.5");
    expect(modelId("haiku")).toBe("anthropic/claude-haiku-5.5");
    expect(modelId("gpt-terra")).toBe("openai/gpt-6.1-terra");
    expect(modelId("gpt-luna")).toBe("openai/gpt-6-luna");
    expect(modelId("gemini-flash")).toBe("google/gemini-3.8-flash");
    expect(() => modelId("terra")).toThrow(/--model must be one of/);
    for (const [name, id] of Object.entries(MODELS))
      expect(shortName(id)).toBe(name);
  });

  it("are all listed, with a caching path and an offline price each", () => {
    expect(STAGE2_MODELS).toEqual([
      "sonnet",
      "haiku",
      "gpt-terra",
      "gpt-luna",
      "gemini-flash",
      "opus",
    ]);
    for (const id of Object.values(MODELS)) {
      expect(CACHING[id]).toMatch(/^(explicit|implicit)$/);
      expect(planPriceList([id])[id].input).toBeTruthy();
    }
    expect(CACHING["google/gemini-3.8-flash"]).toBe("implicit");
  });

  it("give request ids by their short names", () => {
    const spec: NewSpec = {
      arm: "A3",
      task: 1,
      subset: "all",
      part: 3,
      sentences: ["S01"],
      model: MODELS["gemini-flash"],
      effort: "medium",
    };
    expect(newRequestId(spec)).toBe("N-A3-t1-all-p03-gemini-flash-medium");
  });

  it("send the same settings as Opus: portable medium reasoning, breakpoints on the material", () => {
    for (const name of STAGE2_MODELS) {
      const settings = callSettings({
        id: "a",
        kind: "translate",
        model: MODELS[name as ModelName],
        effort: "medium",
        instructions: ["rules", "context", "grammar"],
        prompt: "Translate.",
      });
      expect(settings.reasoning).toBe("medium");
      expect(settings.maxOutputTokens).toBe(32_000);
      expect(settings.instructions.map((one) => one.providerOptions)).toEqual([
        undefined,
        CACHE_BREAKPOINT,
        CACHE_BREAKPOINT,
      ]);
    }
  });
});

describe("the listed prices (15 November 2026)", () => {
  it("are the gateway's rows, batch only where it lists one", () => {
    const list = planPriceList([
      MODELS.sonnet,
      MODELS["gpt-terra"],
      MODELS["gemini-flash"],
    ]);
    expect(list[MODELS.sonnet]).toBe(LISTED_PRICES[MODELS.sonnet]);
    expect(list[`${MODELS.sonnet}-batch`]).toBeDefined();
    expect(list[`${MODELS["gpt-terra"]}-batch`]).toBeUndefined();
    expect(list[`${MODELS["gemini-flash"]}-batch`]).toBeUndefined();
    expect(list[MODELS["gemini-flash"]].input_cache_write).toBeUndefined();
    // Plan 077's own models keep plan 077's offline prices.
    const opus = planPriceList([MODELS.opus])[MODELS.opus];
    expect(Number(opus.input_cache_read)).toBeCloseTo(2e-7, 15);
  });

  it("price Haiku by its tier: fivefold from 100,001 input tokens", () => {
    const haiku = LISTED_PRICES[MODELS.haiku];
    const at = (input: number) =>
      estimateCost({ ...NO_TOKENS, input, output: 1000 }, haiku);
    expect(at(90_000)).toBeCloseTo(90_000 * 1e-7 + 1000 * 5e-7, 12);
    expect(at(110_000)).toBeCloseTo(110_000 * 5e-7 + 1000 * 2.5e-6, 12);
  });

  it("price a Gemini cache write as plain input: none is listed", () => {
    const flash = LISTED_PRICES[MODELS["gemini-flash"]];
    expect(
      estimateCost({ ...NO_TOKENS, input: 1000, cacheWrite: 1000 }, flash),
    ).toBeCloseTo(1000 * 7.5e-7, 12);
    expect(
      estimateCost({ ...NO_TOKENS, input: 1000, cached: 1000 }, flash),
    ).toBeCloseTo(1000 * 7.5e-8, 12);
  });
});

describe("the stage-2 cap", () => {
  it("lets stage 2 add its own share to what was booked before it", () => {
    const before = entry(25.74, "2026-11-13T08:00:00.000Z");
    expect(ledgerCap([before])).toEqual({
      cap: 25.74 + STAGE2.capUsd,
      before: 25.74,
      since: 0,
    });
    const after = ledgerCap([before, entry(4, "2026-11-15T19:00:00.000Z")]);
    expect(after.cap).toBeCloseTo(40.74, 10);
    expect(after.since).toBe(4);
    // Never past the experiment's.
    expect(ledgerCap([entry(95, "2026-11-13T00:00:00.000Z")]).cap).toBe(
      EXPERIMENT_CAP_USD,
    );
  });

  it("refuses a run that would take stage 2 past it", async () => {
    const out = tempOut();
    const ledger = new Ledger(ledgerPath(out));
    ledger.append(entry(25.74, "2026-11-13T08:00:00.000Z", "a"));
    ledger.append(entry(14, "2026-11-15T19:00:00.000Z", "b"));
    const prices: PriceList = { m: { input: "0.000004", output: "0.00002" } };
    const calls: string[] = [];
    const gateway = {
      generate: async (request: ModelRequest) => {
        calls.push(request.id);
        throw new Error("no call expected");
      },
    } as unknown as Gateway;
    const runtime: Runtime = {
      out,
      gateway,
      prices,
      ledger,
      log: () => {},
      cap: ledgerCap(ledger.entries()).cap,
    };
    // Expected $0.10 (5,000 tokens out at $20 a million), worst $0.64.
    const request: ModelRequest = {
      id: "j",
      kind: "judge",
      model: "m",
      effort: "medium",
      instructions: ["Say it."],
      prompt: "Now.",
    };
    // $1.00 of stage 2 left: the expected fits, so the check passes.
    expect(runRefusal(runtime, [request], "sync", 5)).toBeUndefined();
    // Under plan 077's cap alone, $14 more would still fit; under stage 2's,
    // the dearest call's worst case doesn't.
    ledger.append(entry(0.5, "2026-11-15T20:00:00.000Z", "c"));
    runtime.cap = ledgerCap(ledger.entries()).cap;
    expect(runRefusal(runtime, [request], "sync", 5)).toMatch(
      /worst case .* cap of \$40\.74/,
    );
    await expect(
      execute(runtime, {
        run: "r",
        dir: runDir(out, "r"),
        requests: [request],
        transport: "sync",
        budget: 5,
      }),
    ).rejects.toThrow(/cap/);
    expect(calls).toEqual([]);
    // Under plan 077's cap, as its runs had it, it would run.
    expect(
      runRefusal({ ...runtime, cap: EXPERIMENT_CAP_USD }, [request], "sync", 5),
    ).toBeUndefined();
    // A runtime with no cap fails closed, never falls back to $100.
    for (const cap of [undefined, Number.NaN, 0])
      expect(
        runRefusal(
          { ...runtime, cap: cap as unknown as number },
          [request],
          "sync",
          5,
        ),
      ).toMatch(/no cap set/);
  });

  it("counts an entry made exactly at its start as the stage's", () => {
    const at = ledgerCap([
      entry(10, "2026-11-13T23:59:59.999Z", "a"),
      entry(2, STAGE2.from, "b"),
    ]);
    expect(at).toEqual({ cap: 10 + STAGE2.capUsd, before: 10, since: 2 });
  });

  it("dates a late correction by the entry it corrects", () => {
    // A call held just before the stage, settled and then reconciled after
    // it: all three count before. A stage-2 call reconciled counts since.
    const hold = { ...entry(1, "2026-11-13T23:59:59.000Z", "h"), hold: true };
    const settle = {
      ...entry(-0.4, "2026-11-14T00:00:05.000Z", "s"),
      settles: "h",
      actual: 0.6,
      unknown: true,
    };
    const fix = {
      ...entry(-0.5, "2026-11-15T10:00:00.000Z", "f"),
      reconciles: "s",
    };
    const late = entry(3, "2026-11-15T11:00:00.000Z", "l");
    const lateFix = {
      ...entry(-1, "2026-11-16T09:00:00.000Z", "lf"),
      reconciles: "l",
    };
    const result = ledgerCap([hold, settle, fix, late, lateFix]);
    expect(result.before).toBeCloseTo(0.1, 10);
    expect(result.since).toBeCloseTo(2, 10);
    expect(bookedAt([hold, settle, fix])(fix)).toBe(hold.at);
    // A correction of an entry not in the ledger keeps its own date.
    const orphan = {
      ...entry(1, "2026-11-15T00:00:00.000Z", "o"),
      reconciles: "x",
    };
    expect(bookedAt([orphan])(orphan)).toBe(orphan.at);
  });
});

describe("offline projections on tiered prices", () => {
  it("price the output at the tier the input falls in", () => {
    const haiku = LISTED_PRICES[MODELS.haiku];
    // 110,000 input tokens at 1.8 characters a token: Haiku's upper tier,
    // fivefold, for the output too.
    const big = {
      kind: "translate" as const,
      effort: "medium" as const,
      chars: 110_000 * 1.8,
    };
    expect(projectCost(big, haiku)).toBeCloseTo(
      110_000 * 5e-7 + 12_000 * 2.5e-6,
      10,
    );
    expect(worstCost(big, haiku)).toBeCloseTo(
      110_000 * 5e-7 + 32_000 * 2.5e-6,
      10,
    );
    // As a cache write (sync), still at the upper tier.
    expect(projectCost(big, haiku, true)).toBeCloseTo(
      110_000 * 6.25e-7 + 12_000 * 2.5e-6,
      10,
    );
    // Below the line, the lower tier, as before.
    const small = { ...big, chars: 50_000 * 1.8 };
    expect(projectCost(small, haiku)).toBeCloseTo(
      50_000 * 1e-7 + 12_000 * 5e-7,
      10,
    );
    // A flat price is unchanged.
    const opus = planPriceList([MODELS.opus])[MODELS.opus];
    expect(projectCost(big, opus)).toBeCloseTo(
      110_000 * 4e-6 + 12_000 * 2e-5,
      10,
    );
  });
});

describe("a run repeated", () => {
  const request = (id: string, prompt: string): ModelRequest => ({
    id,
    kind: "translate",
    model: MODELS.sonnet,
    effort: "medium",
    instructions: ["rules", "context"],
    prompt,
  });

  it("is found by an earlier run of its kind with the same requests", () => {
    const out = tempOut();
    const earlier = [request("p01", "one"), request("p02", "two")];
    writeJson(join(runDir(out, "20261115-a"), "manifest.json"), {
      runId: "20261115-a",
      kind: "newtext",
      createdAt: "",
      transport: "sync",
      budget: 1,
      projection: 0,
      requests: earlier.map((one) => manifestRequest(one)),
    });
    // The cache check holds the same first calls, but is another kind.
    writeJson(join(runDir(out, "20261115-b"), "manifest.json"), {
      runId: "20261115-b",
      kind: "cache-check",
      createdAt: "",
      transport: "sync",
      budget: 1,
      projection: 0,
      requests: earlier.map((one) => manifestRequest(one)),
    });
    expect(earlierRuns(out, "newtext", earlier)).toEqual([
      { run: "20261115-a", ids: ["p01", "p02"] },
    ]);
    // A changed prompt (the dictionary, say) is a new request.
    expect(
      earlierRuns(out, "newtext", [
        request("p01", "one, changed"),
        request("p02", "two"),
      ]),
    ).toEqual([{ run: "20261115-a", ids: ["p02"] }]);
    expect(earlierRuns(out, "newtext", [request("p01", "new")])).toEqual([]);
    expect(earlierRuns(out, "task3", earlier)).toEqual([]);
    expect(earlierRuns(tempOut(), "newtext", earlier)).toEqual([]);
  });

  it("refuses, skips what is held (--skip-held) or repeats all (--again)", () => {
    const out = tempOut();
    const all = [
      request("p01", "one"),
      request("p02", "two"),
      request("p03", "three"),
    ];
    writeJson(join(runDir(out, "20261115-a"), "manifest.json"), {
      runId: "20261115-a",
      kind: "newtext",
      createdAt: "",
      transport: "sync",
      budget: 1,
      projection: 0,
      requests: all.slice(0, 2).map((one) => manifestRequest(one)),
    });
    const plain = repeatCheck(out, "newtext", all);
    expect(plain.requests).toHaveLength(3);
    expect(plain.refusal).toMatch(
      /20261115-a already has 2 of these 3 requests.*--skip-held.*--again/,
    );
    const skip = repeatCheck(out, "newtext", all, { skipHeld: true });
    expect(skip.refusal).toBeUndefined();
    expect(skip.requests.map((one) => one.id)).toEqual(["p03"]);
    expect(skip.held).toEqual([{ run: "20261115-a", ids: ["p01", "p02"] }]);
    const again = repeatCheck(out, "newtext", all, { again: true });
    expect(again).toEqual({ requests: all, held: [] });
    expect(() =>
      repeatCheck(out, "newtext", all, { again: true, skipHeld: true }),
    ).toThrow(/can't be used together/);
    // All held: nothing to send, refused.
    expect(
      repeatCheck(out, "newtext", all.slice(0, 2), { skipHeld: true }).refusal,
    ).toMatch(/hold all 2 .* nothing left to run/);
    // Nothing held: no refusal either way.
    expect(repeatCheck(out, "task3", all).refusal).toBeUndefined();
  });
});

describe("a sync reply with no reasoning tokens", () => {
  const reply = (reasoning: number) =>
    ({
      generate: async (request: ModelRequest) => ({
        id: request.id,
        ok: true,
        text: "",
        finishReason: "stop",
        tokens: { ...NO_TOKENS, input: 100, output: 50, reasoning },
        gatewayCost: "0.001",
      }),
      generationCost: async () => undefined,
    }) as unknown as Gateway;

  async function runOne(model: string, reasoning: number) {
    const out = tempOut();
    const logged: string[] = [];
    const runtime: Runtime = {
      out,
      gateway: reply(reasoning),
      prices: {
        [model]: { input: "0.000001", output: "0.000005" },
      },
      ledger: new Ledger(ledgerPath(out)),
      log: (text) => logged.push(text),
      cap: EXPERIMENT_CAP_USD,
      concurrency: 1,
    };
    const dir = runDir(out, "r");
    await execute(runtime, {
      run: "r",
      dir,
      requests: [
        {
          id: "q",
          kind: "translate",
          model,
          effort: "medium",
          instructions: ["Say it."],
          prompt: "Now.",
        },
      ],
      transport: "sync",
      budget: 5,
    });
    return { raw: readRaw(dir, "q"), logged };
  }

  it("is kept but flagged, with a warning, for a model expected to reason", async () => {
    expect(expectsReasoning(MODELS.sonnet)).toBe(true);
    const { raw, logged } = await runOne(MODELS.sonnet, 0);
    expect(raw).toMatchObject({ ok: true, noReasoning: true });
    expect(logged.join("\n")).toMatch(
      /WARNING: q: anthropic\/claude-sonnet-5\.5 reported no reasoning tokens/,
    );
  });

  it("is found from its tokens, flag or none (replies saved before it)", async () => {
    const { raw } = await runOne(MODELS.sonnet, 0);
    const out = tempOut();
    const dir = runDir(out, "old");
    const { noReasoning: _flag, ...old } = raw as RawResult;
    const replies: RawResult[] = [
      { ...old, id: "a" },
      { ...old, id: "b", tokens: { ...old.tokens, reasoning: 5 } },
      { ...old, id: "c", ok: false },
      { ...old, id: "d", transport: "batch" },
      { ...old, id: "e", model: "m" },
    ];
    for (const one of replies)
      writeJson(join(dir, "requests", `${one.id}.json`), one);
    expect(
      noReasoningReplies(dir, {
        requests: replies.map((one) => ({ id: one.id }) as ManifestRequest),
      }),
    ).toEqual(["a"]);
  });

  it("is not flagged when the model reasoned, or isn't expected to", async () => {
    const reasoned = await runOne(MODELS.sonnet, 10);
    expect(reasoned.raw?.noReasoning).toBeUndefined();
    expect(reasoned.logged.join("\n")).not.toMatch(/WARNING/);
    expect(expectsReasoning("m")).toBe(false);
    const other = await runOne("m", 0);
    expect(other.raw?.noReasoning).toBeUndefined();
  });
});

describe("the blocked-calls bar's runs", () => {
  // Plan 077's round 1 and plan 081's stage 2, by kind, with their groups.
  const groups: Record<string, string[]> = {
    cc: ["A3 task 1 all opus medium"],
    "r1-a3": ["A3 task 1 all opus medium", "A3 task 2 all opus medium"],
    "r1-a0": ["A0 task 1 all opus medium", "A2 task 1 all opus medium"],
    "r1-repeat": ["A3 task 1 repeat opus medium"],
    "s2-opus": ["A3 task 1 all opus medium", "A3 task 2 all opus medium"],
    "s2-sonnet": ["A3 task 1 all sonnet medium"],
    t3: ["A3 task 3 all opus medium"],
    trip: ["roundtrip translate opus medium"],
  };
  const byKind = {
    "cache-check": ["cc"],
    newtext: ["r1-a3", "r1-a0", "r1-repeat", "s2-opus", "s2-sonnet"],
    task3: ["t3"],
    roundtrip: ["trip"],
  };
  const of = (run: string) => groups[run];

  it("are every run without --runs", () => {
    expect(blockedRuns(undefined, byKind, of)).toEqual(
      Object.values(byKind).flat().sort(),
    );
    expect(blockedRuns([], byKind, of)).toHaveLength(8);
  });

  it("leave out only the runs a named run of their kind stands in for", () => {
    // Plan 077's recorded --runs: its A3 and A0 runs. Stage 2's Opus A3 is
    // the alternative it didn't choose; the repeats, the cache check, task
    // 3 and the round trips still count, as on 13 November.
    expect(blockedRuns(["r1-a3", "r1-a0"], byKind, of)).toEqual(
      ["cc", "r1-a0", "r1-a3", "r1-repeat", "s2-sonnet", "t3", "trip"].sort(),
    );
    // Stage 2's Opus control leaves out round 1's A3 run instead.
    expect(blockedRuns(["s2-opus", "r1-a0"], byKind, of)).not.toContain(
      "r1-a3",
    );
    // A model's own run keeps its cache check (a kind with none named).
    expect(blockedRuns(["s2-sonnet"], byKind, of)).toContain("cc");
  });

  it("are keyed on the requests: new-text by id and set, others by id and prompt", () => {
    const manifest = (
      kind: Manifest["kind"],
      requests: [string, string][],
      newTextFile?: string,
    ) =>
      ({
        kind,
        ...(newTextFile ? { newTextFile } : {}),
        requests: requests.map(([id, promptHash]) => ({ id, promptHash })),
      }) as Manifest;
    expect(runRequestKeys(manifest("newtext", [["p01", "h1"]]))).toEqual([
      "p01 ",
    ]);
    expect(
      runRequestKeys(manifest("newtext", [["p01", "h2"]], "topup.json")),
    ).toEqual(["p01 topup.json"]);
    expect(runRequestKeys(manifest("roundtrip", [["t1", "h1"]]))).toEqual([
      "t1 h1",
    ]);
    expect(runRequestKeys(undefined)).toEqual([]);
    // Two round-trip runs that redo an id with another prompt both count.
    const keys: Record<string, string[]> = {
      a: runRequestKeys(manifest("roundtrip", [["t1", "h1"]])),
      b: runRequestKeys(
        manifest("roundtrip", [
          ["t1", "h2"],
          ["t2", "h3"],
        ]),
      ),
      c: runRequestKeys(manifest("roundtrip", [["t1", "h1"]])),
    };
    expect(
      blockedRuns(["a"], { roundtrip: ["a", "b", "c"] }, (run) => keys[run]),
    ).toEqual(["a", "b"]);
  });
});

describe("the cost a call", () => {
  const tokens = (input: number, cached: number) => ({
    ...NO_TOKENS,
    input,
    cached,
    output: 100,
  });
  const line = (
    request: string,
    more: Partial<LedgerEntry>,
    run = "r",
  ): LedgerEntry => ({
    ...entry(0, "2026-11-15T19:00:00.000Z", `${request}-${more.cost}`),
    run,
    request,
    ...more,
  });
  const byPrefix = (one: LedgerEntry) => one.request.slice(0, 7);

  it("counts each call once at its own cost, cold and warm, holds and notes left out", () => {
    const entries = [
      // A sync call: its hold, a note, then the line that settles it.
      line("N-A3-t1-p01", { hold: true, cost: 1 }),
      line("N-A3-t1-p01", { holdFor: "h", cost: 0 }),
      line("N-A3-t1-p01", {
        settles: "h",
        cost: -0.8,
        actual: 0.2,
        tokens: tokens(1000, 0),
      }),
      line("N-A3-t1-p02", {
        settles: "h2",
        cost: -0.9,
        actual: 0.1,
        tokens: tokens(1000, 900),
      }),
      line("N-A3-t1-p03", {
        settles: "h3",
        cost: -0.95,
        actual: 0.05,
        tokens: tokens(1000, 800),
      }),
      // A batch call has no hold: its line is its cost.
      line("N-A3-t2-p01", { cost: 0.05, tokens: tokens(1000, 0) }),
      line("N-A3-t1-p03", { cost: 9, tokens: tokens(1, 0) }, "other"),
    ];
    const rows = callCosts(entries, ["r"], byPrefix);
    expect(rows).toEqual([
      {
        group: "N-A3-t1",
        calls: 3,
        cost: expect.closeTo(0.35, 10),
        mean: expect.closeTo(0.35 / 3, 10),
        failed: 0,
        cold: { calls: 1, mean: expect.closeTo(0.2, 10) },
        warm: {
          calls: 2,
          mean: expect.closeTo(0.075, 10),
          // Over the warm calls only: 1,700 of 2,000.
          cachedShare: 0.85,
        },
        input: 1000,
        output: 100,
        runs: ["r"],
      },
      {
        group: "N-A3-t2",
        calls: 1,
        cost: 0.05,
        mean: 0.05,
        failed: 0,
        cold: { calls: 1, mean: 0.05 },
        warm: { calls: 0, cachedShare: 0 },
        input: 1000,
        output: 100,
        runs: ["r"],
      },
    ]);
    // Several runs at once: a cache check's first call joins its model's.
    const both = callCosts(entries, ["r", "other"], byPrefix)[0];
    expect(both.cold).toEqual({ calls: 2, mean: expect.closeTo(4.6, 10) });
    expect(both.runs).toEqual(["r", "other"]);
  });

  it("adds a reconciled correction to the call it corrects; a failed call counts only in the mean", () => {
    const entries = [
      // A failed sync call booked at its worst case ($2), then reconciled
      // to its real $0.30.
      line("N-A3-t1-p01", { hold: true, cost: 2, id: "h" }),
      line("N-A3-t1-p01", {
        id: "s",
        settles: "h",
        cost: 0,
        actual: 2,
        unknown: true,
        failed: true,
        tokens: { ...NO_TOKENS },
      }),
      line("N-A3-t1-p01", { reconciles: "s", cost: -1.7, tokens: NO_TOKENS }),
      // Its retry, warm.
      line("N-A3-t1-p01", {
        settles: "h2",
        cost: -0.9,
        actual: 0.1,
        retry: 2,
        tokens: tokens(1000, 900),
      }),
      // A batch call failed with no known cost, reconciled to $0.04.
      line("N-A3-t1-p02", {
        id: "b",
        cost: 0.5,
        unknown: true,
        failed: true,
        tokens: { ...NO_TOKENS },
      }),
      line("N-A3-t1-p02", { reconciles: "b", cost: -0.46, tokens: NO_TOKENS }),
    ];
    const [row] = callCosts(entries, ["r"], byPrefix);
    expect(row).toMatchObject({
      calls: 3,
      failed: 2,
      cold: { calls: 0 },
      warm: { calls: 1, mean: expect.closeTo(0.1, 10), cachedShare: 0.9 },
    });
    expect(row.cost).toBeCloseTo(0.3 + 0.1 + 0.04, 10);
    expect(row.mean).toBeCloseTo(0.44 / 3, 10);
  });
});
