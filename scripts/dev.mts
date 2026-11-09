/**
 * Build generated data and public search prose before Next can import them.
 * Keep both watchers beside Next, rather than inside next.config (which is
 * evaluated repeatedly). Stop the whole group when any child fails or exits.
 * Signals must reach this wrapper; package-manager signal forwarding varies.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const BUILD = fileURLToPath(
  new URL("../packages/magick-data/src/build.ts", import.meta.url),
);

const PROSE = fileURLToPath(new URL("./search/buildProse.ts", import.meta.url));
const PROSE_WATCH = fileURLToPath(
  new URL("./search/watch.mts", import.meta.url),
);
for (const script of [BUILD, PROSE]) {
  const built = await new Promise<number>((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", script], {
      stdio: "inherit",
    });
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    child.once("error", (error) => {
      console.error(error.message);
      resolve(1);
    });
  });
  if (built !== 0) process.exit(built);
}

const children: ChildProcess[] = [
  spawn(process.execPath, ["--import", "tsx", BUILD, "--watch"], {
    stdio: "inherit",
  }),
  spawn(process.execPath, ["--import", "tsx", PROSE_WATCH], {
    stdio: "inherit",
  }),
  spawn("next", ["dev", ...process.argv.slice(2)], { stdio: "inherit" }),
];

let stopping = false;

/** Stops the group, once, whichever of them is still running. */
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
