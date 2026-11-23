import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

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

/**
 * Why a passing gate may not write a pass record, as a list of reasons;
 * empty when it may. A record says "this exact tree passed the full gate
 * with frozen dependencies, Node from .nvmrc and only CI's placeholder
 * environment", so it needs:
 *
 * - a clean worktree before and after, untracked files included (ignored
 *   build output is fine), and HEAD's tree unchanged;
 * - every step passed (the first is the frozen install);
 * - its own `node_modules`, not a link to another checkout's;
 * - no `.env*` file at the top other than `.env.ci`, which Next would load
 *   into the build.
 *
 * @param {{
 *   passed: boolean,
 *   statusBefore: string[],
 *   statusAfter: string[],
 *   treeBefore: string,
 *   treeAfter: string,
 *   nodeModulesIsLink: boolean,
 *   envFiles: string[],
 * }} state
 * @returns {string[]}
 */
export function stampProblems(state) {
  const problems = [];
  if (!state.passed) problems.push("the gate failed");
  if (state.statusBefore.length)
    problems.push(
      `${state.statusBefore.length} paths uncommitted at the start`,
    );
  if (state.statusAfter.length)
    problems.push(`${state.statusAfter.length} paths uncommitted at the end`);
  if (state.treeBefore !== state.treeAfter)
    problems.push("HEAD's tree changed during the gate");
  if (state.nodeModulesIsLink) problems.push("node_modules is a link");
  const env = state.envFiles.filter((name) => name !== ".env.ci");
  if (env.length) problems.push(`${env.join(", ")} would reach the build`);
  return problems;
}

/**
 * The lines git gives a pre-push hook on stdin: local ref, local SHA,
 * remote ref, remote SHA.
 *
 * @param {string} text
 * @returns {{ localRef: string, localSha: string, remoteRef: string, remoteSha: string }[]}
 */
export function parsePushLines(text) {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(" ");
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

const DELETE = /^0+$/;

/**
 * What the push check says about one pushed commit of the guarded branch.
 *
 * - `stamped`: its tree has a pass record.
 * - `override`: `GATE_OVERRIDE` names it (at least 7 characters of its
 *   SHA); the push goes through and is logged.
 * - `unstamped`: neither. In `warn` mode the push still goes through.
 *
 * @param {{ sha: string, stamped: boolean, override: string | undefined }} push
 * @returns {"stamped" | "override" | "unstamped"}
 */
export function pushVerdict({ sha, stamped, override }) {
  if (stamped) return "stamped";
  if (override && override.length >= 7 && sha.startsWith(override))
    return "override";
  return "unstamped";
}

/** The branch the push check guards. */
export const GUARDED_REF = "refs/heads/main";

function git(...args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function gitIn(dir, ...args) {
  return git("-C", dir, ...args);
}

function commonDir(dir = ".") {
  return resolve(dir, gitIn(dir, "rev-parse", "--git-common-dir"));
}

function statusLines(dir = ".") {
  return gitIn(dir, "status", "--porcelain", "--untracked-files=all")
    .split("\n")
    .filter(Boolean);
}

function stampPath(tree, dir = ".") {
  return resolve(commonDir(dir), "gate-stamps", `${tree}.json`);
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
 * failure. A passing full gate writes a pass record for HEAD's tree when
 * `stampProblems` finds nothing.
 *
 * @param {"full" | "quick"} tier
 * @returns {Promise<number>} the exit code
 */
async function gate(tier) {
  const steps = STEPS[tier];
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

  const logs = resolve(commonDir(), "gate-logs");
  mkdirSync(logs, { recursive: true });
  const when = new Date().toISOString().replace(/[-:]|\.\d+/g, "");
  const commit = git("rev-parse", "HEAD");
  const treeBefore = git("rev-parse", "HEAD^{tree}");
  const statusBefore = statusLines();
  const log = resolve(logs, `${when}-${tier}-${commit.slice(0, 8)}.tsv`);
  appendFileSync(
    log,
    `# ${tier} gate of ${commit} tree ${treeBefore}, ${statusBefore.length} paths uncommitted, in ${process.cwd()}\n` +
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
  if (tier !== "full" || code !== 0) return code;

  const problems = stampProblems({
    passed: code === 0,
    statusBefore,
    statusAfter: statusLines(),
    treeBefore,
    treeAfter: git("rev-parse", "HEAD^{tree}"),
    nodeModulesIsLink: existsSync("node_modules")
      ? lstatSync("node_modules").isSymbolicLink()
      : false,
    envFiles: readdirSync(".").filter((name) => name.startsWith(".env")),
  });
  if (problems.length) {
    console.log(`gate: no pass record, because ${problems.join("; ")}`);
    return code;
  }
  const record = {
    tree: treeBefore,
    commit,
    node: process.versions.node,
    pnpm: spawnSync("pnpm", ["--version"], {
      encoding: "utf8",
      env,
    }).stdout.trim(),
    passedAt: new Date().toISOString(),
    worktree: process.cwd(),
    log,
  };
  const path = stampPath(treeBefore);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, `${JSON.stringify(record, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
  console.log(`gate: pass record for tree ${treeBefore.slice(0, 12)}`);
  return code;
}

/** Marks a worktree as the release-candidate worktree, which `rc` may clean. */
const RC_MARKER = "gate-rc-worktree";

/**
 * `gate --rc [rev]`: the full gate of a given commit (default: main), in
 * one dedicated worktree beside the main checkout, `<name>-gate-rc`. A
 * flock lets one run at a time. The worktree is reset and cleaned before
 * each run, keeping only `node_modules` and `.private` (caches), so the
 * pass record describes exactly that commit. This checkout's runner runs
 * the steps; the steps' tasks are the commit's own.
 *
 * @param {string} rev
 * @returns {Promise<number>}
 */
async function releaseCandidate(rev) {
  const commit = git("rev-parse", "--verify", `${rev}^{commit}`);
  const main = git("worktree", "list", "--porcelain")
    .split("\n")[0]
    .replace(/^worktree /, "");
  const dir = resolve(dirname(main), `${basename(main)}-gate-rc`);
  const lock = resolve(commonDir(), "gate-rc.lock");
  console.log(`gate: release candidate ${commit.slice(0, 12)} in ${dir}`);
  return run(
    ["flock", lock, process.execPath, SCRIPT, "rc-run", dir, commit],
    process.env,
  );
}

/** The locked part of `releaseCandidate`. */
async function releaseCandidateLocked(dir, commit) {
  if (!existsSync(dir)) {
    git("worktree", "add", "--detach", dir, commit);
    writeFileSync(
      resolve(gitIn(dir, "rev-parse", "--absolute-git-dir"), RC_MARKER),
      "",
    );
  } else if (
    !existsSync(
      resolve(gitIn(dir, "rev-parse", "--absolute-git-dir"), RC_MARKER),
    )
  ) {
    console.error(
      `gate: ${dir} exists and is not the release-candidate worktree`,
    );
    return 2;
  }
  gitIn(dir, "checkout", "--quiet", "--force", "--detach", commit);
  gitIn(dir, "clean", "-fdxq", "-e", "node_modules", "-e", ".private");
  process.chdir(dir);
  return gate("full");
}

/**
 * The pre-push check, run by git with the remote's name and URL as
 * arguments and the pushed refs on stdin. Each commit pushed to the
 * guarded branch needs a pass record for its tree, or `GATE_OVERRIDE`
 * naming it. `git config gate.pushCheck` is `warn` (the default: report,
 * never refuse) or `enforce` (refuse, and refuse on any error).
 *
 * @param {string} remote
 * @returns {Promise<number>}
 */
async function prePush(remote) {
  let mode = "warn";
  try {
    mode =
      spawnSync("git", ["config", "--get", "gate.pushCheck"], {
        encoding: "utf8",
      }).stdout.trim() || "warn";
    const lines = parsePushLines(readFileSync(0, "utf8")).filter(
      (line) => line.remoteRef === GUARDED_REF && !DELETE.test(line.localSha),
    );
    const log = resolve(commonDir(), "gate-logs", "push.tsv");
    mkdirSync(dirname(log), { recursive: true });
    let refused = false;
    for (const { localSha: sha } of lines) {
      const tree = git("rev-parse", `${sha}^{tree}`);
      const verdict = pushVerdict({
        sha,
        stamped: existsSync(stampPath(tree)),
        override: process.env.GATE_OVERRIDE,
      });
      appendFileSync(
        log,
        `${new Date().toISOString()}\t${mode}\t${remote}\t${sha}\t${verdict}\n`,
      );
      if (verdict === "stamped") continue;
      if (verdict === "override") {
        console.error(
          `gate: pushing ${sha.slice(0, 12)} without a pass record (GATE_OVERRIDE, logged)`,
        );
        continue;
      }
      const stamped = newestStampedAncestor(sha);
      console.error(
        `gate: ${sha.slice(0, 12)} has no pass record from \`pnpm gate\`.` +
          (stamped
            ? ` Its newest ancestor with one is ${stamped.slice(0, 12)} (push it with \`git push ${remote} ${stamped}:main\`).`
            : "") +
          ` Gate it with \`pnpm gate --rc ${sha.slice(0, 12)}\`, or override with GATE_OVERRIDE=${sha.slice(0, 12)}.`,
      );
      refused = true;
    }
    if (!refused) return 0;
    if (mode === "enforce") return 1;
    console.error("gate: push check in warn mode; pushing anyway");
    return 0;
  } catch (error) {
    console.error(`gate: push check failed: ${error.message}`);
    return mode === "enforce" ? 1 : 0;
  }
}

function newestStampedAncestor(sha) {
  for (const commit of git(
    "rev-list",
    "--first-parent",
    "-n",
    "200",
    sha,
  ).split("\n"))
    if (existsSync(stampPath(git("rev-parse", `${commit}^{tree}`))))
      return commit;
  return undefined;
}

/**
 * `gate:install-hook [warn|enforce]`: registers the push check as a
 * configured hook of this clone (git 2.54 or later), beside any hook file
 * in `.git/hooks`, which git still runs. The command is this checkout's
 * script by absolute path, so it should be run from the main checkout.
 *
 * @param {string} mode
 */
function installHook(mode) {
  if (mode !== "warn" && mode !== "enforce") {
    console.error("usage: pnpm gate:install-hook warn|enforce");
    return 2;
  }
  git("config", "set", "hook.gate-push.command", `node ${SCRIPT} pre-push`);
  const events = spawnSync(
    "git",
    ["config", "--get-all", "hook.gate-push.event"],
    { encoding: "utf8" },
  ).stdout;
  if (!events.split("\n").includes("pre-push"))
    git("config", "set", "--append", "hook.gate-push.event", "pre-push");
  git("config", "set", "gate.pushCheck", mode);
  console.log(`gate: push check installed in ${mode} mode`);
  return 0;
}

const SCRIPT = fileURLToPath(import.meta.url);

/** The command line: `full [--rc [rev]]`, `quick`, `pre-push`, `install-hook`. */
async function main([command, ...args]) {
  if (command === "full" && args[0] === "--rc")
    return releaseCandidate(args[1] ?? "main");
  if (command === "full" || command === "quick") return gate(command);
  if (command === "rc-run") return releaseCandidateLocked(args[0], args[1]);
  if (command === "pre-push") return prePush(args[0] ?? "origin");
  if (command === "install-hook") return installHook(args[0]);
  console.error(
    "usage: node scripts/gate.mjs full [--rc [rev]]|quick|install-hook",
  );
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
