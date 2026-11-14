import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import realDictionary from "magick-data/enochian/dictionary";
import keys from "magick-data/enochian/keys";
import { afterEach, describe, expect, it } from "vitest";
import { type AnswerItem, alignItems } from "./answer.ts";
import { a1Scores, markHard } from "./baseline.ts";
import { cipher } from "./cipher.ts";
import { serialiseContext } from "./context.ts";
import { entry, row } from "./fixtures.ts";
import { measureBars } from "./heldout-bars.ts";
import {
  applyVerdicts,
  foldVerdicts,
  type JudgeCase,
  judgeCase,
  judgeRequest,
  judgeRows,
  parseVerdicts,
  type Verdict,
  verdictKey,
} from "./judge.ts";
import {
  costOf,
  EXPERIMENT_CAP_USD,
  estimateCost,
  estimateTokens,
  Ledger,
  type LedgerEntry,
  mayLaunch,
  NO_TOKENS,
  type PriceList,
  refusal,
  unreconciled,
} from "./ledger.ts";
import { MAX_OUTPUT_TOKENS } from "./models.ts";
import {
  FLAG_SHARE,
  inOrderMatches,
  probeKey,
  probeRequests,
} from "./probe.ts";
import {
  citedKeys,
  closedRemovals,
  heldOutWords,
  INSTRUCTIONS,
  namesHeldOutWord,
  namesRemoved,
  planSpecs,
  stripGrammar,
  translateRequest,
} from "./prompt.ts";
import { lastJsonBlock, parseAnswer } from "./reply.ts";
import {
  batchKey,
  calibrationPath,
  collect,
  type EvalData,
  execute,
  failedBooking,
  failedRaw,
  groups,
  ledgerPath,
  loadProbeFlags,
  type Manifest,
  manifestRequest,
  pendingRequests,
  projection,
  promptKind,
  type RawResult,
  type Runtime,
  readJson,
  readRaw,
  reconcile,
  reserved,
  runBars,
  runDir,
  runJudges,
  scoreRequests,
  worstCase,
  worstOf,
  writeJson,
} from "./runner.ts";
import { listsAlternatives, report, scoreFold } from "./score.ts";
import {
  buildTestSet,
  type KeyRowRecord,
  namesRemovedForm,
  removedForms,
  rowsFromKeys,
  type SourceData,
} from "./testset.ts";
import {
  type BatchReference,
  type Gateway,
  type ModelRequest,
  type ModelResult,
  settingWarnings,
} from "./transport.ts";

const grammar = readFileSync(
  fileURLToPath(
    new URL(
      "../../packages/magick-data/src/enochian/grammar.md",
      import.meta.url,
    ),
  ),
  "utf8",
);

const realData: SourceData = {
  dictionary: realDictionary,
  rows: rowsFromKeys(keys),
};
const realFolds = buildTestSet(realData);

/** Lines of a prompt's system messages that look like a Key row of `key`. */
function rowLines(text: string, key: number): string[] {
  return text
    .split("\n")
    .filter((line) => new RegExp(`^${key}\\.\\d+\\t`).test(line));
}

/** "Key K.R" citations of `key` anywhere in a text. */
function rowCitations(text: string, key: number): string[] {
  return [...text.matchAll(new RegExp(`Key ${key}\\.\\d+`, "g"))].map(
    (one) => one[0],
  );
}

describe("translation prompts of the real data", () => {
  // Builds five prompts for every fold: about 0.8 s here and five times
  // that on CI's runners, too near the 5 s default.
  it("never hold a row of the held-out Key in their context", {
    timeout: 30_000,
  }, () => {
    for (const fold of realFolds) {
      for (const [arm, task, book] of [
        ["A3", 1, "open"],
        ["A3", 1, "closed"],
        ["A3", 2, "open"],
        ["A3", 2, "closed"],
        ["A0", 2, "open"],
      ] as const) {
        const request = translateRequest(
          fold,
          { key: fold.key, arm, task, book, model: "m", effort: "medium" },
          { dictionary: realDictionary, grammar },
        );
        expect(request.instructions[0]).toBe(INSTRUCTIONS);
        const system = request.instructions.join("\n");
        expect(rowLines(system, fold.key)).toEqual([]);
        expect(rowCitations(system, fold.key)).toEqual([]);
        // The other Keys are there, every row of them.
        if (arm !== "A0")
          expect(
            system.split("\n").filter((line) => /^\d+\.\d+\t/.test(line))
              .length,
          ).toBe(fold.contextRows.length);
        // Task 1 gives the Enochian alone: no row ids, no English.
        if (task === 1) {
          expect(request.prompt).not.toMatch(
            new RegExp(`\\b${fold.key}\\.\\d+\\b`),
          );
          expect(request.prompt).toContain(`[1] ${fold.input[0].word}`);
        } else
          expect(rowLines(request.prompt, fold.key)).toHaveLength(
            fold.rows.length,
          );
      }
    }
  });

  it("keep the dictionary first and the same across open-book folds", () => {
    const contexts = realFolds.slice(0, 3).map(
      (fold) =>
        translateRequest(
          fold,
          {
            key: fold.key,
            arm: "A2",
            task: 1,
            book: "open",
            model: "m",
            effort: "high",
          },
          { dictionary: realDictionary, grammar },
        ).instructions[1],
    );
    const dictionaryPart = (text: string) => text.split("# The other Keys")[0];
    expect(dictionaryPart(contexts[0])).toBe(dictionaryPart(contexts[1]));
    expect(dictionaryPart(contexts[1])).toBe(dictionaryPart(contexts[2]));
  });

  it("show A2c no plain Enochian", () => {
    const cipherForms = new Set(
      [
        ...Object.keys(realDictionary),
        ...realData.rows.flatMap((one) => [one.word ?? "", one.gd ?? ""]),
      ].map((one) => cipher.encipher(one)),
    );
    const enciphered = new Set(
      Object.keys(realDictionary).map((one) => cipher.encipher(one)),
    );
    for (const fold of realFolds) {
      const request = translateRequest(
        fold,
        {
          key: fold.key,
          arm: "A2c",
          task: 1,
          book: "open",
          model: "m",
          effort: "medium",
        },
        { dictionary: realDictionary, grammar },
      );
      const [, context] = request.instructions;
      const [dictionaryPart, keysPart] = context.split("# The other Keys");
      const entries = dictionaryPart
        .split("\n")
        .filter((line) => line.includes("\t") && !line.startsWith("#"))
        .map((line) => line.split("\t")[0]);
      expect(entries.length).toBe(Object.keys(realDictionary).length);
      for (const headword of entries)
        expect(enciphered.has(headword)).toBe(true);
      const contextRows = new Map(fold.contextRows.map((one) => [one.id, one]));
      for (const line of keysPart
        .split("\n")
        .filter((one) => /^\d+\.\d+\t/.test(one))) {
        const [id, word] = line.split("\t");
        const plain = contextRows.get(id)?.word;
        expect(word).toBe(plain ? cipher.encipher(plain) : "");
      }
      // The input: every word enciphered, none left plain.
      const tokens = [...request.prompt.matchAll(/\[(\d+)\] (\S+)/g)];
      expect(tokens).toHaveLength(fold.input.length);
      for (const [, n, word] of tokens)
        expect(word).toBe(
          cipher.encipher(fold.input[Number(n) - 1].word ?? ""),
        );
      // No held-out word of three letters or more is left plain anywhere,
      // unless it is also the cipher of some form (DUN is GAH).
      const all = [...request.instructions, request.prompt].join("\n");
      const tokensOfAll = new Set(all.match(/[A-Za-z]+/g));
      const plain = fold.input
        .map((one) => one.word ?? "")
        .filter((one) => /^[A-Za-z]{3,}$/.test(one) && !cipherForms.has(one));
      expect(plain.filter((one) => tokensOfAll.has(one))).toEqual([]);
    }
  });

  it("plan A0 once per task and A2c only in task 1, open book", () => {
    const specs = planSpecs({
      keys: [1],
      arms: ["A0", "A2", "A2c", "A3"],
      tasks: [1, 2],
      books: ["open", "closed"],
      model: "m",
      efforts: ["high", "medium"],
    });
    const count = (arm: string) =>
      specs.filter((one) => one.arm === arm).length;
    expect(count("A0")).toBe(4);
    expect(count("A2")).toBe(8);
    expect(count("A2c")).toBe(2);
    expect(count("A3")).toBe(8);
    expect(new Set(specs.map((one) => JSON.stringify(one))).size).toBe(22);
  });
});

describe("grammar notes for a fold", () => {
  it("lose every citation of the held-out Key and every word only it says, in every fold", () => {
    for (const fold of realFolds) {
      const notes = stripGrammar(grammar, fold);
      const words = heldOutWords(fold);
      expect(rowCitations(notes, fold.key)).toEqual([]);
      for (const one of fold.rows)
        expect(notes).not.toMatch(
          new RegExp(`Key ${one.id.replace(".", "\\.")}\\b`),
        );
      const rules = notes.slice(notes.indexOf("\n## "));
      for (const line of rules.split("\n"))
        expect(citedKeys(line).keys.has(fold.key), line).toBe(false);
      const named = [...notes.matchAll(/[A-Za-z]+/g)]
        .map((one) => one[0])
        .filter((token) => namesHeldOutWord(token, words));
      expect(named, `Key ${fold.key}`).toEqual([]);
      // Most of the notes survive.
      expect(notes.length).toBeGreaterThan(grammar.length * 0.75);
    }
  });

  it("lose every closed-book-removed headword in closed book, in every fold", () => {
    for (const fold of realFolds) {
      const notes = stripGrammar(grammar, fold, "closed");
      const removed = closedRemovals(fold);
      // Once per fold: building the set for every token of the notes took
      // the test past its timeout on CI's runners.
      const heldOut = heldOutWords(fold);
      const named = [...notes.matchAll(/[A-Za-z]+/g)]
        .map((one) => one[0])
        .filter(
          (token) =>
            namesRemoved(token, removed) || namesHeldOutWord(token, heldOut),
        );
      expect(named, `Key ${fold.key}`).toEqual([]);
      expect(rowCitations(notes, fold.key)).toEqual([]);
    }
    const key19 = realFolds.find((one) => one.key === 19);
    if (!key19) throw new Error("no Key 19");
    expect(stripGrammar(grammar, key19, "open")).toMatch(/\bOMAX\b/);
    expect(stripGrammar(grammar, key19, "closed")).not.toMatch(/\bOMAX\b|Omax/);
    // And the closed A3 prompt carries the closed notes.
    const request = translateRequest(
      key19,
      {
        key: 19,
        arm: "A3",
        task: 1,
        book: "closed",
        model: "m",
        effort: "medium",
      },
      { dictionary: realDictionary, grammar },
    );
    expect(request.instructions[2]).not.toMatch(/\bOMAX\b|Omax/);
  });

  it("drops sentences, lines and husks, and keeps the rest", () => {
    const data: SourceData = {
      dictionary: {},
      rows: [
        row(1, 1, "OL", "I"),
        row(1, 2, "ZORGE", "be friendly", "zodoreje"),
        row(2, 1, "OL", "I"),
        row(2, 2, "CAOSG", "the earth"),
      ],
    };
    const [fold] = buildTestSet(data);
    const notes = [
      "# Notes",
      "",
      "Examples are written `Key K.R WORD = english`; Key 1 is the first.",
      "",
      "## Words",
      "",
      "### G1. Kept",
      "OL is common. ZORGE means friendly; its GD form is",
      "zodoreje. CAOSG is earth.",
      "- Sources: Leitch, s.v. Zorge, Caosg",
      "- Example: Key 1.1 OL = I",
      "- Example: Key 2.2 CAOSG = the earth",
      "",
      "### G2. A husk",
      "Only ZORGE shows it.",
      "- Example: Key 2.1 OL = I",
      "",
      "### G3. Of Keys 1 and 3",
      "Gone whole.",
      "",
      "### G4. Ranges",
      "Keys 2 to 4 do this. Keys 1–3 do that.",
    ].join("\n");
    const out = stripGrammar(notes, fold);
    expect(out).toContain("Key 1 is the first");
    expect(out).toContain("OL is common. CAOSG is earth.");
    expect(out).not.toMatch(/ZORGE|zodoreje|Zorge/);
    expect(out).toContain("- Sources: Leitch, s.v. …, Caosg");
    expect(out).not.toContain("Key 1.1");
    expect(out).toContain("Key 2.2 CAOSG");
    expect(out).not.toContain("G2.");
    expect(out).not.toContain("G3.");
    expect(out).toContain("Keys 2 to 4 do this.");
    expect(out).not.toContain("Keys 1–3");
  });
});

describe("reading replies", () => {
  it("takes the last json block and validates it", () => {
    const text = [
      'Thinking ```json\n{"items": []}\n``` then',
      "```json",
      '{"items": [{"source": "OL", "target": "I", "basis": "attested", "ref": "OL", "token": 1, "row": null}]}',
      "```",
    ].join("\n");
    expect(lastJsonBlock(text)).toContain('"OL"');
    const parsed = parseAnswer(text);
    expect(parsed).toEqual({
      ok: true,
      coercions: 0,
      value: [
        { source: "OL", target: "I", basis: "attested", ref: "OL", token: 1 },
      ],
    });
    expect(parseAnswer("no block").ok).toBe(false);
    expect(parseAnswer("```json\n{items: [}\n```").ok).toBe(false);
    const bad = parseAnswer(
      '```json\n{"items": [{"source": "OL", "target": "I", "basis": "sure"}]}\n```',
    );
    expect(bad.ok).toBe(false);
  });

  it("mends a numeric-string token and a basis in capitals, and counts them", () => {
    const parsed = parseAnswer(
      '```json\n{"items": [{"source": "OL", "target": "I", "basis": "Attested", "ref": "OL", "token": "1"}, {"source": "X", "target": "unknown", "basis": "unknown", "token": 2}]}\n```',
    );
    expect(parsed).toMatchObject({
      ok: true,
      coercions: 2,
      value: [
        { basis: "attested", token: 1 },
        { basis: "unknown", token: 2 },
      ],
    });
    // Other slips still fail.
    expect(
      parseAnswer(
        '```json\n{"items": [{"source": "OL", "target": "I", "basis": "attested", "token": "first"}]}\n```',
      ).ok,
    ).toBe(false);
  });

  it("aligns task 1 by token before row, past a row with no word", () => {
    const data: SourceData = {
      dictionary: {},
      rows: [
        row(14, 1, "OL", "I"),
        row(14, 2, undefined, "lost", "paeb"),
        row(14, 3, "SONF", "reign"),
        row(2, 1, "OL", "I"),
      ],
    };
    const fold = buildTestSet(data).find((one) => one.key === 14);
    if (!fold) throw new Error("no fold");
    expect(fold.input.map((one) => one.id)).toEqual(["14.1", "14.3"]);
    const aligned = alignItems(
      [
        // The model counted rows itself: token 2 is SONF, row 14.3.
        {
          source: "SONF",
          target: "reign",
          basis: "derived",
          token: 2,
          row: "14.2",
        },
      ],
      fold.input,
      1,
    );
    expect(aligned[0].row).toBe("14.3");
  });
});

// --- Runner, ledger and transports, against a fake gateway ---------------------

const prices: PriceList = {
  m: {
    input: "0.000004",
    output: "0.00002",
    input_cache_read: "0.0000004",
    input_cache_write: "0.000005",
  },
  "m-batch": { input: "0.000002", output: "0.00001" },
  // The judges, at the same prices.
  "anthropic/claude-opus-5.5": {
    input: "0.000004",
    output: "0.00002",
  },
  "openai/gpt-6.1-sol": { input: "0.000004", output: "0.00002" },
};

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function tempOut() {
  const dir = mkdtempSync(join(tmpdir(), "translate-eval-"));
  dirs.push(dir);
  return dir;
}

/** A fake gateway: canned replies, every call counted. */
function fakeGateway(
  reply: (request: ModelRequest) => Partial<ModelResult>,
  more: Partial<Gateway> = {},
): Gateway & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async generate(request) {
      calls.push(request.id);
      await setTimeout(1);
      return {
        id: request.id,
        ok: true,
        text: "",
        finishReason: "stop",
        tokens: { ...NO_TOKENS, input: 1000, output: 500, reasoning: 200 },
        ...reply(request),
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

/**
 * A small judge request. At sync prices its expected cost is about $0.10
 * (5,000 tokens out) and its worst case about $0.64 (32,000 out).
 */
const smallRequest = (id: string): ModelRequest => ({
  id,
  kind: "judge",
  model: "m",
  effort: "medium",
  instructions: ["Say it."],
  prompt: "Now.",
});

const ledgerEntry = (cost: number): LedgerEntry => ({
  id: "before",
  at: "",
  run: "before",
  request: "x",
  model: "m",
  transport: "sync",
  tokens: NO_TOKENS,
  cost,
  exact: true,
});

describe("the budget", () => {
  it("refuses a run past the cap or its budget", () => {
    expect(refusal({ spent: 0, projection: 5, budget: 10 })).toBeUndefined();
    expect(refusal({ spent: 95, projection: 6, budget: 10 })).toMatch(/cap/);
    expect(refusal({ spent: 0, projection: 11, budget: 10 })).toMatch(
      /--budget/,
    );
    expect(refusal({ spent: 0, projection: 1, budget: 0 })).toMatch(/positive/);
    expect(EXPERIMENT_CAP_USD).toBe(100);
    const state = {
      spentBefore: 50,
      spentThisRun: 1,
      inFlight: 0.5,
      budget: 2,
    };
    expect(mayLaunch({ ...state, next: 0.5 })).toBe(true);
    expect(mayLaunch({ ...state, next: 0.6 })).toBe(false);
    expect(mayLaunch({ ...state, spentBefore: 98.5, next: 0.5 })).toBe(false);
  });

  it("projects expected and worst-case cost, input on the high side", () => {
    const request = smallRequest("a");
    expect(estimateTokens(11)).toBe(7);
    // A measured figure only ever lowers it.
    expect(estimateTokens(11, 3)).toBe(7);
    expect(estimateTokens(11, 1)).toBe(11);
    // Sync: input priced as cache writes.
    expect(worstOf(request, prices, "sync")).toBeCloseTo(
      7 * 5e-6 + MAX_OUTPUT_TOKENS.judge.medium * 2e-5,
      10,
    );
    expect(worstOf(request, prices, "batch")).toBeCloseTo(
      7 * 2e-6 + 32_000 * 1e-5,
      10,
    );
    expect(
      projection([request], prices, "sync") < worstOf(request, prices, "sync"),
    ).toBe(true);
    expect(MAX_OUTPUT_TOKENS.translate).toEqual({
      medium: 32_000,
      high: 64_000,
    });
  });

  it("refuses before any call", async () => {
    const out = tempOut();
    const gateway = fakeGateway(() => ({}));
    const rt = runtime(out, gateway);
    const run = (requests: ModelRequest[], budget: number) =>
      execute(rt, {
        run: "r",
        dir: runDir(out, "r"),
        requests,
        transport: "sync",
        budget,
      });
    // Expected $0.30 against $0.20.
    await expect(run(["a", "b", "c"].map(smallRequest), 0.2)).rejects.toThrow(
      /expected .* --budget/,
    );
    // One call's worst case ($0.64) doesn't fit in $0.50.
    await expect(run([smallRequest("a")], 0.5)).rejects.toThrow(
      /worst case .* --budget/,
    );
    expect(gateway.calls).toEqual([]);
  });

  it("launches a call only while its worst case fits in the budget", async () => {
    const out = tempOut();
    const gateway = fakeGateway(() => ({ gatewayCost: "0.5" }));
    const requests = ["a", "b", "c", "d", "e"].map(smallRequest);
    const result = await execute(runtime(out, gateway), {
      run: "r",
      dir: runDir(out, "r"),
      requests,
      transport: "sync",
      budget: 1.5,
    });
    // a: 0.64 held; b: 0.5 + 0.64; c would hold 1.0 + 0.64 > 1.5.
    expect(gateway.calls).toEqual(["a", "b"]);
    expect(result.skipped).toEqual(["c", "d", "e"]);
    const ledger = new Ledger(ledgerPath(out));
    expect(ledger.total()).toBeCloseTo(1, 10);
    // Each call: a hold at its worst case, then the line settling it.
    const lines = ledger.entries();
    expect(lines.filter((one) => one.hold)).toHaveLength(2);
    expect(
      lines
        .filter((one) => one.settles)
        .every((one) => one.exact && one.actual === 0.5 && one.run === "r"),
    ).toBe(true);
    expect(unreconciled(lines)).toEqual([]);
  });

  it("launches a call only while its worst case fits in the cap", async () => {
    const out = tempOut();
    new Ledger(ledgerPath(out)).append(ledgerEntry(98.6));
    const gateway = fakeGateway(() => ({ gatewayCost: "0.5" }));
    const result = await execute(runtime(out, gateway), {
      run: "r",
      dir: runDir(out, "r"),
      requests: ["a", "b", "c", "d", "e"].map(smallRequest),
      transport: "sync",
      budget: 10,
    });
    expect(gateway.calls).toEqual(["a", "b"]);
    expect(result.skipped).toHaveLength(3);
  });

  it("holds calls in flight at their worst case and waits for room", async () => {
    const out = tempOut();
    let flying = 0;
    let most = 0;
    const gateway = fakeGateway(() => ({ gatewayCost: "0.1" }));
    const generate = gateway.generate;
    gateway.generate = async (request) => {
      most = Math.max(most, ++flying);
      try {
        return await generate(request);
      } finally {
        flying--;
      }
    };
    const result = await execute(runtime(out, gateway, 3), {
      run: "r",
      dir: runDir(out, "r"),
      requests: ["a", "b", "c", "d", "e"].map(smallRequest),
      transport: "sync",
      budget: 1.5,
    });
    // Three workers, but only two worst cases fit at once.
    expect(most).toBe(2);
    expect(gateway.calls).toHaveLength(5);
    expect(result.skipped).toEqual([]);
  });
});

describe("failed calls and warnings", () => {
  it("book a failed call at its worst case until its cost is found", async () => {
    const out = tempOut();
    let known: number | undefined;
    const gateway = fakeGateway(
      (request) => ({
        ok: false,
        text: "",
        tokens: { ...NO_TOKENS },
        error: "TimeoutError",
        ...(request.id === "b" ? { generationId: "gen_b" } : {}),
        ...(request.id === "c" ? { generationId: "gen_c" } : {}),
      }),
      {
        generationCost: async (id) => (id === "gen_c" ? 0.07 : known),
      },
    );
    const rt = runtime(out, gateway);
    const dir = runDir(out, "r");
    await execute(rt, {
      run: "r",
      dir,
      requests: ["a", "b", "c"].map(smallRequest),
      transport: "sync",
      budget: 5,
    });
    const worst = worstOf(smallRequest("a"), prices, "sync");
    expect(readRaw(dir, "a")).toMatchObject({ ok: false, unknown: true });
    expect(readRaw(dir, "a")?.cost).toBeCloseTo(worst, 10);
    expect(readRaw(dir, "b")).toMatchObject({
      unknown: true,
      generationId: "gen_b",
    });
    // The gateway knew c's cost.
    expect(readRaw(dir, "c")).toMatchObject({ cost: 0.07, exact: true });
    expect(failedBooking(rt.ledger, "r", ["a", "b", "c"])).toMatchObject({
      attempts: 3,
    });
    expect(failedBooking(rt.ledger, "r", ["a", "b"]).unknown).toBeCloseTo(
      2 * worst,
      10,
    );
    // Later the gateway can say what b cost; a has no generation id.
    known = 0.05;
    const done = await reconcile(rt);
    expect(done.fixed).toBe(1);
    expect(done.left).toEqual(["r/a"]);
    expect(rt.ledger.total()).toBeCloseTo(worst + 0.05 + 0.07, 10);
    expect(unreconciled(rt.ledger.entries()).map((one) => one.request)).toEqual(
      ["a"],
    );
    expect((await reconcile(rt)).fixed).toBe(0);
  });

  it("fail a reply whose warnings say reasoning wasn't applied", async () => {
    const out = tempOut();
    const gateway = fakeGateway(() => ({
      text: "a reply",
      gatewayCost: "0.02",
      warnings: [{ type: "unsupported", feature: "reasoning", details: "x" }],
    }));
    const dir = runDir(out, "r");
    await execute(runtime(out, gateway), {
      run: "r",
      dir,
      requests: [smallRequest("a")],
      transport: "sync",
      budget: 5,
    });
    expect(readRaw(dir, "a")).toMatchObject({
      ok: false,
      text: "a reply",
      cost: 0.02,
      warnings: [{ type: "unsupported", feature: "reasoning" }],
    });
    expect(readRaw(dir, "a")?.error).toMatch(/settings not applied/);
    expect(settingWarnings([{ type: "other", message: "fine" }])).toEqual([]);
    expect(
      settingWarnings([{ type: "other", message: "topK was ignored" }]),
    ).toHaveLength(1);
    expect(
      settingWarnings([{ type: "unsupported", feature: "temperature" }]),
    ).toHaveLength(1);
    expect(
      settingWarnings([
        { type: "deprecated", setting: "reasoning", message: "" },
      ]),
    ).toEqual([]);
  });
});

describe("costs", () => {
  const tokens = {
    input: 10_000,
    cached: 4_000,
    cacheWrite: 1_000,
    output: 2_000,
    reasoning: 1_500,
  };

  it("take the gateway's figure when given, else estimate from the prices", () => {
    expect(costOf("0.0123", tokens, prices.m)).toEqual({
      cost: 0.0123,
      exact: true,
    });
    const estimated = costOf(undefined, tokens, prices.m);
    expect(estimated.exact).toBe(false);
    expect(estimated.cost).toBeCloseTo(
      5_000 * 4e-6 + 4_000 * 4e-7 + 1_000 * 5e-6 + 2_000 * 2e-5,
      10,
    );
    // The batch row has no cache prices: cache tokens at its input price.
    expect(estimateCost(tokens, prices["m-batch"])).toBeCloseTo(
      10_000 * 2e-6 + 2_000 * 1e-5,
      10,
    );
    expect(
      estimateCost(
        { ...NO_TOKENS, input: 300_000, output: 10 },
        {
          input: "1",
          output: "1",
          input_tiers: [
            { cost: "0.000002", min: 0, max: 272001 },
            { cost: "0.000004", min: 272001 },
          ],
        },
      ),
    ).toBeCloseTo(300_000 * 4e-6 + 10, 6);
  });
});

describe("batches", () => {
  const reference: BatchReference = {
    version: 2,
    id: "batch_1",
    provider: "gateway",
  };
  const requests = ["a", "b"].map(smallRequest);
  const batchWorst = worstCase(requests, prices, "batch");

  it("refuse a batch whose worst case doesn't fit", async () => {
    const out = tempOut();
    let started = 0;
    const gateway = fakeGateway(() => ({}), {
      startBatch: async () => {
        started++;
        return { reference, warnings: [] };
      },
    });
    await expect(
      execute(runtime(out, gateway), {
        run: "b",
        dir: runDir(out, "b"),
        requests,
        transport: "batch",
        budget: batchWorst - 0.01,
      }),
    ).rejects.toThrow(/worst case/);
    new Ledger(ledgerPath(out)).append(ledgerEntry(100 - batchWorst + 0.01));
    await expect(
      execute(runtime(out, gateway), {
        run: "b",
        dir: runDir(out, "b"),
        requests,
        transport: "batch",
        budget: 50,
      }),
    ).rejects.toThrow(/cap/);
    expect(started).toBe(0);
  });

  it("save the batch before starting it and its reference before polling", async () => {
    const out = tempOut();
    const dir = runDir(out, "b");
    const key = batchKey("b", "m", ["b", "a"]);
    let polled = false;
    const gateway = fakeGateway(() => ({}), {
      startBatch: async (_requests, idempotencyKey) => {
        expect(idempotencyKey).toBe(key);
        // Saved as starting, its worst case reserved, before the gateway is
        // asked.
        expect(readJson(join(dir, "batches", `${key}.json`))).toMatchObject({
          state: "starting",
          idempotencyKey: key,
        });
        expect(reserved(out)).toBeCloseTo(batchWorst, 10);
        return { reference, warnings: [] };
      },
      batchStatus: async () => {
        expect(readJson(join(dir, "batches", `${key}.json`))).toMatchObject({
          state: "started",
          reference,
        });
        polled = true;
        return { status: "completed" };
      },
      async *batchResults() {
        yield {
          id: "a",
          ok: true,
          text: "hi",
          finishReason: "stop",
          tokens: { ...NO_TOKENS, input: 1_000, output: 100, reasoning: 50 },
        };
      },
    });
    const rt = runtime(out, gateway);
    const started = await execute(rt, {
      run: "b",
      dir,
      requests,
      transport: "batch",
      budget: 5,
    });
    expect(started.batches).toHaveLength(1);
    expect(polled).toBe(false);
    expect(pendingRequests(dir, requests)).toEqual([]);
    const done = await collect(
      rt,
      "b",
      dir,
      requests.map((one) => manifestRequest(one)),
    );
    expect(done).toBe(true);
    expect(polled).toBe(true);
    expect(reserved(out)).toBe(0);
    const a = readRaw(dir, "a");
    expect(a).toMatchObject({
      ok: true,
      exact: false,
      transport: "batch",
      batchId: "batch_1",
    });
    expect(a?.cost).toBeCloseTo(1_000 * 2e-6 + 100 * 1e-5, 10);
    // A request the batch returned nothing for is saved as failed.
    expect(readRaw(dir, "b")).toMatchObject({ ok: false, cost: 0 });
    expect(
      new Ledger(ledgerPath(out)).entries().map((one) => one.request),
    ).toEqual(["a", "b"]);
  });

  it("start again with the same key when a start was never confirmed", async () => {
    const out = tempOut();
    const dir = runDir(out, "b");
    const keys: string[] = [];
    let fail = true;
    const gateway = fakeGateway(() => ({}), {
      startBatch: async (_requests, key) => {
        keys.push(key);
        if (fail) throw new Error("socket hang up");
        return { reference, warnings: [] };
      },
    });
    const logs: string[] = [];
    const rt = {
      ...runtime(out, gateway),
      log: (text: string) => logs.push(text),
    };
    await expect(
      execute(rt, { run: "b", dir, requests, transport: "batch", budget: 5 }),
    ).rejects.toThrow(/socket/);
    // Still reserved, and not to be run again as new.
    expect(reserved(out)).toBeCloseTo(batchWorst, 10);
    expect(pendingRequests(dir, requests)).toEqual([]);
    fail = false;
    await collect(
      rt,
      "b",
      dir,
      requests.map((one) => manifestRequest(one)),
      (ids) => requests.filter((one) => ids.includes(one.id)),
    );
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect(logs.join("\n")).toMatch(/same idempotency key/);
  });

  it("keep what came when results stop partway, and go on next time", async () => {
    const out = tempOut();
    const dir = runDir(out, "b");
    let broken = true;
    const gateway = fakeGateway(() => ({}), {
      startBatch: async () => ({ reference, warnings: [] }),
      async *batchResults() {
        yield {
          id: "a",
          ok: true,
          text: "one",
          finishReason: "stop",
          tokens: { ...NO_TOKENS, input: 10, output: 10, reasoning: 5 },
        };
        if (broken) throw new Error("connection reset");
        yield {
          id: "b",
          ok: true,
          text: "two",
          finishReason: "stop",
          tokens: { ...NO_TOKENS, input: 10, output: 10, reasoning: 5 },
        };
      },
    });
    const rt = runtime(out, gateway);
    await execute(rt, {
      run: "b",
      dir,
      requests,
      transport: "batch",
      budget: 5,
    });
    const manifest = requests.map((one) => manifestRequest(one));
    expect(await collect(rt, "b", dir, manifest)).toBe(false);
    expect(readRaw(dir, "a")?.text).toBe("one");
    expect(readRaw(dir, "b")).toBeUndefined();
    expect(reserved(out)).toBeCloseTo(batchWorst, 10);
    broken = false;
    expect(await collect(rt, "b", dir, manifest)).toBe(true);
    expect(readRaw(dir, "b")?.text).toBe("two");
    expect(readRaw(dir, "a")?.attempt).toBe(1);
    expect(reserved(out)).toBe(0);
    expect(rt.ledger.entries().map((one) => one.request)).toEqual(["a", "b"]);
  });

  it("fail every reply of a batch started with reasoning warnings", async () => {
    const out = tempOut();
    const dir = runDir(out, "b");
    const gateway = fakeGateway(() => ({}), {
      startBatch: async () => ({
        reference,
        warnings: [{ type: "compatibility", feature: "reasoning effort" }],
      }),
      async *batchResults() {
        yield { id: "a", ok: true, text: "x", tokens: { ...NO_TOKENS } };
        yield { id: "b", ok: true, text: "y", tokens: { ...NO_TOKENS } };
      },
    });
    const rt = runtime(out, gateway);
    await execute(rt, {
      run: "b",
      dir,
      requests,
      transport: "batch",
      budget: 5,
    });
    await collect(
      rt,
      "b",
      dir,
      requests.map((one) => manifestRequest(one)),
    );
    for (const id of ["a", "b"])
      expect(readRaw(dir, id)?.error).toMatch(/settings not applied/);
  });
});

// --- Scoring, judges and the bars, on made-up data -------------------------------

/** Key 1 of three rows, Key 2 as its context; CAOSGO's entry misleads A1. */
function smallData(): EvalData {
  const source: SourceData = {
    dictionary: {
      OL: entry("I, my"),
      ZORGE: entry("be friendly unto me"),
      CAOSGO: entry("ground"),
      CAOSG: entry("earth"),
    },
    rows: [
      row(1, 1, "OL", "I"),
      row(1, 2, "ZORGE", "be friendly unto me"),
      row(1, 3, "CAOSGO", "of the earth"),
      row(2, 1, "OL", "I"),
      row(2, 2, "CAOSG", "the earth"),
    ],
  };
  const folds = buildTestSet(source);
  markHard(folds, source.dictionary);
  return { ...source, grammar: "", folds };
}

const answer: AnswerItem[] = [
  { source: "OL", target: "I", basis: "attested", ref: "OL", token: 1 },
  { source: "ZORGE", target: "be kind", basis: "derived", token: 2 },
  { source: "CAOSGO", target: "soil", basis: "derived", token: 3 },
];

const same = (reason = ""): Verdict => ({ verdict: "same", reason });
const different = (reason = ""): Verdict => ({ verdict: "different", reason });

describe("scoring a run", () => {
  it("counts an unreadable reply as every row missing", () => {
    const out = tempOut();
    const data = smallData();
    const fold = data.folds[0];
    const spec = {
      key: 1,
      arm: "A2",
      task: 1,
      book: "open",
      model: "m",
      effort: "medium",
    } as const;
    const request = translateRequest(fold, spec, data);
    const manifest: Manifest = {
      runId: "r",
      kind: "translate",
      createdAt: "",
      transport: "sync",
      budget: 1,
      projection: 0,
      requests: [manifestRequest(request, { translate: spec })],
    };
    const dir = runDir(out, "r");
    writeJson(join(dir, "requests", `${request.id}.json`), {
      id: request.id,
      ok: true,
      text: "I think OL means I.",
      finishReason: "stop",
    });
    const { scored } = scoreRequests(manifest, dir, data);
    expect(scored[0].failure).toMatch(/unreadable/);
    expect(scored[0].scores.rows.map((one) => one.outcome)).toEqual([
      "missing",
      "missing",
      "missing",
    ]);
  });
});

describe("the judges", () => {
  it("fold two verdicts into correct, rejected or split", () => {
    expect(foldVerdicts(same(), same())).toBe("correct");
    expect(foldVerdicts(different(), different())).toBe("rejected");
    expect(foldVerdicts(same(), different())).toBe("split");
    expect(foldVerdicts(same(), undefined)).toBeUndefined();
  });

  it("read verdicts and leave unjudged rows waiting", () => {
    const item: JudgeCase = {
      answer: "x",
      key: 1,
      rows: [
        { row: "1.2", enochian: "ZORGE", dee: "d", answer: "a", meanings: [] },
        { row: "1.3", enochian: "CAOSGO", dee: "d", answer: "a", meanings: [] },
      ],
    };
    const opus = parseVerdicts(
      '```json\n{"verdicts": [{"row": "1.2", "verdict": "same", "reason": "kind"}, {"row": "1.3", "verdict": "same"}]}\n```',
    );
    const gpt = parseVerdicts(
      '```json\n{"verdicts": [{"row": "1.2", "verdict": "same", "reason": "ok"}]}\n```',
    );
    expect(parseVerdicts("none").error).toBeDefined();
    const rows = judgeRows(item, { opus: opus.verdicts, gpt: gpt.verdicts });
    expect(rows["1.2"].outcome).toBe("correct");
    expect(rows["1.3"].outcome).toBeUndefined();
    expect(judgeRequest(item, "gpt")).toMatchObject({
      id: "x_judge-gpt",
      model: "openai/gpt-6.1-sol",
      effort: "high",
    });
    expect(judgeRequest(item, "opus")).toMatchObject({
      model: "anthropic/claude-opus-5.5",
      effort: "medium",
    });
  });

  it("make rejected and split rows wrong and hard, and let the bars measure", () => {
    const data = smallData();
    const [fold] = data.folds;
    const score = () =>
      scoreFold(fold, answer, {
        task: 1,
        book: "open",
        dictionary: data.dictionary,
      });
    // A1 glosses CAOSGO "ground": sent to the judges.
    expect(fold.rows.map((one) => one.a1?.task1)).toEqual([
      "correct",
      "correct",
      "to judge",
    ]);
    const before = score();
    expect(before.rows.map((one) => one.outcome)).toEqual([
      "correct",
      "to judge",
      "to judge",
    ]);
    const item = judgeCase("A2-k01", fold, before, "open", data.dictionary);
    expect(item.rows.map((one) => [one.row, one.meanings])).toEqual([
      ["1.2", ["be friendly unto me [WE]"]],
      ["1.3", ["ground [WE]"]],
    ]);
    expect(() => measureBars({ a3Task1: report(before, "open") })).toThrow(
      /judge its/,
    );

    const judged = judgeRows(item, {
      opus: new Map([
        ["1.2", same()],
        ["1.3", same()],
      ]),
      gpt: new Map([
        ["1.2", same()],
        ["1.3", different()],
      ]),
    });
    const after = applyVerdicts(score(), judged);
    expect(after.rows.map((one) => one.outcome)).toEqual([
      "correct",
      "correct",
      "split",
    ]);
    // A1's own to-judge row still blocks the hard-row bar.
    expect(() => measureBars({ a3Task1: report(after, "open") })).toThrow(
      /A1's/,
    );

    // A1's verdicts: both judges turn "ground" down, so 1.3 is hard.
    const a1Case = judgeCase(
      "A1-k01",
      fold,
      a1Scores(fold, "open", data.dictionary).task1,
      "open",
      data.dictionary,
    );
    const a1Judged = judgeRows(a1Case, {
      opus: new Map([["1.3", different()]]),
      gpt: new Map([["1.3", different()]]),
    });
    markHard(
      data.folds,
      data.dictionary,
      new Map([["1.3", a1Judged["1.3"].outcome ?? "to judge"]]),
    );
    expect(fold.rows.map((one) => one.a1?.task1)).toEqual([
      "correct",
      "correct",
      "rejected",
    ]);
    const final = report(applyVerdicts(score(), judged), "open");
    expect(final.pooled.all.counts).toMatchObject({ correct: 2, split: 1 });
    expect(final.pooled.headline).toBeCloseTo(2 / 3);
    expect(final.hard.all.rows).toBe(1);
    expect(final.hard.headline).toBe(0);
    expect(final.a1ToJudge.all.rows).toBe(0);
    const bars = measureBars({ a3Task1: final });
    expect(bars.toEnglish).toBeCloseTo(2 / 3);
    expect(bars.toEnglishHard).toBe(0);
  });
});

describe("putting rows to the judges", () => {
  const item = (answer2: string): JudgeCase => ({
    answer: "x",
    key: 1,
    rows: [
      {
        row: "1.2",
        enochian: "ZORGE",
        dee: "be friendly unto me",
        answer: answer2,
        meanings: [],
      },
      {
        row: "1.3",
        enochian: "CAOSGO",
        dee: "of the earth",
        answer: "soil",
        meanings: [],
      },
    ],
  });
  const reply = (rows: string[], verdict = "same") =>
    `\`\`\`json\n${JSON.stringify({ verdicts: rows.map((row) => ({ row, verdict, reason: "r" })) })}\n\`\`\``;

  it("ask again, under a new id, for rows a reply left out", async () => {
    const out = tempOut();
    const gateway = fakeGateway((request) => ({
      text:
        request.id === "x_judge-opus"
          ? reply(["1.2"])
          : request.id === "x_judge-opus-retry-1"
            ? reply(["1.3"], "different")
            : reply(["1.2", "1.3"]),
    }));
    const result = await runJudges(runtime(out, gateway), {
      run: "j",
      dir: join(out, "judge"),
      cases: [item("be kind")],
      existing: {},
      budget: 5,
      source: "r",
    });
    expect(gateway.calls).toEqual([
      "x_judge-opus",
      "x_judge-gpt",
      "x_judge-opus-retry-1",
    ]);
    expect(result.judged.x["1.2"]).toMatchObject({
      answer: "be kind",
      outcome: "correct",
    });
    expect(result.judged.x["1.3"].outcome).toBe("split");
    expect(readFileSync(join(out, "expert-queue.tsv"), "utf8")).toContain(
      "r\tx\t1.3",
    );
    // A second command finds nothing left to ask.
    const again = await runJudges(runtime(out, gateway), {
      run: "j",
      dir: join(out, "judge"),
      cases: [item("be kind")],
      existing: result.judged,
      budget: 5,
      source: "r",
      dryRun: true,
    });
    expect(again.requests).toBe(0);
  });

  it("leave a row waiting when a judge never rules on it", async () => {
    const out = tempOut();
    const gateway = fakeGateway((request) => ({
      text: request.id.includes("opus")
        ? "no verdicts here"
        : reply(["1.2", "1.3"]),
    }));
    const result = await runJudges(runtime(out, gateway), {
      run: "j",
      dir: join(out, "judge"),
      cases: [item("be kind")],
      existing: {},
      budget: 5,
      source: "r",
    });
    // Asked once more, then left.
    expect(gateway.calls.filter((one) => one.includes("opus"))).toEqual([
      "x_judge-opus",
      "x_judge-opus-retry-1",
    ]);
    expect(result.judged.x["1.2"].outcome).toBeUndefined();
    expect(result.judged.x["1.2"].gpt?.verdict).toBe("same");
  });

  it("don't reuse a reply about an earlier answer", async () => {
    const out = tempOut();
    const gateway = fakeGateway(() => ({ text: reply(["1.2", "1.3"]) }));
    const first = await runJudges(runtime(out, gateway), {
      run: "j",
      dir: join(out, "judge"),
      cases: [item("be kind")],
      existing: {},
      budget: 5,
      source: "r",
    });
    expect(first.judged.x["1.2"].outcome).toBe("correct");
    // The translation was re-run and now says something else for 1.2.
    const scores = {
      rows: [
        {
          id: "1.2",
          key: 1,
          outcome: "to judge" as const,
          singleKey: true,
          knowableClosed: false,
          knowableOpen: true,
          answer: {
            source: "ZORGE",
            target: "be nice",
            basis: "derived" as const,
          },
        },
      ],
      items: [],
    };
    expect(applyVerdicts(scores, first.judged.x).rows[0].outcome).toBe(
      "to judge",
    );
    gateway.calls.length = 0;
    const second = await runJudges(runtime(out, gateway), {
      run: "j",
      dir: join(out, "judge"),
      cases: [{ ...item("be nice"), rows: [item("be nice").rows[0]] }],
      existing: first.judged,
      budget: 5,
      source: "r",
    });
    expect(gateway.calls).toEqual([
      "x_judge-opus-retry-1",
      "x_judge-gpt-retry-1",
    ]);
    expect(second.judged.x["1.2"]).toMatchObject({
      answer: "be nice",
      outcome: "correct",
    });
  });
});

describe("the bars of a run", () => {
  it("are unmeasurable on fewer than 19 Keys, or without a probe of the model", () => {
    const data = smallData();
    markHard(data.folds, data.dictionary, new Map([["1.3", "rejected"]]));
    const [fold] = data.folds;
    const right: AnswerItem[] = [
      { source: "OL", target: "I", basis: "attested", ref: "OL", token: 1 },
      { source: "ZORGE", target: "be friendly", basis: "derived", token: 2 },
      { source: "CAOSGO", target: "earth", basis: "derived", token: 3 },
    ];
    const scored = (arm: "A2" | "A2c" | "A3", task: 1 | 2) => ({
      id: `${arm}-${task}`,
      spec: {
        key: 1,
        arm,
        task,
        book: "open" as const,
        model: "m",
        effort: "medium" as const,
      },
      scores: scoreFold(fold, task === 1 ? right : [], {
        task,
        book: "open",
        dictionary: data.dictionary,
      }),
    });
    const pooled = groups([
      scored("A3", 1),
      scored("A3", 2),
      scored("A2", 1),
      scored("A2c", 1),
    ]);
    const [bars] = runBars(pooled, () => undefined);
    const byId = Object.fromEntries(
      (bars.results ?? []).map((one) => [one.bar.id, one]),
    );
    expect(byId.toEnglish.unmeasurable).toBe("run has 1 of 19 Keys");
    expect(byId.toEnglishHard.unmeasurable).toBe("run has 1 of 19 Keys");
    expect(byId.toEnochian.unmeasurable).toBe("run has 1 of 19 Keys");
    expect(byId.notMemory.unmeasurable).toMatch(/no recall probe of m/);
    expect(byId.toEnglish.met).toBeUndefined();
    // The figure itself is still in the run's report.
    expect(pooled[0].report.pooled.headline).toBe(1);
  });

  it("take probe flags only from a probe of the same model", () => {
    const out = tempOut();
    writeJson(join(runDir(out, "p1"), "probe.json"), {
      runId: "p1",
      model: "m",
      effort: "medium",
      keys: { 1: { flagged: true }, 2: { flagged: false } },
      flagged: [1],
    });
    expect(loadProbeFlags(out, "m")).toMatchObject({ run: "p1", model: "m" });
    expect(loadProbeFlags(out, "m")?.flagged).toEqual(new Set([1]));
    expect(loadProbeFlags(out, "other")).toBeUndefined();
    expect(() => loadProbeFlags(out, "other", "p1")).toThrow(/not other/);
  });
});

describe("replies that don't finish normally", () => {
  it("fail, keep their text and real cost, and only a filtered one is retried", async () => {
    const out = tempOut();
    const dir = runDir(out, "r");
    const gateway = fakeGateway((request) => ({
      text: "half a reply",
      gatewayCost: "0.03",
      finishReason: request.id === "a" ? "length" : "content-filter",
    }));
    const requests = ["a", "b"].map(smallRequest);
    await execute(runtime(out, gateway), {
      run: "r",
      dir,
      requests,
      transport: "sync",
      budget: 5,
    });
    expect(readRaw(dir, "a")).toMatchObject({
      ok: false,
      text: "half a reply",
      cost: 0.03,
      exact: true,
      finishReason: "length",
    });
    expect(readRaw(dir, "a")?.error).toMatch(/finish reason "length"/);
    expect(readRaw(dir, "b")?.error).toMatch(/content-filter/);
    // Cut off at the length limit counts against the model: never retried.
    expect(pendingRequests(dir, requests, true).map((one) => one.id)).toEqual([
      "b",
    ]);
    // Saved before the check: an "ok" reply that was filtered still fails.
    expect(
      failedRaw({
        ...(readRaw(dir, "a") as RawResult),
        ok: true,
        finishReason: "content-filter",
      }),
    ).toBe(true);
  });

  it("leave a probe side incomplete, never not recited", () => {
    const rows: KeyRowRecord[] = [
      row(1, 1, "OL", "I"),
      row(1, 2, "SONF", "reign"),
      row(1, 3, "VORSG", "over you"),
    ];
    const probe = probeKey(rows, {
      english: "",
      enochian: '```json\n{"rows": ["x"]}\n```',
    });
    expect(probe.incomplete).toBe(true);
    expect(probe.english).toBeUndefined();
    expect(probe.flagged).toBe(false);
  });
});

describe("holds and calibration", () => {
  it("settle each hold, and leave an unsettled one to reconcile", async () => {
    const out = tempOut();
    const seen: (string | undefined)[] = [];
    const gateway = fakeGateway(() => ({ gatewayCost: "0.1" }));
    const generate = gateway.generate;
    gateway.generate = async (request, hooks) => {
      seen.push(hooks?.signal ? "signal" : undefined);
      hooks?.onGenerationId?.(`gen_${request.id}`);
      return generate(request, hooks);
    };
    const rt = runtime(out, gateway);
    await execute(rt, {
      run: "r",
      dir: runDir(out, "r"),
      requests: [smallRequest("a")],
      transport: "sync",
      budget: 5,
    });
    expect(seen).toEqual(["signal"]);
    const lines = rt.ledger.entries();
    const hold = lines.find((one) => one.hold);
    expect(lines.find((one) => one.holdFor === hold?.id)?.generationId).toBe(
      "gen_a",
    );
    expect(rt.ledger.total()).toBeCloseTo(0.1, 10);
    // A crash: a hold and its note, never settled.
    rt.ledger.append({
      ...ledgerEntry(0.64),
      id: "h2",
      run: "r",
      request: "b",
      hold: true,
      unknown: true,
      exact: false,
    });
    rt.ledger.append({
      ...ledgerEntry(0),
      id: "n2",
      holdFor: "h2",
      generationId: "gen_b",
    });
    expect(unreconciled(rt.ledger.entries())).toMatchObject([
      { id: "h2", booked: 0.64, lookup: "gen_b" },
    ]);
    rt.gateway.generationCost = async () => 0.2;
    expect((await reconcile(rt)).fixed).toBe(1);
    expect(rt.ledger.total()).toBeCloseTo(0.3, 10);
  });

  it("measure chars per token, and stop when a call costs more than its hold", async () => {
    const out = tempOut();
    const gateway = fakeGateway(() => ({ gatewayCost: "1" }));
    const result = await execute(runtime(out, gateway), {
      run: "r",
      dir: runDir(out, "r"),
      requests: ["a", "b", "c"].map(smallRequest),
      transport: "sync",
      budget: 5,
    });
    expect(gateway.calls).toEqual(["a"]);
    expect(result.stopped).toMatch(/more than its worst case/);
    // 11 characters, 1,000 input tokens (the fake's).
    expect(readJson(calibrationPath(out))).toEqual({ judge: 11 / 1000 });
    expect(promptKind(smallRequest("x"))).toBe("judge");
  });
});

describe("batch items", () => {
  const reference: BatchReference = {
    version: 2,
    id: "batch_9",
    provider: "gateway",
  };

  it("book an item with no figure and no output at its worst case, and fail one with no reasoning", async () => {
    const out = tempOut();
    const dir = runDir(out, "b");
    const gateway = fakeGateway(() => ({}), {
      startBatch: async () => ({ reference, warnings: [] }),
      async *batchResults() {
        yield {
          id: "a",
          ok: true,
          text: "",
          finishReason: "stop",
          tokens: { ...NO_TOKENS, input: 10 },
        };
        yield {
          id: "b",
          ok: true,
          text: "y",
          finishReason: "stop",
          tokens: { ...NO_TOKENS, input: 10, output: 10 },
        };
      },
    });
    const requests = ["a", "b"].map(smallRequest);
    const rt = runtime(out, gateway);
    await execute(rt, {
      run: "b",
      dir,
      requests,
      transport: "batch",
      budget: 5,
    });
    await collect(
      rt,
      "b",
      dir,
      requests.map((one) => manifestRequest(one)),
    );
    expect(readRaw(dir, "a")).toMatchObject({ unknown: true });
    expect(readRaw(dir, "a")?.cost).toBeCloseTo(
      worstOf(smallRequest("a"), prices, "batch"),
      10,
    );
    expect(readRaw(dir, "b")?.error).toMatch(/no reasoning tokens/);
  });

  it("get a new idempotency key on each attempt", () => {
    expect(batchKey("r", "m", ["a"], 2)).not.toBe(batchKey("r", "m", ["a"], 1));
    expect(batchKey("r", "m", ["a"])).toBe(batchKey("r", "m", ["a"], 1));
  });
});

describe("answers that list alternatives", () => {
  it("are spotted by separator or by several dictionary senses", () => {
    expect(listsAlternatives("fire; flame")).toBe(true);
    expect(listsAlternatives("fire / flame")).toBe(true);
    expect(listsAlternatives("fire or flame")).toBe(true);
    expect(listsAlternatives("or")).toBe(false);
    expect(listsAlternatives("I am;")).toBe(false);
    expect(listsAlternatives("be friendly unto me;")).toBe(false);
    expect(listsAlternatives("a through thrusting fire")).toBe(false);
    expect(listsAlternatives("I, my", ["I, my"])).toBe(false);
    expect(listsAlternatives("I, my", ["I, my", "I"])).toBe(true);
    expect(listsAlternatives("earth, ground", ["earth", "ground"])).toBe(true);
  });

  it("don't let an every-sense answer beat A1 by script", () => {
    let shotgun = 0;
    let a1 = 0;
    let flagged = 0;
    for (const fold of realFolds) {
      const items: AnswerItem[] = fold.input.map((one, i) => {
        const word = one.word ?? "";
        const senses = Object.entries(realDictionary)
          .filter(([headword]) => headword === word)
          .flatMap(([, entry]) => entry.meanings.map((m) => m.meaning));
        return {
          source: word,
          target: senses.join("; ") || "unknown",
          basis: senses.length ? "derived" : "unknown",
          token: i + 1,
        };
      });
      const scores = scoreFold(fold, items, {
        task: 1,
        book: "open",
        dictionary: realDictionary,
        flagAlternatives: true,
      });
      shotgun += scores.rows.filter((r) => r.outcome === "correct").length;
      flagged += scores.rows.filter((r) => r.multiSense).length;
      a1 += a1Scores(fold, "open", realDictionary).task1.rows.filter(
        (r) => r.outcome === "correct",
      ).length;
    }
    expect(flagged).toBeGreaterThan(100);
    expect(shotgun).toBeLessThanOrEqual(a1);
  }, 30_000);
});

describe("attested items the checker can't settle", () => {
  it("go to the judges, who may find the reference doesn't support them", () => {
    const data = smallData();
    const [fold] = data.folds;
    // Cites Key 2.1 (OL = I) for ZORGE: real, but not ZORGE: an invention.
    // Cites ZORGE's own entry with English it doesn't give: to the judges.
    const items: AnswerItem[] = [
      { source: "OL", target: "I", basis: "attested", ref: "OL", token: 1 },
      {
        source: "ZORGE",
        target: "be friendly",
        basis: "attested",
        ref: "CAOSG",
        token: 2,
      },
    ];
    const flaggedData = {
      ...data,
      dictionary: { ...data.dictionary, ZORGE: entry("lover") },
    };
    const zorge: AnswerItem = {
      source: "ZORGE",
      target: "be friendly unto me",
      basis: "attested",
      ref: "ZORGE",
      token: 2,
    };
    const scores = scoreFold(fold, [items[0], zorge], {
      task: 1,
      book: "open",
      dictionary: flaggedData.dictionary,
      flagAlternatives: true,
    });
    const row2 = scores.rows.find((one) => one.id === "1.2");
    expect(row2).toMatchObject({ outcome: "to judge", refToJudge: true });
    const item = judgeCase("x", fold, scores, "open", flaggedData.dictionary);
    expect(item.rows[0].cited).toEqual({
      ref: "ZORGE",
      text: "ZORGE: lover [WE]",
    });
    expect(
      JSON.parse(judgeRequest(item, "opus").prompt.split("\n\n")[1])[0],
    ).toMatchObject({ cited: "ZORGE: lover [WE]" });
    const no = { verdict: "same" as const, reason: "", supported: false };
    const judged = judgeRows(item, {
      opus: new Map([["1.2", no]]),
      gpt: new Map([["1.2", no]]),
    });
    expect(judged["1.2"]).toMatchObject({
      outcome: "correct",
      unsupported: true,
    });
    const after = applyVerdicts(scores, judged);
    const m = report(after, "open").pooled.all;
    expect(m.judgedInventions).toBe(1);
    expect(m.silentInventions).toBe(1);
    // The CAOSG citation is an outright invention, by script.
    const other = scoreFold(fold, items, {
      task: 1,
      book: "open",
      dictionary: data.dictionary,
    });
    expect(other.items[1].check).toBe("invention");
  });
});

describe("the verdict store", () => {
  it("reuses rulings on the same translation of the same row", async () => {
    const out = tempOut();
    const reply = (rows: string[]) =>
      `\`\`\`json\n${JSON.stringify({ verdicts: rows.map((row) => ({ row, verdict: "same", reason: "r" })) })}\n\`\`\``;
    const gateway = fakeGateway(() => ({ text: reply(["1.2"]) }));
    const row = {
      row: "1.2",
      enochian: "ZORGE",
      dee: "be friendly unto me",
      answer: "Be kind.",
      meanings: [],
    };
    await runJudges(runtime(out, gateway), {
      run: "j",
      dir: join(out, "j1"),
      cases: [{ answer: "first", key: 1, rows: [row] }],
      existing: {},
      budget: 5,
      source: "r1",
    });
    expect(gateway.calls).toHaveLength(2);
    gateway.calls.length = 0;
    const again = await runJudges(runtime(out, gateway), {
      run: "j",
      dir: join(out, "j2"),
      cases: [
        { answer: "second", key: 1, rows: [{ ...row, answer: "be kind" }] },
      ],
      existing: {},
      budget: 5,
      source: "r2",
    });
    expect(gateway.calls).toEqual([]);
    expect(again.reused).toBe(1);
    expect(again.judged.second["1.2"].outcome).toBe("correct");
    expect(verdictKey(row)).toBe("1.2\tbe kind\t\t");
    expect(verdictKey({ ...row, alternatives: true })).not.toBe(
      verdictKey(row),
    );
  });
});

describe("probe coverage", () => {
  it("passes over a newer probe that doesn't cover the run's Keys", () => {
    const out = tempOut();
    const probe = (keysOf: Record<number, object>, flagged: number[]) => ({
      model: "m",
      effort: "medium",
      keys: keysOf,
      flagged,
    });
    writeJson(join(runDir(out, "p1-old"), "probe.json"), {
      runId: "p1-old",
      ...probe({ 1: { flagged: false }, 2: { flagged: true } }, [2]),
    });
    writeJson(join(runDir(out, "p2-new"), "probe.json"), {
      runId: "p2-new",
      ...probe({ 1: { flagged: false, incomplete: true } }, []),
    });
    expect(loadProbeFlags(out, "m")?.run).toBe("p2-new");
    expect(loadProbeFlags(out, "m", undefined, [1, 2])?.run).toBe("p1-old");
  });

  it("needs A2 and A2c on every Key the probe clears", () => {
    const data = smallData();
    const [fold] = data.folds;
    const make = (arm: "A2" | "A2c") => ({
      id: arm,
      spec: {
        key: 1,
        arm,
        task: 1 as const,
        book: "open" as const,
        model: "m",
        effort: "medium" as const,
      },
      scores: scoreFold(fold, [], {
        task: 1,
        book: "open",
        dictionary: data.dictionary,
      }),
    });
    const pooled = groups([make("A2"), make("A2c")]);
    const [bars] = runBars(pooled, () => ({
      run: "p",
      model: "m",
      probed: new Set([1, 2, 3]),
      flagged: new Set([3]),
    }));
    const memory = bars.results?.find((one) => one.bar.id === "notMemory");
    expect(memory?.unmeasurable).toMatch(/missing 2/);
  });
});

describe("closed-book contexts of the real data", () => {
  it("name no removed form in other entries' meanings or rows' GD forms", () => {
    for (const fold of realFolds) {
      const forms = removedForms(fold);
      const context = serialiseContext(fold, realDictionary, {
        book: "closed",
      });
      const [dictionaryPart, keysPart] = context.split("# The other Keys");
      const meanings = dictionaryPart
        .split("\n")
        .filter((line) => line.includes("\t") && !line.startsWith("#"))
        .map((line) => line.split("\t")[1]);
      const gd = keysPart
        .split("\n")
        .filter((line) => line.includes("\tGD: "))
        .map((line) => line.split("\tGD: ")[1]);
      const named = [...meanings, ...gd].flatMap((text) =>
        (text.match(/[A-Za-z]+/g) ?? []).filter((token) =>
          namesRemovedForm(token, forms),
        ),
      );
      expect(named, `Key ${fold.key}`).toEqual([]);
      for (const one of gd)
        expect(
          namesRemovedForm(one.replace(/[^A-Za-z]/g, ""), forms),
          `Key ${fold.key}: ${one}`,
        ).toBe(false);
    }
    const closed = (key: number) =>
      serialiseContext(
        realFolds.find((one) => one.key === key) as (typeof realFolds)[0],
        realDictionary,
        { book: "closed" },
      );
    expect(closed(10)).toContain("Root of …; woe");
    expect(closed(17)).not.toMatch(/HUBARO/);
    expect(closed(8)).not.toMatch(/'URAN'/);
    expect(closed(18)).not.toMatch(/^14\.20\t.*GD: Oiad/m);
  });
});

describe("the recall probe", () => {
  const rows: KeyRowRecord[] = [
    row(1, 1, "OL", "I"),
    row(1, 2, "SONF", "reign"),
    row(1, 3, "VORSG", "over you"),
    row(1, 4, "GOHO", "saith"),
    row(1, 5, "IAD", "the God"),
    row(1, 6, "BALT", "of Justice"),
  ];

  it("asks for each side from the Key's number and first row", () => {
    const [english, enochian] = probeRequests(
      rows,
      "anthropic/claude-opus-5.5",
      "medium",
    );
    expect(english.id).toBe("probe-english-k01-opus-medium");
    expect(enochian.id).toBe("probe-enochian-k01-opus-medium");
    expect(english.prompt).toContain("Key 1 begins with the word OL");
    expect(english.prompt).toContain('"I"');
    expect(english.prompt).not.toContain("SONF");
  });

  it("scores the longest in-order match and flags at half", () => {
    const scored = rows.slice(1);
    expect(
      inOrderMatches(
        scored,
        ["reigns", "over you", "God", "justice"],
        "english",
      ),
    ).toBe(4);
    // Out of order: only an ordered subsequence counts.
    expect(inOrderMatches(scored, ["justice", "God", "reign"], "english")).toBe(
      1,
    );
    expect(
      inOrderMatches(scored, ["sonf", "UORSG", "x", "BALT"], "enochian"),
    ).toBe(3);
    const reply = (list: string[]) =>
      `\`\`\`json\n${JSON.stringify({ rows: list })}\n\`\`\``;
    const flagged = probeKey(rows, {
      english: reply(["nothing"]),
      enochian: reply(["SONF", "VORSG", "GOHO"]),
    });
    expect(flagged.enochian?.share).toBe(3 / 5);
    expect(flagged.flagged).toBe(true);
    const clear = probeKey(rows, {
      english: reply(["reign", "over you"]),
      enochian: reply([]),
    });
    expect(clear.english?.share).toBe(2 / 5);
    expect(clear.english?.share).toBeLessThan(FLAG_SHARE);
    expect(clear.flagged).toBe(false);
    // A reply not in the asked shape is still read, line by line.
    expect(
      probeKey(rows, { english: "reign\nover you\nsaith" }).english,
    ).toMatchObject({
      matched: 3,
    });
    expect(probeKey(rows, { english: reply([]) }).incomplete).toBe(true);
  });
});
