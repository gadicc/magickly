import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { launchExistingPromotion } from "./existing-promotion-launch.mjs";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function fixture(program = "") {
  const root = mkdtempSync(join(tmpdir(), "magickli-promotion-owner-"));
  roots.push(root);
  const cli = join(root, "node_modules/vercel");
  mkdirSync(join(cli, "dist"), { recursive: true });
  writeFileSync(
    join(cli, "package.json"),
    JSON.stringify({
      name: "vercel",
      version: "59.13.1",
      bin: { vercel: "./dist/vc.js" },
    }),
  );
  const witness = join(root, "witness.json");
  writeFileSync(
    join(cli, "dist/vc.js"),
    `const fs = require("node:fs"); fs.writeFileSync(${JSON.stringify(witness)}, JSON.stringify({ args: process.argv.slice(2), pid: process.pid, keys: Object.keys(process.env), cwd: process.cwd() })); ${program}`,
  );
  return {
    root,
    witness,
    env: {
      PROMOTION_CLI_ROOT: root,
      HOME: root,
      PROMOTION_EXPIRES_AT_MS: String(Date.now() + 10_000),
      VERCEL_TOKEN: "synthetic-vercel-only",
      VERCEL_PROJECT_ID: "project",
      VERCEL_ORG_ID: "team",
      GITHUB_TOKEN: "synthetic-github-must-not-forward",
      DEPLOYMENT_URL: "https://fixture.vercel.app",
    },
  };
}

describe("bounded existing-promotion launcher", () => {
  it("launches the already-prepared CLI in a sterile owned group without package resolution", async () => {
    const f = fixture();
    const result = await launchExistingPromotion(f.env, {
      guard: async () => {},
    });
    expect(result).toEqual({
      dispatched: true,
      closed: true,
      cancelled: false,
      cliSucceeded: true,
    });
    const witness = JSON.parse(readFileSync(f.witness, "utf8"));
    expect(witness.args.slice(0, 3)).toEqual([
      "promote",
      "https://fixture.vercel.app",
      "--yes",
    ]);
    expect(witness.args.slice(-2)).toEqual(["--scope", "team"]);
    const timeout = Number(witness.args[3].match(/^--timeout=(\d+)ms$/)?.[1]);
    expect(timeout).toBeGreaterThanOrEqual(1000);
    expect(timeout).toBeLessThanOrEqual(10_000);
    expect(witness.keys.sort()).toEqual(
      [
        "PATH",
        "HOME",
        "CI",
        "NO_COLOR",
        "VERCEL_TELEMETRY_DISABLED",
        "VERCEL_TOKEN",
        "VERCEL_ORG_ID",
        "VERCEL_PROJECT_ID",
      ].sort(),
    );
    expect(witness.cwd).toBe(f.root);
  });
  it("reaches late guard preparation but never spawns after the original absolute end", async () => {
    const f = fixture();
    const initial = Date.now();
    f.env.PROMOTION_EXPIRES_AT_MS = String(initial + 5000);
    let time = initial;
    let reached = false;
    const result = await launchExistingPromotion(f.env, {
      now: () => time,
      guard: async () => {
        reached = true;
        time += 5000;
      },
    });
    expect(reached).toBe(true);
    expect(result).toEqual({
      dispatched: false,
      closed: true,
      cancelled: false,
      cliSucceeded: false,
    });
    expect(existsSync(f.witness)).toBe(false);
  });
  it("preserves a monotonic bound if the wall clock moves backwards during the guard", async () => {
    const f = fixture();
    let time = 0;
    let wall = Date.now();
    f.env.PROMOTION_EXPIRES_AT_MS = String(wall + 5000);
    const result = await launchExistingPromotion(f.env, {
      now: () => wall,
      monotonic: () => time,
      guard: async () => {
        wall -= 1000;
        time += 5000;
      },
    });
    expect(result.dispatched).toBe(false);
    expect(existsSync(f.witness)).toBe(false);
  });
  it("keeps a known-closed CLI failure available for independent provider settlement", async () => {
    const f = fixture("process.exit(2);");
    const result = await launchExistingPromotion(f.env, {
      guard: async () => {},
    });
    expect(result).toEqual({
      dispatched: true,
      closed: true,
      cancelled: false,
      cliSucceeded: false,
    });
    expect(existsSync(f.witness)).toBe(true);
  });
  it("kills and settles a real owned CLI that ignores termination at the original end", async () => {
    const f = fixture(
      'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);',
    );
    f.env.PROMOTION_EXPIRES_AT_MS = String(Date.now() + 1400);
    const result = await launchExistingPromotion(f.env, {
      guard: async () => {},
    });
    expect(result).toEqual({
      dispatched: true,
      closed: true,
      cancelled: false,
      cliSucceeded: false,
    });
    expect(existsSync(f.witness)).toBe(true);
  }, 7000);
  it("never signals a numeric group after the owned leader has been reaped", async () => {
    const f = fixture();
    let probes = 0;
    const signals: unknown[] = [];
    const original = process.kill.bind(process);
    const kill = vi.spyOn(process, "kill").mockImplementation((pid, sig) => {
      if (pid >= 0) return original(pid, sig);
      if (sig === 0) probes += 1;
      else signals.push(sig);
      return true;
    });
    try {
      const result = await launchExistingPromotion(f.env, {
        guard: async () => {},
      });
      expect(existsSync(f.witness)).toBe(true);
      expect(probes).toBeGreaterThan(0);
      expect(signals).toEqual([]);
      expect(result).toEqual({
        dispatched: true,
        closed: false,
        cancelled: false,
        cliSucceeded: false,
      });
    } finally {
      kill.mockRestore();
    }
  });
  it("settles its real detached CLI after the launcher receives SIGTERM", async () => {
    const f = fixture(
      'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);',
    );
    f.env.PROMOTION_EXPIRES_AT_MS = String(Date.now() + 30_000);
    const driver = join(f.root, "driver.mjs");
    const receipt = join(f.root, "driver-result.json");
    writeFileSync(
      driver,
      `import { writeFileSync } from "node:fs";
      import { launchExistingPromotion } from ${JSON.stringify(new URL("./existing-promotion-launch.mjs", import.meta.url).href)};
      const result=await launchExistingPromotion(${JSON.stringify({ ...f.env, RUNNER_TRACKING_ID: "synthetic-runner-tracking" })}, {guard:async()=>{}});
      writeFileSync(${JSON.stringify(receipt)},JSON.stringify(result));`,
    );
    const parent = spawn(process.execPath, [driver], {
      stdio: "ignore",
      detached: true,
    });
    const closed = new Promise((done) => parent.once("close", done));
    let childPid: number | undefined;
    let childStart: string | undefined;
    try {
      const end = Date.now() + 5000;
      while (!existsSync(f.witness) && Date.now() < end) await pause(10);
      expect(existsSync(f.witness)).toBe(true);
      const witness = JSON.parse(readFileSync(f.witness, "utf8"));
      childPid = witness.pid;
      const identity = readFileSync(`/proc/${childPid}/stat`, "utf8");
      childStart = identity.slice(identity.lastIndexOf(")") + 2).split(" ")[19];
      expect(witness.keys).toContain("RUNNER_TRACKING_ID");
      parent.kill("SIGTERM");
      await Promise.race([
        closed,
        pause(5000).then(() => {
          throw Error("Cancellation did not settle");
        }),
      ]);
      expect(JSON.parse(readFileSync(receipt, "utf8"))).toEqual({
        dispatched: true,
        closed: true,
        cancelled: true,
        cliSucceeded: false,
      });
      expect(() => process.kill(-(childPid as number), 0)).toThrow();
    } finally {
      if (parent.exitCode === null && parent.signalCode === null)
        parent.kill("SIGKILL");
      if (childPid && childStart) {
        try {
          const identity = readFileSync(`/proc/${childPid}/stat`, "utf8");
          if (
            identity.slice(identity.lastIndexOf(")") + 2).split(" ")[19] ===
            childStart
          )
            process.kill(childPid, "SIGKILL");
        } catch {}
      }
    }
  }, 10_000);
  it("does not resolve a different CLI or bypass a failed final guard", async () => {
    const f = fixture();
    let reached = false;
    const result = await launchExistingPromotion(f.env, {
      guard: async () => {
        reached = true;
        throw Error("refused");
      },
    });
    expect(reached).toBe(true);
    expect(result.dispatched).toBe(false);
    expect(existsSync(f.witness)).toBe(false);
    f.env.PROMOTION_CLI_ROOT = join(f.root, "missing");
    expect(
      (
        await launchExistingPromotion(f.env, {
          guard: async () => {
            throw Error("must not reach");
          },
        })
      ).dispatched,
    ).toBe(false);
  });
});
