import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  gateEnv,
  logLine,
  nodeProblem,
  parseEnvFile,
  parsePushLines,
  pushVerdict,
  STEPS,
  stampProblems,
} from "./gate.mjs";

const envFile = parseEnvFile(readFileSync(".env.ci", "utf8"));
const ciYml = readFileSync(".github/workflows/ci.yml", "utf8");

/** ci.yml's top-level `env:` block, read line by line. */
function ciEnv(): Record<string, string> {
  const block = /^env:\n((?: {2}.*\n|\n)*)/m.exec(ciYml)?.[1] ?? "";
  const values: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const match = /^ {2}([A-Z][A-Z0-9_]*): (.*)$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return values;
}

/**
 * Whether a value is one of CI's placeholders: a flag, a `ci-` string, or
 * a URL on this machine, with a database's on port 1 so that nothing ever
 * connects.
 */
function isPlaceholder(value: string): boolean {
  if (value === "1" || value.startsWith("ci-")) return true;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) return false;
  return url.protocol.startsWith("http") || url.port === "1";
}

describe(".env.ci", () => {
  it("holds exactly CI's placeholder environment", () => {
    // ci.yml keeps its own copy so that CI doesn't depend on this file;
    // this keeps the two the same.
    expect(envFile).toEqual(ciEnv());
    expect(Object.keys(envFile).length).toBeGreaterThan(0);
  });

  it("holds only placeholders, never a real credential or host", () => {
    for (const [key, value] of Object.entries(envFile))
      expect([key, isPlaceholder(value)]).toEqual([key, true]);
    expect(isPlaceholder("postgresql://u:p@db.example.com/x")).toBe(false);
    expect(isPlaceholder("postgresql://u:p@127.0.0.1:5432/x")).toBe(false);
    expect(isPlaceholder("sk-live-0123")).toBe(false);
  });
});

describe("parseEnvFile", () => {
  it("reads plain KEY=value lines", () => {
    expect(parseEnvFile("A=1\n\nB_2=http://x/?a=b\n")).toEqual({
      A: "1",
      B_2: "http://x/?a=b",
    });
  });

  it.each([
    ["a comment", "# note\n"],
    ["quotes", 'A="1"\n'],
    ["export", "export A=1\n"],
    ["spaces", "A = 1\n"],
    ["an empty value", "A=\n"],
  ])("refuses %s, which $GITHUB_ENV would read differently", (_, text) => {
    expect(() => parseEnvFile(text)).toThrow("not a plain KEY=value");
  });

  it("refuses a key set twice", () => {
    expect(() => parseEnvFile("A=1\nA=2\n")).toThrow("sets A twice");
  });
});

describe("gateEnv", () => {
  it("keeps only the listed variables and lets the file win", () => {
    const env = gateEnv(
      {
        PATH: "/bin",
        HOME: "/home/x",
        LC_TIME: "C",
        DATABASE_URL: "postgresql://real",
        AI_GATEWAY_API_KEY: "secret",
        CI: "true",
        ROOT_URL: "https://magick.ly",
      },
      { ROOT_URL: "http://localhost:3000" },
    );
    expect(env).toEqual({
      PATH: "/bin",
      HOME: "/home/x",
      LC_TIME: "C",
      ROOT_URL: "http://localhost:3000",
    });
  });
});

describe("nodeProblem", () => {
  it("accepts .nvmrc's major version and refuses another", () => {
    expect(nodeProblem("24.21.0", "24\n")).toBeUndefined();
    expect(nodeProblem("24.21.0", "v24.15.0\n")).toBeUndefined();
    expect(nodeProblem("25.2.1", "24\n")).toMatch("not Node 24");
  });
});

describe("STEPS", () => {
  it("runs every pnpm task CI's required checks run", () => {
    // `pnpm X`, `pnpm --filter P X` and the build matrix's `command: X`,
    // skipping `exec` (the coverage merge is the local test:coverage run)
    // and the matrix placeholder.
    const ciTasks = new Set<string>();
    for (const [, filter, task] of ciYml.matchAll(
      /pnpm (--filter \S+ )?([a-z][\w:-]*)/g,
    ))
      if (task !== "exec") ciTasks.add(`${filter ?? ""}${task}`);
    for (const [, task] of ciYml.matchAll(/command: ([a-z][\w:-]*)/g))
      ciTasks.add(task);
    expect([...ciTasks].sort()).toEqual(
      [
        "check",
        "i18n:check",
        "typecheck",
        "--filter magick-data smoke",
        "test:coverage",
        "build",
        "check:turbopack",
        "--filter magick-components smoke",
      ].sort(),
    );
    const full = STEPS.full.map((step) => step.id);
    for (const task of ciTasks) expect(full).toContain(task);
  });

  it("keeps the quick tier to steps that queue for no CPUs", () => {
    expect(STEPS.quick.map((step) => step.id)).toEqual([
      "check",
      "i18n:check",
      "typecheck",
    ]);
    const quick = JSON.stringify(STEPS.quick);
    expect(quick).not.toContain("slots");
    expect(quick).not.toContain("test");
  });
});

it("logs a step as step, seconds and exit code", () => {
  expect(logLine("build", 61.25, 0)).toBe("build\t61.3\t0\n");
});

describe("stampProblems", () => {
  const clean = {
    passed: true,
    statusBefore: [],
    statusAfter: [],
    treeBefore: "abc",
    treeAfter: "abc",
    nodeModulesIsLink: false,
    envFiles: [".env.ci"],
  };

  it("lets a clean, passing gate write a record", () => {
    expect(stampProblems(clean)).toEqual([]);
  });

  it.each([
    ["a failure", { passed: false }, "the gate failed"],
    [
      "edits at the start",
      { statusBefore: ["?? x"] },
      "1 paths uncommitted at the start",
    ],
    [
      "edits at the end",
      { statusAfter: [" M y"] },
      "1 paths uncommitted at the end",
    ],
    [
      "a moved HEAD",
      { treeAfter: "def" },
      "HEAD's tree changed during the gate",
    ],
    [
      "linked dependencies",
      { nodeModulesIsLink: true },
      "node_modules is a link",
    ],
    [
      "a local env file",
      { envFiles: [".env.ci", ".env.local"] },
      ".env.local would reach the build",
    ],
  ])("refuses %s", (_, change, reason) => {
    expect(stampProblems({ ...clean, ...change })).toEqual([reason]);
  });
});

describe("the push check", () => {
  it("reads git's pre-push lines", () => {
    expect(parsePushLines("refs/heads/main aaa refs/heads/main bbb\n")).toEqual(
      [
        {
          localRef: "refs/heads/main",
          localSha: "aaa",
          remoteRef: "refs/heads/main",
          remoteSha: "bbb",
        },
      ],
    );
  });

  const sha = "0123456789abcdef0123456789abcdef01234567";
  it("passes a stamped commit, and an override naming it", () => {
    expect(pushVerdict({ sha, stamped: true, override: undefined })).toBe(
      "stamped",
    );
    expect(pushVerdict({ sha, stamped: false, override: "0123456" })).toBe(
      "override",
    );
    expect(pushVerdict({ sha, stamped: false, override: sha })).toBe(
      "override",
    );
  });

  it("refuses an override that is short or names another commit", () => {
    expect(pushVerdict({ sha, stamped: false, override: "012345" })).toBe(
      "unstamped",
    );
    expect(pushVerdict({ sha, stamped: false, override: "1234567" })).toBe(
      "unstamped",
    );
    expect(pushVerdict({ sha, stamped: false, override: undefined })).toBe(
      "unstamped",
    );
  });
});
