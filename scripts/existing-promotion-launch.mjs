import { spawn } from "node:child_process";
import { appendFileSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { checkExistingPromotion } from "./existing-promotion.mjs";

const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const present = (pid) => {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
};
const signal = (pid, value) => {
  try {
    process.kill(-pid, value);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
};

/**
 * One bounded CLI attempt after the final guard. Never resolves packages here.
 * Group closure is local evidence; provider settlement must run independently.
 */
export async function launchExistingPromotion(env, options = {}) {
  const now = options.now ?? Date.now;
  const mono = options.monotonic ?? (() => performance.now());
  const result = {
    dispatched: false,
    closed: true,
    cancelled: false,
    cliSucceeded: false,
  };
  let child;
  let timer;
  let rootClosed = false;
  let leaderExited = false;
  let cancelled = false;
  let interrupt;
  const cancel = () => {
    cancelled = true;
    if (child?.pid && !leaderExited) {
      try {
        signal(child.pid, "SIGTERM");
      } catch {}
    }
    interrupt?.();
  };
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    if (process.platform !== "linux")
      throw new Error("Linux release owner required");
    const expiry = Number(env.PROMOTION_EXPIRES_AT_MS);
    const remaining = expiry - now();
    if (
      !Number.isSafeInteger(expiry) ||
      remaining < 1000 ||
      remaining > 3_600_000
    )
      throw new Error("Original promotion end required");
    const end = mono() + Math.min(remaining, 300_000);
    const alive = () => {
      const left = Math.min(expiry - now(), end - mono());
      if (cancelled || left < 1000)
        throw new Error("Original promotion end exhausted");
      return left;
    };
    const root = resolve(env.PROMOTION_CLI_ROOT ?? "");
    if (!env.PROMOTION_CLI_ROOT || realpathSync(root) !== root)
      throw new Error("Prepared CLI root required");
    const packageRoot = realpathSync(join(root, "node_modules/vercel"));
    const pkg = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8"),
    );
    if (
      pkg.name !== "vercel" ||
      pkg.version !== "59.13.1" ||
      !["dist/vc.js", "./dist/vc.js"].includes(pkg.bin?.vercel)
    )
      throw new Error("Exact prepared CLI required");
    const entry = realpathSync(join(packageRoot, "dist/vc.js"));
    if (entry !== join(packageRoot, "dist/vc.js"))
      throw new Error("Regular prepared CLI entry required");
    await (options.guard ?? checkExistingPromotion)(env, {
      now,
      fetch: options.fetch,
    });
    const childEnv = {
      PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
      HOME: env.HOME,
      CI: "1",
      NO_COLOR: "1",
      VERCEL_TELEMETRY_DISABLED: "1",
      VERCEL_TOKEN: env.VERCEL_TOKEN,
      VERCEL_ORG_ID: env.VERCEL_ORG_ID,
      VERCEL_PROJECT_ID: env.VERCEL_PROJECT_ID,
      ...(env.RUNNER_TRACKING_ID
        ? { RUNNER_TRACKING_ID: env.RUNNER_TRACKING_ID }
        : {}),
    };
    // No await, package resolution or filesystem work between this check and spawn.
    const left = alive();
    child = spawn(
      process.execPath,
      [
        entry,
        "promote",
        env.DEPLOYMENT_URL,
        "--yes",
        `--timeout=${Math.floor(left)}ms`,
        "--scope",
        env.VERCEL_ORG_ID,
      ],
      {
        env: childEnv,
        cwd: root,
        stdio: "ignore",
        detached: true,
      },
    );
    result.dispatched = Number.isInteger(child.pid);
    result.closed = !result.dispatched;
    const exit = await new Promise((done) => {
      interrupt = () => done(null);
      child.once("exit", () => {
        leaderExited = true;
      });
      child.once("error", () => done(null));
      child.once("close", (code) => {
        rootClosed = true;
        done(code);
      });
      timer = setTimeout(
        () => {
          if (child.pid && !leaderExited) {
            try {
              signal(child.pid, "SIGTERM");
            } catch {}
          }
          done(null);
        },
        Math.max(1, Math.min(expiry - now(), end - mono())),
      );
    });
    clearTimeout(timer);
    result.cliSucceeded =
      !cancelled && exit === 0 && now() < expiry && mono() < end;
  } catch {
    result.cliSucceeded = false;
  } finally {
    clearTimeout(timer);
    if (child?.pid) {
      // A CLI root can exit while descendants remain. Settle the entire group.
      try {
        // After exit reaps the leader, a numeric group may have been reused.
        // Do not signal it; surviving descendants remain unknown, never accepted.
        if (!leaderExited && present(child.pid)) {
          signal(child.pid, "SIGTERM");
          const grace = performance.now() + 500;
          while (
            !leaderExited &&
            present(child.pid) &&
            performance.now() < grace
          )
            await pause(10);
          if (!leaderExited && present(child.pid)) signal(child.pid, "SIGKILL");
        }
        const settle = performance.now() + 2000;
        while (
          (!rootClosed || present(child.pid)) &&
          performance.now() < settle
        )
          await pause(10);
        result.closed = rootClosed && !present(child.pid);
      } catch {
        result.closed = false;
      }
    }
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
  result.cancelled = cancelled;
  if (cancelled || !result.closed) result.cliSucceeded = false;
  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await launchExistingPromotion(process.env);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `dispatched=${result.dispatched}\nclosed=${result.closed}\ncancelled=${result.cancelled}\n`,
    );
  console.log(
    `Promotion attempt: dispatched=${result.dispatched}, local-group-closed=${result.closed}`,
  );
  if (!result.dispatched || !result.closed || !result.cliSucceeded)
    process.exitCode = 1;
}
