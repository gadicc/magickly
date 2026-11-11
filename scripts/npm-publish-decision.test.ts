import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  compareVersions,
  decide,
  isPrerelease,
  tarballManifest,
} from "./npm-publish-decision.mjs";

const manifest = { name: "magick-data", version: "0.1.0" };

/** A fetch that answers from a script of replies and records each call. */
function harness(replies: Array<Response | Error>) {
  const calls: Array<[string, RequestInit]> = [];
  const waits: number[] = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    const next = replies.shift();
    if (!next) throw new Error("Unexpected request");
    if (next instanceof Error) throw next;
    return next;
  });
  const options = {
    fetch: fetcher,
    wait: async (ms: number) => {
      waits.push(ms);
    },
  };
  return { calls, waits, options };
}

const packument = (versions: string[], latest?: string) =>
  Response.json({
    name: "magick-data",
    "dist-tags": latest ? { latest } : {},
    versions: Object.fromEntries(versions.map((v) => [v, { version: v }])),
  });

describe("compareVersions", () => {
  it.each([
    ["0.1.0", "0.0.9", 1],
    ["1.0.0", "0.99.99", 1],
    ["0.10.0", "0.9.0", 1],
    ["0.1.1", "0.1.0", 1],
    ["0.1.0", "0.1.0", 0],
    ["0.1.0+build.1", "0.1.0", 0],
    ["0.1.0", "0.1.0-rc.0", 1],
    ["0.1.0-rc.1", "0.1.0-rc.0", 1],
    ["0.1.0-rc.10", "0.1.0-rc.9", 1],
    ["0.1.0-rc.0", "0.1.0-beta.5", 1],
    ["0.1.0-rc", "0.1.0-rc.0", -1],
    ["0.1.0-rc.0", "0.1.0-rc", 1],
    ["0.1.0-1", "0.1.0-alpha", -1],
    ["0.1.0-alpha", "0.1.0-1", 1],
    ["0.1.0-rc.0", "0.0.9", 1],
  ])("%s against %s", (a, b, sign) => {
    expect(Math.sign(compareVersions(a, b))).toBe(sign);
    expect(Math.sign(compareVersions(b, a))).toBe(-sign || 0);
  });

  it("refuses what is not a version", () => {
    expect(() => compareVersions("1.0", "1.0.0")).toThrow(/semantic/);
    expect(() => compareVersions("1.0.0", "01.0.0")).toThrow(/semantic/);
  });

  it("knows a pre-release", () => {
    expect(isPrerelease("0.1.0-rc.0")).toBe(true);
    expect(isPrerelease("0.1.0")).toBe(false);
    expect(isPrerelease("0.1.0+build")).toBe(false);
  });
});

describe("decide", () => {
  it("asks for the abbreviated packument, with a timeout", async () => {
    const { calls, options } = harness([new Response(null, { status: 404 })]);
    await decide(manifest, options);
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(url).toBe("https://registry.npmjs.org/magick-data");
    expect((init.headers as Record<string, string>).Accept).toMatch(
      /^application\/vnd\.npm\.install-v1\+json/,
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe("error");
  });

  it("escapes a scoped name's slash only", async () => {
    const { calls, options } = harness([new Response(null, { status: 404 })]);
    await decide({ name: "@magickly/data", version: "0.1.0" }, options);
    expect(calls[0][0]).toBe("https://registry.npmjs.org/@magickly%2fdata");
  });

  it("skips a package the registry does not have", async () => {
    const { options } = harness([new Response(null, { status: 404 })]);
    const decision = await decide(manifest, options);
    expect(decision).toMatchObject({ action: "skip", tag: "latest" });
    expect(decision.published).toBeUndefined();
    expect(decision.reason).toMatch(/first publish is by hand/);
  });

  it("names next for a pre-release it skips, for a dry run's sake", async () => {
    const { options } = harness([new Response(null, { status: 404 })]);
    expect(
      await decide({ ...manifest, version: "0.1.0-rc.0" }, options),
    ).toMatchObject({ action: "skip", tag: "next" });
  });

  it("skips a version already published", async () => {
    const { options } = harness([packument(["0.1.0-rc.0", "0.1.0"], "0.1.0")]);
    expect(await decide(manifest, options)).toMatchObject({
      action: "skip",
      published: true,
    });
  });

  it("publishes a release above latest under latest", async () => {
    const { options } = harness([packument(["0.1.0-rc.0"], "0.1.0-rc.0")]);
    expect(await decide(manifest, options)).toMatchObject({
      action: "publish",
      tag: "latest",
    });
  });

  it("publishes when latest is missing", async () => {
    const { options } = harness([packument(["0.1.0-rc.0"])]);
    expect(await decide(manifest, options)).toMatchObject({
      action: "publish",
      tag: "latest",
    });
  });

  it("publishes a pre-release under next, never latest", async () => {
    const { options } = harness([packument(["0.1.0-rc.0"], "0.1.0-rc.0")]);
    expect(
      await decide({ ...manifest, version: "0.1.0-rc.1" }, options),
    ).toMatchObject({ action: "publish", tag: "next" });
  });

  it("fails a version absent but not above latest", async () => {
    const { options } = harness([packument(["0.1.0", "0.2.0"], "0.2.0")]);
    const decision = await decide({ ...manifest, version: "0.1.1" }, options);
    expect(decision.action).toBe("fail");
    expect(decision.reason).toMatch(/not greater than latest \(0\.2\.0\)/);
  });

  it("fails a pre-release below latest", async () => {
    const { options } = harness([packument(["0.1.0"], "0.1.0")]);
    const decision = await decide(
      { ...manifest, version: "0.1.0-rc.1" },
      options,
    );
    expect(decision.action).toBe("fail");
  });

  it("fails a manifest version that is not semantic", async () => {
    const { calls, options } = harness([]);
    const decision = await decide({ ...manifest, version: "1.0" }, options);
    expect(decision.action).toBe("fail");
    expect(decision.tag).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it("fails a latest that is not semantic", async () => {
    const { options } = harness([packument(["banana"], "banana")]);
    expect((await decide(manifest, options)).action).toBe("fail");
  });

  it.each([401, 403, 301, 418])("fails on %i, without retrying", async (s) => {
    const { calls, options } = harness([new Response(null, { status: s })]);
    const decision = await decide(manifest, options);
    expect(decision.action).toBe("fail");
    expect(decision.reason).toMatch(new RegExp(`answered ${s}`));
    expect(calls).toHaveLength(1);
  });

  it("fails a 200 that is not JSON", async () => {
    const { options } = harness([new Response("<html>", { status: 200 })]);
    expect((await decide(manifest, options)).reason).toMatch(/not JSON/);
  });

  it("fails a 200 without versions", async () => {
    const { options } = harness([Response.json({ name: "magick-data" })]);
    expect((await decide(manifest, options)).reason).toMatch(/no versions/);
    const nulls = harness([Response.json(null)]);
    expect((await decide(manifest, nulls.options)).action).toBe("fail");
  });

  it("retries a network error and a 5xx, then decides", async () => {
    const { calls, waits, options } = harness([
      new TypeError("fetch failed"),
      new Response(null, { status: 503 }),
      new Response(null, { status: 404 }),
    ]);
    expect((await decide(manifest, options)).action).toBe("skip");
    expect(calls).toHaveLength(3);
    expect(waits).toEqual([2_000, 4_000]);
  });

  it("fails once the retries are spent", async () => {
    const { calls, options } = harness([
      new Response(null, { status: 429 }),
      new DOMException("timed out", "TimeoutError"),
      new Response(null, { status: 502 }),
    ]);
    const decision = await decide(manifest, options);
    expect(decision).toMatchObject({ action: "fail" });
    expect(decision.reason).toMatch(/answered 502, 3 times/);
    expect(calls).toHaveLength(3);
  });

  it("fails on a timeout with no retries left", async () => {
    const { options } = harness([
      new DOMException("timed out", "TimeoutError"),
    ]);
    const decision = await decide(manifest, { ...options, retries: 0 });
    expect(decision.reason).toMatch(/could not be reached \(TimeoutError\)/);
  });
});

describe("tarballManifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "npm-publish-decision-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("reads the name and version from the tarball", () => {
    mkdirSync(join(dir, "package"));
    writeFileSync(
      join(dir, "package", "package.json"),
      JSON.stringify(manifest),
    );
    const tarball = join(dir, "x.tgz");
    spawnSync("tar", ["-czf", tarball, "-C", dir, "package"]);
    expect(tarballManifest(tarball)).toEqual(manifest);
  });

  it("throws on a file that is not a tarball", () => {
    const bogus = join(dir, "bogus.tgz");
    writeFileSync(bogus, "not a tarball");
    expect(() => tarballManifest(bogus)).toThrow(/Cannot read/);
  });
});
