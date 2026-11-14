import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decisionFlags } from "./npm-publish-flags.mjs";

/**
 * publish.yml's flags for each package's decision (plan 080, stage G): one
 * key per published package, and a package without one fails.
 */

const workflow = readFileSync(
  new URL("../.github/workflows/publish.yml", import.meta.url),
  "utf8",
);
/** `DECISION_FLAGS` as publish.yml sets it, a folded scalar on one line. */
const DECISION_FLAGS = workflow.match(
  /^ {2}DECISION_FLAGS: >-\n {4}(\{.*\})$/m,
)?.[1];

describe("DECISION_FLAGS", () => {
  it("names every package publish.yml decides, and no other", () => {
    const loop = workflow.match(/for package in ([\w -]+); do/)?.[1];
    expect(loop?.split(" ")).toEqual(["magick-data", "magick-components"]);
    expect(Object.keys(JSON.parse(DECISION_FLAGS ?? "{}"))).toEqual([
      "magick-data",
      "magick-components",
    ]);
  });

  it("expects magick-data on the registry since its 0.1.0", () => {
    expect(decisionFlags(DECISION_FLAGS, "magick-data")).toBe(
      "--expect-exists",
    );
  });

  // Its first version, the release candidate, is published by hand, so
  // until then a 404 skips; the bump to 0.1.0 sets --expect-exists in the
  // same commit (stage G′, step 8), or this fails.
  it("lets magick-components skip a 404 only until its 0.1.0", () => {
    const { version } = JSON.parse(
      readFileSync(
        new URL("../packages/magick-components/package.json", import.meta.url),
        "utf8",
      ),
    );
    const byHand = version === "0.0.0" || version.startsWith("0.1.0-");
    expect(decisionFlags(DECISION_FLAGS, "magick-components")).toBe(
      byHand ? "" : "--expect-exists",
    );
  });
});

describe("decisionFlags", () => {
  it("refuses a package without flags, and no flags at all", () => {
    expect(() => decisionFlags('{"a": ""}', "b")).toThrow(/no flags for b/);
    expect(() => decisionFlags('{"a": 1}', "a")).toThrow(/no flags for a/);
    expect(() => decisionFlags(undefined, "a")).toThrow(/not set/);
    expect(() => decisionFlags("{", "a")).toThrow();
  });

  it("prints a package's flags from the command line, as publish.yml runs it", () => {
    const script = fileURLToPath(
      new URL("./npm-publish-flags.mjs", import.meta.url),
    );
    const run = (name: string) =>
      spawnSync(process.execPath, [script, name], {
        env: { ...process.env, DECISION_FLAGS },
        encoding: "utf8",
      });
    expect(run("magick-data").stdout).toBe("--expect-exists\n");
    const missing = run("magick-nothing");
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/no flags for magick-nothing/);
  });
});
