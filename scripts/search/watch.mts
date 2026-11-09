import { type ChildProcess, spawn } from "node:child_process";
import { watch } from "node:fs";
import { fileURLToPath } from "node:url";

const build = fileURLToPath(new URL("./buildProse.ts", import.meta.url));
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
    if (code !== 0) {
      stop(code ?? 1);
      return;
    }
    if (dirty) rebuild();
  });
}

const watcher = watch(
  fileURLToPath(new URL("../../src", import.meta.url)),
  { recursive: true },
  (_event, file) => {
    if (!file || !/\.[jt]sx?$/.test(String(file))) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 150);
  },
);
watcher.on("error", (error) => {
  console.error(`search: ${error.message}`);
  stop(1);
});

function stop(code: number) {
  if (stopped) return;
  stopped = true;
  clearTimeout(timer);
  watcher.close();
  running?.kill("SIGTERM");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const)
  process.on(signal, () => stop(0));
console.log("search: watching public page prose");
