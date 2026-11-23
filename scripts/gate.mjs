import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

/**
 * The local gates (plan: Loom `docs/landing.md`, item 1).
 *
 * `pnpm gate` runs what CI's required `verify` check and the release job
 * run, step by step, in this checkout: install, Loom's checks, lint,
 * translations, types, both package smokes, the tests with coverage and
 * both builds. `pnpm gate:quick` runs the checks that queue for no CPUs
 * (lint, translations, types), for a landing after a clean rebase.
 *
 * Every step runs with an environment cut down to `KEPT_ENV`, plus CI's
 * placeholder values from `.env.ci`, which win. So no step sees a real
 * credential or a session's `.env.local` values from the shell, and the
 * gate behaves as CI does. Next never reads `.env.ci` itself (it reads
 * `.env`, `.env.local` and `.env.{development,production,test}[.local]`),
 * so `pnpm dev` is unaffected.
 *
 * Each step's duration and exit code go to a tab-separated log under the
 * git common directory (`gate-logs/`), shared by every worktree, because
 * how long a gate takes has never been measured. The gate stops at the
 * first failing step and exits with its code.
 */

/** Variables a step keeps from the caller's environment. */
export const KEPT_ENV = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LANGUAGE",
  "TERM",
  "COLORTERM",
  "FORCE_COLOR",
  "NO_COLOR",
  "TMPDIR",
  "TZ",
  "XDG_RUNTIME_DIR",
  "PNPM_HOME",
];

/**
 * The steps of each tier. Steps that build with Next, or run many
 * compilers, go through `loom slots` like every heavy task here; the test
 * and build tasks already do so themselves.
 *
 * @type {Record<"full" | "quick", { id: string, command: string[] }[]>}
 */
export const STEPS = {
  quick: [
    { id: "check", command: ["pnpm", "check"] },
    { id: "i18n:check", command: ["pnpm", "i18n:check"] },
    { id: "typecheck", command: ["pnpm", "typecheck"] },
  ],
  full: [
    { id: "install", command: ["pnpm", "install", "--frozen-lockfile"] },
    { id: "loom check", command: ["pnpm", "exec", "loom", "check"] },
    { id: "check", command: ["pnpm", "check"] },
    { id: "i18n:check", command: ["pnpm", "i18n:check"] },
    { id: "typecheck", command: ["pnpm", "typecheck"] },
    {
      id: "--filter magick-data smoke",
      command: [
        "pnpm",
        "exec",
        "loom",
        "slots",
        "pin",
        "--",
        "pnpm",
        "--filter",
        "magick-data",
        "smoke",
      ],
    },
    { id: "test:coverage", command: ["pnpm", "test:coverage"] },
    { id: "build", command: ["pnpm", "build"] },
    { id: "check:turbopack", command: ["pnpm", "check:turbopack"] },
    {
      id: "--filter magick-components smoke",
      command: [
        "pnpm",
        "exec",
        "loom",
        "slots",
        "run",
        "--label",
        "gate:components-smoke",
        "--max",
        "6",
        "--",
        "pnpm",
        "--filter",
        "magick-components",
        "smoke",
        "--allow-unpublished-data",
      ],
    },
    {
      id: "loom check --production",
      command: ["pnpm", "exec", "loom", "check", "--production"],
    },
  ],
};

/**
 * Reads `.env.ci`: one `KEY=value` a line, nothing else. The format stays
 * this plain (no quotes, no comments, no `export`) so the same file can be
 * appended to GitHub's `$GITHUB_ENV` unchanged.
 *
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseEnvFile(text) {
  /** @type {Record<string, string>} */
  const values = {};
  for (const [index, line] of text.split("\n").entries()) {
    if (line === "") continue;
    const match = /^([A-Z][A-Z0-9_]*)=([^"'\s#][^\s]*)$/.exec(line);
    if (!match)
      throw new Error(`.env.ci line ${index + 1} is not a plain KEY=value`);
    const [, key, value] = match;
    if (key in values) throw new Error(`.env.ci sets ${key} twice`);
    values[key] = value;
  }
  return values;
}

/**
 * A step's environment: only `KEPT_ENV` from the caller, then the file's
 * values, which win.
 *
 * @param {Record<string, string | undefined>} callerEnv
 * @param {Record<string, string>} fileEnv
 * @returns {Record<string, string>}
 */
export function gateEnv(callerEnv, fileEnv) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const name of KEPT_ENV) {
    const value = callerEnv[name];
    if (value !== undefined) env[name] = value;
  }
  for (const [name, value] of Object.entries(callerEnv))
    if (name.startsWith("LC_") && value !== undefined) env[name] = value;
  return { ...env, ...fileEnv };
}

/**
 * Why this Node can't run the gate, or `undefined` when it can: its major
 * version must be `.nvmrc`'s, as in CI.
 *
 * @param {string} nodeVersion `process.versions.node`
 * @param {string} nvmrc the file's text
 * @returns {string | undefined}
 */
export function nodeProblem(nodeVersion, nvmrc) {
  const wanted = nvmrc.trim().replace(/^v/, "").split(".")[0];
  const major = nodeVersion.split(".")[0];
  return major === wanted
    ? undefined
    : `Node ${nodeVersion} is not Node ${wanted} (.nvmrc); run \`nvm use\``;
}

/**
 * One log line per step, tab-separated: step, seconds, exit code.
 *
 * @param {string} id
 * @param {number} seconds
 * @param {number} code
 */
export function logLine(id, seconds, code) {
  return `${id}\t${seconds.toFixed(1)}\t${code}\n`;
}

function git(...args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function run(command, env) {
  return new Promise((done) => {
    const child = spawn(command[0], command.slice(1), {
      env,
      stdio: "inherit",
    });
    child.on("error", () => done(127));
    child.on("close", (code, signal) => done(code ?? (signal ? 128 : 1)));
  });
}

/**
 * Runs a tier's steps in order, logging each, and stops at the first
 * failure.
 *
 * @param {"full" | "quick"} tier
 * @returns {Promise<number>} the exit code
 */
async function main(tier) {
  const steps = STEPS[tier];
  if (!steps) {
    console.error("usage: node scripts/gate.mjs full|quick");
    return 2;
  }
  const problem = nodeProblem(
    process.versions.node,
    readFileSync(".nvmrc", "utf8"),
  );
  if (problem) {
    console.error(`gate: ${problem}`);
    return 2;
  }
  const env = gateEnv(
    process.env,
    parseEnvFile(readFileSync(".env.ci", "utf8")),
  );

  const logs = resolve(git("rev-parse", "--git-common-dir"), "gate-logs");
  mkdirSync(logs, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, "");
  const head = git("rev-parse", "--short", "HEAD");
  const log = resolve(logs, `${stamp}-${tier}-${head}.tsv`);
  const dirty = git("status", "--porcelain").split("\n").filter(Boolean).length;
  appendFileSync(
    log,
    `# ${tier} gate of ${git("rev-parse", "HEAD")} tree ${git("rev-parse", "HEAD^{tree}")}, ${dirty} paths uncommitted, in ${process.cwd()}\n` +
      "step\tseconds\texit\n",
  );

  const started = performance.now();
  let code = 0;
  for (const step of steps) {
    console.log(`\ngate: ${step.id}`);
    const begun = performance.now();
    code = await run(step.command, env);
    const seconds = (performance.now() - begun) / 1000;
    appendFileSync(log, logLine(step.id, seconds, code));
    console.log(
      `gate: ${step.id} ${code === 0 ? "passed" : `failed (${code})`} in ${seconds.toFixed(0)} s`,
    );
    if (code !== 0) break;
  }
  const total = (performance.now() - started) / 1000;
  appendFileSync(log, logLine("total", total, code));
  console.log(
    `\ngate: ${tier} ${code === 0 ? "passed" : "failed"} in ${(total / 60).toFixed(1)} min; log ${log}`,
  );
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv[2]);
