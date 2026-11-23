import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, type FSWatcher, readFileSync, watch } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  profileRowDirectory,
  ROWS_DIRECTORY,
} from "../../src/search/embeddings/rows";

const build = fileURLToPath(new URL("./buildProse.ts", import.meta.url));
const root = fileURLToPath(new URL("../../", import.meta.url));
const MANIFEST = "search/embeddings/manifest.json";
let running: ChildProcess | undefined;
let dirty = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let stopped = false;

function rebuild() {
  if (running) {
    dirty = true;
    return;
  }
  dirty = false;
  running = spawn(process.execPath, ["--import", "tsx", build], {
    stdio: "inherit",
  });
  running.once("error", (error) => {
    console.error(`search: ${error.message}`);
    stop(1);
  });
  running.once("exit", (code) => {
    running = undefined;
    if (stopped) return;
    // dev.mts runs the first build itself and stops on its failure. A later
    // rebuild loads the catalogue's modules, so a half-saved edit anywhere in
    // them fails it; keep the last good output and try again on the next
    // change rather than taking `next dev` down with us.
    if (code !== 0)
      console.error(
        `search: rebuild failed (exit ${code ?? "signal"}); keeping the last build until the next change`,
      );
    if (dirty) rebuild();
  });
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 150);
}

function failed(error: Error) {
  console.error(`search: ${error.message}`);
  stop(1);
}

// Source files, and the manifest that selects the embedding profile.
const watcher = watch(
  join(root, "src"),
  { recursive: true },
  (_event, file) => {
    if (!file) return;
    const name = String(file).replaceAll("\\", "/");
    if (!/\.[jt]sx?$/.test(name) && name !== MANIFEST) return;
    if (name === MANIFEST) watchRows();
    schedule();
  },
);
watcher.on("error", failed);

/**
 * The selected profile's committed rows (plan 087, S2 decision 2), outside
 * `src/`, so a pull that adds or prunes rows reaches a running dev server
 * without a source save. Only that profile's directory is watched; until it
 * exists, the rows root is watched for it to appear. Re-armed when the
 * manifest changes.
 */
let rowsWatcher: FSWatcher | undefined;
function watchRows() {
  rowsWatcher?.close();
  rowsWatcher = undefined;
  let directory: string | undefined;
  try {
    const { selected } = JSON.parse(
      readFileSync(join(root, "src", MANIFEST), "utf8"),
    ) as { selected: string | null };
    directory = selected ? profileRowDirectory(root, selected) : undefined;
  } catch {
    // An unreadable manifest or invalid key; the build reports it.
    return;
  }
  if (!directory) return;
  const rowsRoot = join(root, ROWS_DIRECTORY);
  if (existsSync(directory))
    rowsWatcher = watch(directory, { recursive: true }, schedule);
  else if (existsSync(rowsRoot))
    rowsWatcher = watch(rowsRoot, () => {
      if (!existsSync(directory)) return;
      watchRows();
      schedule();
    });
  rowsWatcher?.on("error", failed);
}
watchRows();

function stop(code: number) {
  if (stopped) return;
  stopped = true;
  clearTimeout(timer);
  watcher.close();
  rowsWatcher?.close();
  running?.kill("SIGTERM");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const)
  process.on(signal, () => stop(0));
console.log("search: watching public page prose and embedding rows");
