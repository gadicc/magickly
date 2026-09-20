/**
 * `pnpm dev`: `next dev` with the JSON5 watcher beside it.
 *
 * The data tables are generated ([build.mts](./build.mts)), and development
 * used to build them once, at start: editing a JSON5 while the server ran
 * changed nothing until `pnpm data:build` was run again. The watcher rebuilds
 * the file that changed, and Next picks the JSON up from `data/dist` as it
 * would any other import.
 *
 * The build runs here, and is awaited, before either child is spawned:
 * `data/dist` is gitignored, so on a fresh checkout `next dev` would
 * otherwise race the watcher's own first build and start on tables that are
 * not there yet. That first build then reaches the watcher as a no-op, since
 * the build writes only what changed.
 *
 * Two processes rather than one because neither can host the other: Turbopack
 * offers no whole-graph hook to build from, and `next.config.ts` is evaluated
 * more than once, so a watcher started there would be started more than once
 * too. What this wrapper is for is the pair dying together — a `&` in the
 * task would leave the watcher behind when Next stopped.
 *
 * Ctrl-C reaches both anyway, since they share the terminal's process group;
 * the handlers below are for the rest — a `kill`, an editor stopping the
 * task, either child exiting on its own, and a child that never starts at
 * all.
 *
 * Arguments are passed through to `next dev`, which is how `dev:webpack`
 * gives it `--webpack`.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildData } from "./build.mjs";

const DATA_DIR = fileURLToPath(new URL(".", import.meta.url));

await buildData();

const children: ChildProcess[] = [
  // `next` is on PATH because a package task runs with `node_modules/.bin`
  // on it; the watcher is spawned the way the `data:build` task spawns it.
  spawn(
    process.execPath,
    ["--import", "tsx", `${DATA_DIR}build.mts`, "--watch"],
    { stdio: "inherit" },
  ),
  spawn("next", ["dev", ...process.argv.slice(2)], { stdio: "inherit" }),
];

let stopping = false;

/** Stops both, once, whichever of them is still running. */
function stop(signal: NodeJS.Signals) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const)
  process.on(signal, () => stop(signal));

let status = 0;

/** The first to finish takes the other with it, and the last one out exits. */
const done = new Set<ChildProcess>();
function finish(child: ChildProcess) {
  // A dead watcher would otherwise leave a server serving stale tables, and
  // a dead server a watcher nobody is waiting for.
  done.add(child);
  stop("SIGTERM");
  if (children.every((one) => done.has(one))) process.exit(status);
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!stopping) status = code ?? (signal ? 1 : 0);
    finish(child);
  });
  // A child that never starts — `next` off PATH, where this is run outside
  // pnpm — raises 'error' and no 'exit', and an unhandled one would take
  // this wrapper down and leave the other child running with nothing
  // watching it.
  child.on("error", (error) => {
    console.error(`data: ${error.message}`);
    if (!stopping) status = 1;
    finish(child);
  });
}
