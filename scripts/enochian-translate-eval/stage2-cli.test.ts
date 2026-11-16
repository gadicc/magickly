import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  budgetCommand,
  callCostsCommand,
  evalData,
  newBarsCommand,
  printCallCosts,
  runNew,
  runtimeFor,
} from "./cli.ts";
import {
  EXPERIMENT_CAP_USD,
  Ledger,
  type LedgerEntry,
  NO_TOKENS,
  planPriceList,
  STAGE2,
} from "./ledger.ts";
import { MODELS } from "./models.ts";
import { type NewSpec, newRequest, planNewSpecs } from "./newprompt.ts";
import { keptRecordPath, task3Pool, task3Summary } from "./newrunner.ts";
import {
  type EvalData,
  ledgerPath,
  type Manifest,
  manifestRequest,
  type RawResult,
  runDir,
  writeJson,
} from "./runner.ts";
import { promptHash } from "./transport.ts";

/**
 * Plan 081 stage 2's CLI wiring: the commands as the CLI runs them, on a
 * temporary output directory, offline (no network, no key).
 */

const dirs: string[] = [];
let logged: string[] = [];
let tables: unknown[] = [];
beforeEach(() => {
  logged = [];
  tables = [];
  vi.spyOn(console, "log").mockImplementation((...args) => {
    logged.push(args.join(" "));
  });
  vi.spyOn(console, "table").mockImplementation((rows) => {
    tables.push(rows);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function tempOut() {
  const dir = mkdtempSync(join(tmpdir(), "translate-eval-stage2-cli-"));
  dirs.push(dir);
  return dir;
}

const entry = (
  cost: number,
  at: string,
  more: Partial<LedgerEntry> = {},
): LedgerEntry => ({
  id: `${at}-${cost}-${more.request ?? ""}`,
  at,
  run: "r",
  request: "x",
  model: "m",
  transport: "sync",
  tokens: NO_TOKENS,
  cost,
  exact: true,
  ...more,
});

/** A new-text run's requests, as `run --set new` builds them. */
function requestsFor(
  data: EvalData,
  model: string,
  arms: NewSpec["arm"][],
  tasks: (1 | 2)[],
  subset: NewSpec["subset"] = "all",
) {
  const specs = planNewSpecs(
    { arms, tasks, subset, model, efforts: ["medium"] },
    data,
  );
  return specs.map((spec) => ({ spec, request: newRequest(spec, data) }));
}

/**
 * A finished new-text run on disk: its manifest and, unless `replies` is
 * false, a reply for every request (failed in transport, so every row
 * counts missing, which is enough to measure).
 */
function writeRun(
  out: string,
  runId: string,
  planned: ReturnType<typeof requestsFor>,
  replies = true,
  kind: Manifest["kind"] = "newtext",
) {
  const dir = runDir(out, runId);
  writeJson(join(dir, "manifest.json"), {
    runId,
    kind,
    createdAt: "",
    transport: "sync",
    budget: 1,
    projection: 0,
    requests: planned.map(({ spec, request }) =>
      manifestRequest(request, { newtext: spec }),
    ),
  } satisfies Manifest);
  if (replies)
    for (const { request } of planned)
      writeJson(join(dir, "requests", `${request.id}.json`), {
        id: request.id,
        promptHash: promptHash(request),
        model: request.model,
        effort: request.effort,
        transport: "sync",
        ok: false,
        text: "",
        error: "socket",
        tokens: { ...NO_TOKENS },
        cost: 0,
        exact: true,
        attempt: 1,
        at: "2026-11-16T00:00:00.000Z",
      } satisfies RawResult);
}

/** Every file under a directory, by path, with its hash and mtime. */
function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else
        out[relative(root, path)] =
          `${createHash("sha256").update(readFileSync(path)).digest("hex")} ${statSync(path).mtimeMs}`;
    }
  };
  walk(root);
  return out;
}

describe("runtimeFor", { timeout: 60_000 }, () => {
  it("sets the runtime's cap from the ledger: stage 2's share on top of what came before", async () => {
    const out = tempOut();
    const ledger = new Ledger(ledgerPath(out));
    ledger.append(entry(20, "2026-11-13T08:00:00.000Z"));
    ledger.append(entry(3, "2026-11-15T08:00:00.000Z"));
    const runtime = await runtimeFor(out, [MODELS.sonnet], {
      prices: planPriceList([MODELS.sonnet]),
    });
    expect(runtime.cap).toBe(20 + STAGE2.capUsd);
    // An empty ledger: stage 2's share alone, never plan 077's $100.
    const empty = await runtimeFor(tempOut(), [MODELS.sonnet], {
      prices: planPriceList([MODELS.sonnet]),
    });
    expect(empty.cap).toBe(STAGE2.capUsd);
    expect(empty.cap).not.toBe(EXPERIMENT_CAP_USD);
  });
});

describe("run --set new, against earlier runs", { timeout: 60_000 }, () => {
  const v = {
    "dry-run": true,
    offline: true,
    model: "sonnet",
    arms: "A3",
    tasks: "1",
    subset: "first30",
  };

  function setUp() {
    const out = tempOut();
    const planned = requestsFor(
      evalData(out),
      MODELS.sonnet,
      ["A3"],
      [1],
      "first30",
    );
    // An earlier run that sent the first two parts only.
    writeRun(out, "20261115-000000-partial", planned.slice(0, 2), false);
    return { out, planned };
  }

  it("would refuse by default, naming the run and the ways on", async () => {
    const { out, planned } = setUp();
    await runNew(out, v, "new", 5, "sync");
    const text = logged.join("\n");
    expect(text).toMatch(
      new RegExp(
        `WOULD REFUSE: 20261115-000000-partial already has 2 of these ${planned.length} requests.*--skip-held.*--again`,
      ),
    );
    expect(text).toMatch(
      new RegExp(`^${planned.length} requests by sync`, "m"),
    );
  });

  it("sends only the requests no run holds with --skip-held", async () => {
    const { out, planned } = setUp();
    await runNew(out, { ...v, "skip-held": true }, "new", 5, "sync");
    const text = logged.join("\n");
    expect(text).not.toMatch(/WOULD REFUSE/);
    expect(text).toMatch(
      `--skip-held: 2 of ${planned.length} requests are held by earlier runs (20261115-000000-partial: 2); sending the other ${planned.length - 2}`,
    );
    expect(text).toMatch(
      new RegExp(`^${planned.length - 2} requests by sync`, "m"),
    );
  });

  it("repeats them all with --again, and takes only one of the two", async () => {
    const { out, planned } = setUp();
    await runNew(out, { ...v, again: true }, "new", 5, "sync");
    const text = logged.join("\n");
    expect(text).not.toMatch(/WOULD REFUSE|--skip-held/);
    expect(text).toMatch(
      new RegExp(`^${planned.length} requests by sync`, "m"),
    );
    await expect(
      runNew(out, { ...v, again: true, "skip-held": true }, "new", 5, "sync"),
    ).rejects.toThrow(/can't be used together/);
  });
});

describe("newbars --model", { timeout: 120_000 }, () => {
  it("measures the named model's A3 into newbars-M.json, records the runs and writes nothing else", () => {
    const out = tempOut();
    const data = evalData(out);
    writeRun(
      out,
      "20261113-000000-newtext-opus",
      requestsFor(data, MODELS.opus, ["A0"], [1]),
    );
    writeRun(
      out,
      "20261115-000000-stage2-newtext-sonnet",
      requestsFor(data, MODELS.sonnet, ["A3"], [1, 2]),
    );
    // Another model's A3 in the same folder isn't picked up.
    writeRun(
      out,
      "20261116-000000-stage2-newtext-haiku",
      requestsFor(data, MODELS.haiku, ["A3"], [1]),
    );
    const before = snapshot(out);
    newBarsCommand(out, { model: "sonnet" });
    const after = snapshot(out);
    const file = join(out, "newbars-sonnet.json");
    expect(existsSync(file)).toBe(true);
    expect(existsSync(join(out, "newbars.json"))).toBe(false);
    // Read-only: no run's scores or report, no task-3 report.
    const { "newbars-sonnet.json": _written, ...rest } = after;
    expect(rest).toEqual(before);
    const saved = JSON.parse(readFileSync(file, "utf8"));
    expect(saved.inputs.model).toBe(MODELS.sonnet);
    expect(saved.inputs.resolved).toEqual({
      a3Task1: ["20261115-000000-stage2-newtext-sonnet"],
      a3Task2: ["20261115-000000-stage2-newtext-sonnet"],
      a0Task1: ["20261113-000000-newtext-opus"],
      task3: null,
      blocked: ["20261115-000000-stage2-newtext-sonnet"],
    });
    const bar = (id: string) =>
      saved.bars.find((one: { id: string }) => one.id === id);
    // Every reply failed, so every row is missing: measured, and not met.
    expect(bar("toEnglish").measured).toMatchObject({ count: 0, rows: 500 });
    expect(bar("blocked").measured).toMatchObject({ count: 0, rows: 16 });
  });

  it("counts blocked calls as plan 077 did for its recorded --runs, leaving out only the runs it didn't choose", () => {
    const out = tempOut();
    const data = evalData(out);
    const r1a3 = requestsFor(data, MODELS.opus, ["A3"], [1]);
    const r1a0 = requestsFor(data, MODELS.opus, ["A0"], [1]);
    const repeat = requestsFor(data, MODELS.opus, ["A3"], [1], "repeat");
    const s2 = requestsFor(data, MODELS.opus, ["A3"], [1]);
    writeRun(out, "20261112-000000-newtext-opus", r1a3);
    writeRun(out, "20261113-000000-newtext-opus-a0", r1a0);
    writeRun(out, "20261113-000001-newtext-opus-repeat", repeat);
    writeRun(out, "20261115-000000-stage2-newtext-opus", s2);
    // Without --runs, two Opus A3 runs on one set are refused: name one.
    expect(() => newBarsCommand(out, {})).toThrow(/both have A3 task 1/);
    newBarsCommand(out, {
      runs: "20261112-000000-newtext-opus,20261113-000000-newtext-opus-a0",
    });
    const saved = JSON.parse(readFileSync(join(out, "newbars.json"), "utf8"));
    // The repeats count, as on 13 November; stage 2's A3 run doesn't.
    expect(saved.inputs.resolved.blocked).toEqual([
      "20261112-000000-newtext-opus",
      "20261113-000000-newtext-opus-a0",
      "20261113-000001-newtext-opus-repeat",
    ]);
    expect(
      saved.bars.find((one: { id: string }) => one.id === "blocked").measured,
    ).toMatchObject({ rows: r1a3.length + r1a0.length + repeat.length });
    // Stage 2's control leaves out round 1's A3 run instead.
    newBarsCommand(out, {
      model: "opus",
      runs: "20261115-000000-stage2-newtext-opus,20261113-000000-newtext-opus-a0",
    });
    const control = JSON.parse(
      readFileSync(join(out, "newbars-opus.json"), "utf8"),
    );
    expect(control.inputs.resolved.a3Task1).toEqual([
      "20261115-000000-stage2-newtext-opus",
    ]);
    expect(control.inputs.resolved.blocked).not.toContain(
      "20261112-000000-newtext-opus",
    );
  });

  it("counts complementary round-trip runs both, whichever is named (the third review's case)", () => {
    const out = tempOut();
    const data = evalData(out);
    const changed = (
      planned: ReturnType<typeof requestsFor>,
      prompt: string,
    ): ReturnType<typeof requestsFor> =>
      planned.map((one) => ({
        ...one,
        request: { ...one.request, prompt: `${one.request.prompt} ${prompt}` },
      }));
    const r1a3 = requestsFor(data, MODELS.opus, ["A3"], [1]);
    const r1a0 = requestsFor(data, MODELS.opus, ["A0"], [1]);
    // Round 1's round trips: a first run of 3, then 15 that redo those 3
    // ids with another prompt and add 12; stand-ins of the same shape.
    const trips = requestsFor(data, MODELS.opus, ["A2"], [1, 2]);
    const trip1 = changed(trips.slice(0, 3), "first");
    const trip2 = changed(trips.slice(0, 15), "second");
    // Stage 2's Opus A3: the same ids as round 1's, another prompt.
    const s2 = changed(r1a3, "new dictionary");
    writeRun(out, "20261112-000000-newtext-opus", r1a3);
    writeRun(out, "20261112-000001-roundtrip-opus", trip1, true, "roundtrip");
    writeRun(out, "20261113-000000-newtext-opus-a0", r1a0);
    writeRun(out, "20261113-000001-roundtrip-opus", trip2, true, "roundtrip");
    // An exact repeat of the first round trips is an alternative.
    writeRun(out, "20261113-000002-roundtrip-opus", trip1, true, "roundtrip");
    writeRun(out, "20261115-000000-stage2-newtext-opus", s2);
    newBarsCommand(out, {
      runs: "20261112-000000-newtext-opus,20261113-000000-newtext-opus-a0,20261112-000001-roundtrip-opus",
    });
    const saved = JSON.parse(readFileSync(join(out, "newbars.json"), "utf8"));
    expect(saved.inputs.resolved.blocked).toEqual([
      "20261112-000000-newtext-opus",
      "20261112-000001-roundtrip-opus",
      "20261113-000000-newtext-opus-a0",
      "20261113-000001-roundtrip-opus",
    ]);
    expect(
      saved.bars.find((one: { id: string }) => one.id === "blocked").measured,
    ).toMatchObject({
      rows: r1a3.length + r1a0.length + trip1.length + trip2.length,
    });
    // Named the other way, the same two round-trip runs count.
    newBarsCommand(out, {
      force: true,
      runs: "20261112-000000-newtext-opus,20261113-000000-newtext-opus-a0,20261113-000001-roundtrip-opus",
    });
    const other = JSON.parse(readFileSync(join(out, "newbars.json"), "utf8"));
    expect(other.inputs.resolved.blocked).toContain(
      "20261112-000001-roundtrip-opus",
    );
    expect(other.inputs.resolved.blocked).not.toContain(
      "20261115-000000-stage2-newtext-opus",
    );
  });

  it("keeps a model's cache check in its blocked count with --runs", () => {
    const out = tempOut();
    const data = evalData(out);
    const run = requestsFor(data, MODELS.sonnet, ["A3"], [1, 2]);
    writeRun(
      out,
      "20261115-000000-cache-check-sonnet",
      run.slice(0, 2),
      true,
      "cache-check",
    );
    writeRun(out, "20261115-000001-stage2-newtext-sonnet", run);
    newBarsCommand(out, {
      model: "sonnet",
      runs: "20261115-000001-stage2-newtext-sonnet",
    });
    const saved = JSON.parse(
      readFileSync(join(out, "newbars-sonnet.json"), "utf8"),
    );
    expect(saved.inputs.resolved.blocked).toEqual([
      "20261115-000000-cache-check-sonnet",
      "20261115-000001-stage2-newtext-sonnet",
    ]);
    expect(
      saved.bars.find((one: { id: string }) => one.id === "blocked").measured,
    ).toMatchObject({ rows: run.length + 2 });
  });

  it("keeps newbars.json, round 1's record, unless --force", () => {
    const out = tempOut();
    const data = evalData(out);
    writeRun(
      out,
      "20261115-000000-stage2-newtext-sonnet",
      requestsFor(data, MODELS.sonnet, ["A3"], [1, 2]),
    );
    writeJson(join(out, "newbars.json"), { round: 1 });
    const before = readFileSync(join(out, "newbars.json"), "utf8");
    expect(() => newBarsCommand(out, {})).toThrow(
      /newbars\.json holds plan 077 round 1's bars and is kept/,
    );
    expect(readFileSync(join(out, "newbars.json"), "utf8")).toBe(before);
    // --model writes its own file, newbars.json left alone.
    newBarsCommand(out, { model: "sonnet" });
    expect(existsSync(join(out, "newbars-sonnet.json"))).toBe(true);
    expect(readFileSync(join(out, "newbars.json"), "utf8")).toBe(before);
    newBarsCommand(out, { force: true });
    expect(readFileSync(join(out, "newbars.json"), "utf8")).not.toBe(before);
  });

  it("pools a run finished with --skip-held with the run it finishes, refusing overlap or a gap", () => {
    const out = tempOut();
    const data = evalData(out);
    // The reviewer's case: the first two parts, then the rest.
    const planned = requestsFor(data, MODELS.sonnet, ["A3"], [1, 2]);
    writeRun(out, "20261116-000000-partial", planned.slice(0, 2));
    // Only the partial run: a gap.
    expect(() => newBarsCommand(out, { model: "sonnet" })).toThrow(
      /20261116-000000-partial: A3 task 1 covers \d+ rows, its set 600/,
    );
    writeRun(out, "20261116-000001-skipheld", planned.slice(2));
    newBarsCommand(out, { model: "sonnet" });
    const saved = JSON.parse(
      readFileSync(join(out, "newbars-sonnet.json"), "utf8"),
    );
    expect(saved.inputs.resolved.a3Task1).toEqual([
      "20261116-000000-partial",
      "20261116-000001-skipheld",
    ]);
    expect(saved.inputs.resolved.a3Task2).toEqual(["20261116-000001-skipheld"]);
    expect(
      saved.bars.find((one: { id: string }) => one.id === "toEnglish").measured,
    ).toMatchObject({ rows: 500 });
    // A third run with a part already held: overlap, refused.
    writeRun(out, "20261116-000002-again", planned.slice(0, 1));
    expect(() => newBarsCommand(out, { model: "sonnet" })).toThrow(
      /Runs 20261116-000000-partial and 20261116-000002-again both have A3 task 1/,
    );
  });
});

describe("task 3's report", { timeout: 60_000 }, () => {
  it("keeps round 1's task3/report.json: a dated file unless forced", () => {
    const out = tempOut();
    const data = evalData(out);
    const pool = task3Pool(out, data);
    const written: string[] = [];
    const onWrite = (path: string) => written.push(path);
    task3Summary(out, data, pool.candidates, pool.a1, { onWrite });
    const path = join(out, "task3", "report.json");
    expect(written).toEqual([path]);
    writeJson(path, { round: 1 });
    const before = readFileSync(path, "utf8");
    task3Summary(out, data, pool.candidates, pool.a1, { onWrite });
    expect(readFileSync(path, "utf8")).toBe(before);
    expect(written[1]).toMatch(/task3\/report-\d{8}-\d{6}\.json$/);
    expect(existsSync(written[1])).toBe(true);
    task3Summary(out, data, pool.candidates, pool.a1, { onWrite, force: true });
    expect(written[2]).toBe(path);
    expect(readFileSync(path, "utf8")).not.toBe(before);
    expect(
      keptRecordPath("/x/report.json", false, new Date("2026-11-16T12:34:56Z")),
    ).toBe("/x/report.json");
  });
});

describe("printCallCosts", { timeout: 60_000 }, () => {
  it("groups calls by model, arm, task and effort, each labelled cold, warm and mean", () => {
    const out = tempOut();
    const ledger = new Ledger(ledgerPath(out));
    const call = (
      run: string,
      request: string,
      model: string,
      cost: number,
      cached: number,
    ) =>
      ledger.append(
        entry(cost, "2026-11-15T10:00:00.000Z", {
          run,
          request,
          model,
          tokens: { ...NO_TOKENS, input: 1000, cached, output: 10 },
        }),
      );
    // The cache check's first call is cold; the run's are warm, but one
    // missed the cache.
    call("cc", "N-A3-t1-all-p01-sonnet-medium", MODELS.sonnet, 0.24, 0);
    call("cc", "N-A3-t1-all-p02-sonnet-medium", MODELS.sonnet, 0.04, 950);
    call("run", "N-A3-t1-all-p03-sonnet-medium", MODELS.sonnet, 0.04, 950);
    call("run", "N-A3-t1-all-p04-sonnet-medium", MODELS.sonnet, 0.2, 0);
    call("run", "N-A3-t2-all-p01-sonnet-medium", MODELS.sonnet, 0.05, 900);
    call("run", "N-A3-t1-all-p01-haiku-medium", MODELS.haiku, 0.01, 0);
    printCallCosts(out, ["cc", "run"]);
    expect(tables).toHaveLength(1);
    const rows = tables[0] as Record<string, unknown>[];
    expect(rows.map((one) => one.group)).toEqual([
      "sonnet A3 task 1 medium",
      "sonnet A3 task 2 medium",
      "haiku A3 task 1 medium",
    ]);
    expect(rows[0]).toMatchObject({
      calls: 4,
      "mean, all calls": "$0.1300",
      "cold: read nothing cached": "$0.2200 (2)",
      "warm: read the cache": "$0.0400 (2)",
      "warm calls' input read cached": "95.0%",
      failed: 0,
    });
    expect(rows[2]).toMatchObject({
      "warm: read the cache": "none",
      "warm calls' input read cached": "–",
      runs: "run",
    });
    expect(rows[0].runs).toBe("cc, run");
  });

  it("defaults (call-costs) to stage 2's runs, so rounds aren't pooled", () => {
    const out = tempOut();
    const data = evalData(out);
    const planned = requestsFor(data, MODELS.opus, ["A3"], [1]).slice(0, 1);
    writeRun(out, "r1", planned, false);
    writeRun(out, "s2", planned, false);
    const ledger = new Ledger(ledgerPath(out));
    for (const [run, at] of [
      ["r1", "2026-11-12T10:00:00.000Z"],
      ["s2", STAGE2.from],
    ])
      ledger.append(
        entry(0.5, at, {
          run,
          request: planned[0].request.id,
          model: MODELS.opus,
          tokens: { ...NO_TOKENS, input: 1000, output: 10 },
        }),
      );
    callCostsCommand(out, {});
    const rows = tables[0] as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ calls: 1, runs: "s2" });
    tables.length = 0;
    callCostsCommand(out, { runs: "r1,s2" });
    expect((tables[0] as Record<string, unknown>[])[0]).toMatchObject({
      calls: 2,
      runs: "r1, s2",
    });
  });
});

describe("budget --models", { timeout: 120_000 }, () => {
  it("projects each model's cache check, run and judges offline, against the ledger's cap", async () => {
    const out = tempOut();
    new Ledger(ledgerPath(out)).append(entry(25, "2026-11-13T08:00:00.000Z"));
    await budgetCommand(out, {
      models: "sonnet,opus",
      subset: "first30",
      offline: true,
    });
    const rows = tables.at(-1) as Record<string, unknown>[];
    expect(rows.map((one) => `${one.model}: ${one.part}`)).toEqual([
      "sonnet: cache check (explicit caching)",
      "sonnet: A3 tasks 1 and 2, first30",
      "sonnet: judges, task 1 (as many rows as A1k's)",
      "opus: A3 tasks 1 and 2, first30",
      "opus: judges, task 1 (as many rows as A1k's)",
      "Total: ",
    ]);
    for (const one of rows.slice(0, -1))
      expect(one["--budget"]).toBeGreaterThan(0);
    expect(logged.join("\n")).toMatch(
      /Spent so far \$25\.00 of the \$40\.00 cap .*: \$15\.00 left\./,
    );
  });
});
