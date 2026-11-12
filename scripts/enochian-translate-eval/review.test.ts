import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import realDictionary from "magick-data/enochian/dictionary";
import keys from "magick-data/enochian/keys";
import { afterEach, describe, expect, it } from "vitest";
import { type AnswerItem, checkContextFrom, checkItem } from "./answer.ts";
import { dictionary as fixtureDictionary, row } from "./fixtures.ts";
import {
  Ledger,
  type LedgerEntry,
  NO_TOKENS,
  type PriceList,
  unreconciled,
} from "./ledger.ts";
import { MODELS } from "./models.ts";
import { measureNewTextBars } from "./newbars.ts";
import {
  type NewArm,
  newRequest,
  planNewSpecs,
  type Subset,
  type Task3Sentence,
} from "./newprompt.ts";
import {
  a1kPooled,
  type BarRun,
  barGroup,
  opusBlocked,
  retryBlocked,
} from "./newrunner.ts";
import {
  newReport,
  newTextContext,
  plantOutcome,
  scoreNewText,
} from "./newscore.ts";
import {
  aethyrSlots,
  buildNewText,
  dictionaryOrder,
  type NewTextSet,
  newTextRows,
  swapFits,
  topUpOptions,
  withPlantedKnowns,
  wordInfo,
} from "./newtext.ts";
import { sharesContentWord } from "./normalise.ts";
import {
  blockedAttempts,
  collect,
  type EvalData,
  execute,
  ledgerPath,
  type Manifest,
  manifestRequest,
  pendingRequests,
  type Runtime,
  readRaw,
  reconcile,
  runDir,
  writeJson,
} from "./runner.ts";
import {
  candidate,
  DAMAGES,
  damagedControls,
  ORIGINAL_SOURCE,
  type Task3Candidate,
  task3Report,
  translationText,
} from "./task3.ts";
import { rowsFromKeys } from "./testset.ts";
import {
  callSettings,
  type Gateway,
  type ModelRequest,
  type ModelResult,
} from "./transport.ts";

/**
 * Tests for the final review of stages A and B of plan 077's redesign: one
 * or more for each finding.
 */

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
const opus = MODELS.opus;

const prices: PriceList = {
  m: {
    input: "0.000004",
    output: "0.00002",
    input_cache_read: "0.0000002",
    input_cache_write: "0.000005",
  },
  "m-batch": { input: "0.000002", output: "0.00001" },
};

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function tempOut() {
  const dir = mkdtempSync(join(tmpdir(), "translate-eval-review-"));
  dirs.push(dir);
  return dir;
}

function fakeGateway(
  reply: (request: ModelRequest, call: number) => Partial<ModelResult>,
  more: Partial<Gateway> = {},
): Gateway & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async generate(request) {
      calls.push(request.id);
      return {
        id: request.id,
        ok: true,
        text: "",
        finishReason: "stop",
        tokens: { ...NO_TOKENS, input: 1000, output: 500, reasoning: 200 },
        ...reply(request, calls.length),
      };
    },
    startBatch: async () => ({
      reference: { version: 2, id: "b1", provider: "gateway" },
      warnings: [],
    }),
    batchStatus: async () => ({ status: "completed" }),
    async *batchResults() {},
    generationCost: async () => undefined,
    ...more,
  };
}

function runtime(out: string, gateway: Gateway, ledger?: Ledger): Runtime {
  return {
    out,
    gateway,
    prices,
    ledger: ledger ?? new Ledger(ledgerPath(out)),
    log: () => {},
    concurrency: 1,
  };
}

const request = (id: string): ModelRequest => ({
  id,
  kind: "judge",
  model: "m",
  effort: "medium",
  instructions: ["Say it.", "C".repeat(1000)],
  prompt: `Now ${id}.`,
});

// --- H1: the ledger ---------------------------------------------------------------

describe("H1: the ledger before the first paid run", () => {
  it("books a sync reply with no cost and no usage at its worst case", async () => {
    const out = tempOut();
    const rt = runtime(
      out,
      fakeGateway(() => ({ tokens: { ...NO_TOKENS } })),
    );
    const dir = runDir(out, "r");
    await execute(rt, {
      run: "r",
      dir,
      requests: [request("a")],
      transport: "sync",
      budget: 5,
    });
    const raw = readRaw(dir, "a");
    expect(raw?.unknown).toBe(true);
    expect(raw?.cost).toBeGreaterThan(0.5);
    expect(unreconciled(rt.ledger.entries())).toHaveLength(1);
  });

  it("keeps a failed call's $0 looked-up cost unknown, for reconcile", async () => {
    const out = tempOut();
    let lookup = 0;
    const rt = runtime(
      out,
      fakeGateway(() => ({ ok: false, generationId: "g1", error: "boom" }), {
        generationCost: async () => lookup,
      }),
    );
    const dir = runDir(out, "r");
    await execute(rt, {
      run: "r",
      dir,
      requests: [request("a")],
      transport: "sync",
      budget: 5,
    });
    expect(readRaw(dir, "a")).toMatchObject({ unknown: true, exact: false });
    const booked = rt.ledger.total();
    expect(booked).toBeGreaterThan(0.5);
    // Still $0: nothing reconciled, the worst case kept.
    expect((await reconcile(rt)).fixed).toBe(0);
    expect(rt.ledger.total()).toBeCloseTo(booked, 10);
    // Once the gateway knows, reconcile corrects it.
    lookup = 0.02;
    expect((await reconcile(rt)).fixed).toBe(1);
    expect(rt.ledger.total()).toBeCloseTo(0.02, 10);
  });

  it("appends a reply's ledger line before saving the reply", async () => {
    const out = tempOut();
    const dir = runDir(out, "r");
    const order: string[] = [];
    class Watching extends Ledger {
      append(entry: LedgerEntry) {
        if (!entry.hold && !entry.holdFor)
          order.push(
            `${entry.request} booked, saved ${existsSync(join(dir, "requests", `${entry.request}.json`))}`,
          );
        super.append(entry);
      }
    }
    const ledger = new Watching(ledgerPath(out));
    const reply: ModelResult = {
      id: "b",
      ok: true,
      text: "x",
      finishReason: "stop",
      tokens: { ...NO_TOKENS, input: 10, output: 10, reasoning: 5 },
      gatewayCost: "0.01",
    };
    const gateway = fakeGateway(() => ({ gatewayCost: "0.01" }), {
      async *batchResults() {
        yield reply;
      },
    });
    const rt = runtime(out, gateway, ledger);
    await execute(rt, {
      run: "r",
      dir,
      requests: [request("a")],
      transport: "sync",
      budget: 5,
    });
    await execute(rt, {
      run: "r",
      dir,
      requests: [request("b")],
      transport: "batch",
      budget: 5,
    });
    await collect(rt, "r", dir, [manifestRequest(request("b"))]);
    expect(order).toEqual(["a booked, saved false", "b booked, saved false"]);
    expect(readRaw(dir, "b")?.ok).toBe(true);
  });
});

// --- H2: the knowns among the dictionary's entries ----------------------------------

describe("H2: the planted knowns in the dictionary's order", () => {
  it("is the dictionary's own order, case aside", () => {
    const headwords = Object.keys(realDictionary);
    for (let i = 1; i < headwords.length; i++)
      expect(dictionaryOrder(headwords[i - 1], headwords[i])).toBeLessThan(1);
    expect(headwords.some((one) => /[a-z]/.test(one))).toBe(true);
  });

  it("puts each known between neighbours that bracket it, apart", () => {
    const shown = Object.keys(
      withPlantedKnowns(realDictionary, set.plantedKnowns),
    );
    const known = new Set(set.plantedKnowns.map((one) => one.headword));
    const real = Object.keys(realDictionary);
    for (let i = 0; i < shown.length; i++) {
      if (!known.has(shown[i])) continue;
      if (i > 0)
        expect(dictionaryOrder(shown[i - 1], shown[i])).toBeLessThan(1);
      if (i < shown.length - 1)
        expect(dictionaryOrder(shown[i], shown[i + 1])).toBeLessThan(1);
      // Two knowns side by side only where no real headword sorts between.
      if (known.has(shown[i + 1]))
        expect(
          real.some(
            (one) =>
              dictionaryOrder(shown[i], one) < 0 &&
              dictionaryOrder(one, shown[i + 1]) < 0,
          ),
        ).toBe(false);
    }
    // No run of knowns: the review found 14 together after FARZM.
    let run = 0;
    let longest = 0;
    for (const one of shown) {
      run = known.has(one) ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThanOrEqual(2);
  });
});

// --- H3: the damaged controls ---------------------------------------------------------

describe("H3: damaged controls that test the judges", () => {
  const { originals, controls } = damagedControls(set, {
    dictionary: realDictionary,
    rows: keyRows,
  });
  const rows = new Map(newTextRows(set).map((one) => [one.id, one]));

  it("are made only from Dee's own words, right by construction", () => {
    expect(controls).toHaveLength(15);
    for (const damage of DAMAGES)
      expect(controls.filter((one) => one.damage === damage)).toHaveLength(5);
    for (const one of controls) {
      const original = originals.find((a) => a.id === one.of) as Task3Candidate;
      expect(original.sentence).toBe(one.sentence);
      expect(original.items.every((item) => item.basis === "attested")).toBe(
        true,
      );
      expect(translationText(original.items)).not.toContain("[?]");
      // Every word is a new-text row's word as Dee wrote it.
      const from = one.sentence.split(" + ").map((id) => id.split("/")[0]);
      expect(from).toHaveLength(2);
      const its = set.sentences
        .filter((s) => from.includes(s.id))
        .flatMap((s) => s.rows);
      for (const item of original.items) {
        const row = its.find((r) => r.enochian === item.target);
        expect(row && rows.get(row.id)?.kind).toMatch(/^(unchanged|swapped)$/);
      }
    }
    // As many as the passages allow, fewer when they run out.
    const few = damagedControls(
      { sentences: set.sentences.slice(0, 10) },
      { dictionary: realDictionary, rows: keyRows },
    );
    expect(few.controls.length).toBeLessThan(15);
    expect(few.originals).toHaveLength(few.controls.length);
  });

  it("count only when both judges accepted the original", () => {
    const sentences = task3.slice(0, 12);
    const originals = sentences.map((one) =>
      candidate(
        ORIGINAL_SOURCE,
        one,
        [{ source: "x", target: "OL", basis: "attested", ref: "OL" }],
        { original: true },
      ),
    );
    const made = originals.map((one, i) => ({
      ...candidate(`control-${i}`, sentences[i], [
        { source: "x", target: "ZZZ", basis: "attested", ref: "ZZZ" },
      ]),
      damage: DAMAGES[i % 3],
      of: one.id,
    }));
    const report = (accept: number, originalsRejected: number) => {
      const rubric = new Map<
        string,
        { answer: string; outcome: "correct" | "rejected" }
      >();
      originals.forEach((one, i) =>
        rubric.set(one.id, {
          answer: translationText(one.items),
          outcome: i < originalsRejected ? "rejected" : "correct",
        }),
      );
      made.forEach((one, i) =>
        rubric.set(one.id, {
          answer: translationText(one.items),
          // Accept controls from the end, whose originals were accepted.
          outcome: i >= made.length - accept ? "correct" : "rejected",
        }),
      );
      return task3Report({
        candidates: [...originals, ...made],
        sentences,
        rubric,
        roundTrip: new Map(),
        roundTrips: new Map(),
        a1: new Map(),
        dictionary: fixtureDictionary,
        keyRows: [],
      }).controls;
    };
    // 10 counted, 2 accepted: a fifth, measurable.
    expect(report(2, 2)).toMatchObject({
      counted: 10,
      accepted: 2,
      originalNotAccepted: 2,
    });
    expect(report(2, 2).unmeasurable).toBeUndefined();
    // 3 of 10: more than a fifth.
    expect(report(3, 2).unmeasurable).toMatch(/3 of 10/);
    // 7 counted: too few.
    expect(report(0, 5).unmeasurable).toMatch(/only 7/);
    // The bars say so.
    const bars = measureNewTextBars({
      task3: { controlsUnmeasurable: report(0, 5).unmeasurable },
    }).bars;
    expect(
      bars.find((one) => one.id === "task3Accept")?.unmeasurable,
    ).toBeDefined();
  });
});

// --- M1, M2: the checker on GD rows and plants -------------------------------------------

describe("M1: a GD-spelled row may cite Casaubon's word", () => {
  const context = newTextContext(
    withPlantedKnowns(realDictionary, set.plantedKnowns),
    keyRows,
  );
  const gd = newTextRows(set).find(
    (one) => one.gdSpelling && one.kind === "unchanged",
  );

  it("is not an invention in the new text", () => {
    if (!gd) throw new Error("no GD row");
    const source = keyRows.find((one) => one.id === gd.source);
    const item: AnswerItem = {
      source: gd.enochian,
      target: source?.english ?? "",
      basis: "attested",
      ref: gd.source,
      token: 1,
    };
    const scores = scoreNewText([gd], [item], 1, context);
    expect(scores.items[0].check).not.toBe("invention");
  });

  it("leaves the folds' checker as it was", () => {
    const check = checkContextFrom(fixtureDictionary, [
      row(1, 2, "ZORGE", "be friendly unto me", "zodoreje"),
    ]);
    const item: AnswerItem = {
      source: "ZODOREJE",
      target: "be friendly unto me",
      basis: "attested",
      ref: "ZORGE",
    };
    // A headword ref must match the word itself, as before.
    expect(checkItem(item, 1, check, "ZODOREJE")).toBe("invention");
    expect(checkItem(item, 1, check, ["ZODOREJE", "ZORGE"])).toBe("ok");
    expect(checkItem({ ...item, ref: "1.2" }, 1, check, "ZODOREJE")).toBe("ok");
  });
});

describe("M2: a plant's derivation", () => {
  const check = checkContextFrom(fixtureDictionary, [row(1, 1, "OL", "I")]);
  const derived = (source: string, ref: string): AnswerItem => ({
    source,
    target: "something",
    basis: "derived",
    ref,
  });

  it("is checked against the row's word, never the model's source", () => {
    expect(plantOutcome(derived("XORGX", "ORG"), 1, check, "QQQQ")).toBe(
      "unsupported guess",
    );
    expect(plantOutcome(derived("QQQQ", "ORG"), 1, check, "XORGX")).toBe(
      "derived",
    );
  });

  it("needs a cited form of three letters or more", () => {
    expect(plantOutcome(derived("XOLX", "OL"), 1, check, "XOLX")).toBe(
      "unsupported guess",
    );
    expect(plantOutcome(derived("XOLX", "1.1"), 1, check, "XOLX")).toBe(
      "unsupported guess",
    );
  });

  it("is never supported on the new text's plants", () => {
    const context = newTextContext(realDictionary, keyRows);
    for (const one of newTextRows(set).filter((r) => r.kind === "plant"))
      for (const ref of Object.keys(realDictionary).filter(
        (w) => w.length >= 3,
      ))
        if (one.enochian.includes(ref.toUpperCase()))
          throw new Error(`${one.enochian} holds ${ref}`);
    expect(context).toBeDefined();
  });
});

// --- M3 and the top-up: measuring from runs ----------------------------------------------

/** A run saved as if done: every reply a failed call (rows count missing). */
function fakeRun(
  out: string,
  run: string,
  runData: EvalData,
  choice: { arm: NewArm; task: 1 | 2; subset: Subset },
  options: { drop?: number; keep?: number; file?: string } = {},
): BarRun {
  const specs = planNewSpecs(
    {
      arms: [choice.arm],
      tasks: [choice.task],
      subset: choice.subset,
      model: opus,
      efforts: ["medium"],
    },
    runData,
  );
  if (options.keep) specs.length = options.keep;
  const requests = specs.map((spec) => newRequest(spec, runData));
  const manifest: Manifest = {
    runId: run,
    kind: "newtext",
    createdAt: "",
    transport: "sync",
    budget: 1,
    projection: 0,
    ...(options.file ? { newTextFile: options.file } : {}),
    requests: requests.map((one, i) =>
      manifestRequest(one, { newtext: specs[i] }),
    ),
  };
  const dir = runDir(out, run);
  writeJson(join(dir, "manifest.json"), manifest);
  requests.slice(options.drop ?? 0).forEach((one) =>
    writeJson(join(dir, "requests", `${one.id}.json`), {
      id: one.id,
      ok: false,
      finishReason: "error",
      error: "x",
      text: "",
      tokens: NO_TOKENS,
      attempt: 1,
    }),
  );
  return { run, manifest, data: runData };
}

describe("M3: the bars refuse runs they can't measure", () => {
  const want = {
    arm: "A3" as const,
    task: 1 as const,
    model: opus,
    effort: "medium" as const,
  };

  it("refuses parts never run, partial sets and two matching runs", () => {
    const out = tempOut();
    const a = fakeRun(
      out,
      "a",
      data,
      { arm: "A3", task: 1, subset: "all" },
      { drop: 1 },
    );
    expect(() => barGroup(out, [a], want)).toThrow(/never run/);
    const b = fakeRun(
      out,
      "b",
      data,
      { arm: "A3", task: 1, subset: "all" },
      { keep: 3 },
    );
    expect(() => barGroup(out, [b], want)).toThrow(
      /covers \d+ rows, its set 600/,
    );
    const c = fakeRun(out, "c", data, { arm: "A3", task: 1, subset: "all" });
    const d = fakeRun(out, "d", data, { arm: "A3", task: 1, subset: "all" });
    expect(() => barGroup(out, [c, d], want)).toThrow(/c and d both/);
    expect(barGroup(out, [c], want)?.report.all.rows).toBe(600);
    // Another subset doesn't match the bars.
    const e = fakeRun(out, "e", data, {
      arm: "A3",
      task: 1,
      subset: "first30",
    });
    expect(barGroup(out, [e], want)).toBeUndefined();
  });

  it("pools a top-up run with the committed set's, A1k likewise", {
    timeout: 120_000,
  }, () => {
    const out = tempOut();
    const topUp = buildNewText(
      { dictionary: realDictionary, rows: keyRows, exclude: aethyrSlots(keys) },
      { seed: 78, ...topUpOptions(200) },
    );
    expect(newTextRows(topUp)).toHaveLength(200);
    expect(topUp.sentences).toHaveLength(20);
    expect(topUp.repeat.sentences).toEqual([]);
    const file = join(out, "topup.json");
    writeFileSync(file, JSON.stringify(topUp));
    const topData = { ...data, newText: topUp };
    const main = fakeRun(out, "main", data, {
      arm: "A3",
      task: 1,
      subset: "all",
    });
    const extra = fakeRun(
      out,
      "extra",
      topData,
      { arm: "A3", task: 1, subset: "all" },
      { file },
    );
    const pooled = barGroup(out, [extra, main], want);
    expect(pooled?.runs).toEqual(["main", "extra"]);
    expect(pooled?.report.all.rows).toBe(800);
    expect(a1kPooled(out, pooled?.sets ?? []).task1.all.rows).toBe(800);
    expect(() => barGroup(out, [extra], want)).toThrow(
      /no run on the committed set/,
    );
  });
});

// --- M4: no cache breakpoints in batch -----------------------------------------------------

describe("M4: batch requests", () => {
  it("carry no cache breakpoints", () => {
    const settings = callSettings(request("a"), false);
    for (const one of settings.instructions)
      expect(one).not.toHaveProperty("providerOptions");
    expect(callSettings(request("a")).instructions[1]).toHaveProperty(
      "providerOptions",
    );
  });
});

// --- Low ----------------------------------------------------------------------------------

describe("the knowns bar's marginal flag", () => {
  it("is the model's count's, not A0's ceiling's", () => {
    const report = (right: number, wrong: number) =>
      newReport({
        task: 1,
        rows: [
          ...Array.from({ length: right }, (_, i) => ({
            id: `r${i}`,
            outcome: "correct" as const,
          })),
          ...Array.from({ length: wrong }, (_, i) => ({
            id: `w${i}`,
            outcome: "unknown" as const,
          })),
        ].map((one) => ({
          ...one,
          sentence: "S01",
          kind: "known" as const,
          multi: false,
          gdSpelling: false,
        })),
        items: [],
      });
    const bar = measureNewTextBars({
      a3Task1: report(20, 0),
      a0Task1: report(0, 20),
    }).bars.find((one) => one.id === "knownsRight");
    expect(bar).toMatchObject({ met: true, marginal: false });
  });
});

describe("--offline on the folds' dry runs", () => {
  it("never fetches the price list", { timeout: 180_000 }, () => {
    const out = tempOut();
    // Any fetch throws: a dry run that tried to fetch would fail.
    const stub = join(out, "no-network.mjs");
    writeFileSync(
      stub,
      'globalThis.fetch = () => { throw new Error("network in a test"); };\n',
    );
    const cli = here("./cli.ts");
    for (const args of [
      ["run", "--keys", "1", "--arms", "A3", "--books", "open"],
      ["judge-a1"],
      ["probe", "--keys", "1"],
    ]) {
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          stub,
          "--import",
          "tsx",
          cli,
          ...args,
          "--budget",
          "5",
          "--dry-run",
          "--offline",
          "--out",
          out,
        ],
        { encoding: "utf8", cwd: here("../..") },
      );
      expect(result.stderr, args[0]).not.toMatch(/network in a test|fetch/);
      expect(result.status, `${args[0]}: ${result.stderr}`).toBe(0);
      expect(result.stdout).toMatch(/Offline prices/);
    }
  });
});

describe("blocked replies, in any order", () => {
  it("are retried once after the first block, even after a transport failure", async () => {
    const out = tempOut();
    const dir = runDir(out, "r");
    // A transport failure, then a block, then a block again.
    const gateway = fakeGateway(
      (_request, call) =>
        call === 1
          ? {
              ok: false,
              error: "socket",
              generationId: "g",
              gatewayCost: "0.01",
            }
          : { finishReason: "content-filter", gatewayCost: "0.01" },
      { generationCost: async () => 0.01 },
    );
    const rt = runtime(out, gateway);
    const requests = [request("a")];
    await execute(rt, {
      run: "r",
      dir,
      requests,
      transport: "sync",
      budget: 5,
    });
    expect(pendingRequests(dir, requests, true)).toHaveLength(1);
    await execute(rt, {
      run: "r",
      dir,
      requests,
      transport: "sync",
      budget: 5,
    });
    expect(blockedAttempts(dir, "a")).toBe(1);
    expect(
      await retryBlocked(rt, { run: "r", dir, requests, budget: 5 }),
    ).toEqual(["a"]);
    expect(blockedAttempts(dir, "a")).toBe(2);
    expect(
      await retryBlocked(rt, { run: "r", dir, requests, budget: 5 }),
    ).toEqual([]);
    expect(pendingRequests(dir, requests, true)).toEqual([]);
    expect(gateway.calls).toHaveLength(3);
  });

  it("count round trips among Opus's translation calls", () => {
    const out = tempOut();
    const spec = {
      part: 1,
      input: [{ id: "c1", enochian: "OL" }],
      model: opus,
      effort: "medium" as const,
    };
    const id = "RT-p01-opus-medium";
    writeJson(join(runDir(out, "rt"), "manifest.json"), {
      runId: "rt",
      kind: "roundtrip",
      createdAt: "",
      transport: "sync",
      budget: 1,
      projection: 0,
      requests: [
        {
          id,
          kind: "translate",
          model: opus,
          effort: "medium",
          promptHash: "",
          chars: 1,
          roundtrip: spec,
        },
      ],
    } satisfies Manifest);
    writeJson(join(runDir(out, "rt"), "requests", `${id}.json`), {
      id,
      finishReason: "content-filter",
      attempt: 1,
    });
    expect(opusBlocked(out, ["rt"], opus)).toEqual({ calls: 1, blocked: 1 });
  });
});

describe("the swap rule against every sense of the replaced word", () => {
  const info = wordInfo({ dictionary: realDictionary, rows: keyRows });
  const byId = new Map(keyRows.map((one) => [one.id, one]));

  it("no longer swaps ALDON for NIISO", () => {
    expect(
      swapFits(byId.get("10.80") as never, byId.get("9.28") as never, info),
    ).toBe(false);
    const s1111 = newTextRows(set).find((one) => one.id === "S11.11");
    expect(s1111?.enochian).not.toBe("ALDON");
  });

  it("holds for every swapped row of the set", () => {
    for (const one of newTextRows(set).filter((r) => r.kind === "swapped"))
      for (const gloss of one.glosses ?? [])
        for (const gone of one.replaced?.glosses ?? [])
          expect(
            sharesContentWord(gloss, gone),
            `${one.id}: ${gloss} / ${gone}`,
          ).toBe(false);
  });
});
