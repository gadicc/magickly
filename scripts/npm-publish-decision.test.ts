import { execFile, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  compareVersions,
  decide,
  integrityOf,
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

const packument = (versions: string[], latest?: string, next?: string) =>
  Response.json({
    name: "magick-data",
    "dist-tags": { ...(latest && { latest }), ...(next && { next }) },
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

  it("fails a 404 once the package is expected to exist", async () => {
    const { options } = harness([new Response(null, { status: 404 })]);
    const decision = await decide(manifest, { ...options, expectExists: true });
    expect(decision).toMatchObject({ action: "fail", cause: "registry" });
    expect(decision.reason).toMatch(/should have it/);
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

  it("warns when the published content differs from the tarball", async () => {
    const published = (integrity: string) =>
      Response.json({
        name: "magick-data",
        "dist-tags": { latest: "0.1.0" },
        versions: { "0.1.0": { version: "0.1.0", dist: { integrity } } },
      });
    const same = harness([published("sha512-same")]);
    expect(
      await decide({ ...manifest, integrity: "sha512-same" }, same.options),
    ).not.toHaveProperty("warning");
    const other = harness([published("sha512-old")]);
    const decision = await decide(
      { ...manifest, integrity: "sha512-new" },
      other.options,
    );
    expect(decision).toMatchObject({ action: "skip", published: true });
    expect(decision.warning).toMatch(
      /sha512-old, but this tarball's is sha512-new/,
    );
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

  it("publishes a pre-release above next as well as latest", async () => {
    const { options } = harness([
      packument(["0.1.0-rc.0", "0.1.0"], "0.1.0", "0.1.0-rc.0"),
    ]);
    expect(
      await decide({ ...manifest, version: "0.2.0-rc.0" }, options),
    ).toMatchObject({ action: "publish", tag: "next" });
  });

  it("refuses to move next backwards", async () => {
    const { options } = harness([
      packument(["0.1.0", "0.3.0-rc.0"], "0.1.0", "0.3.0-rc.0"),
    ]);
    const decision = await decide(
      { ...manifest, version: "0.2.0-rc.0" },
      options,
    );
    expect(decision).toMatchObject({ action: "fail", cause: "rule" });
    expect(decision.reason).toMatch(/not greater than next \(0\.3\.0-rc\.0\)/);
  });

  it("compares a release with latest only, not next", async () => {
    const { options } = harness([
      packument(["0.1.0", "0.3.0-rc.0"], "0.1.0", "0.3.0-rc.0"),
    ]);
    expect(
      await decide({ ...manifest, version: "0.1.1" }, options),
    ).toMatchObject({ action: "publish", tag: "latest" });
  });

  it("fails a next that is not semantic", async () => {
    const { options } = harness([packument(["0.1.0"], "0.1.0", "banana")]);
    expect(
      await decide({ ...manifest, version: "0.2.0-rc.0" }, options),
    ).toMatchObject({ action: "fail", cause: "registry" });
  });

  it("fails a version absent but not above latest", async () => {
    const { options } = harness([packument(["0.1.0", "0.2.0"], "0.2.0")]);
    const decision = await decide({ ...manifest, version: "0.1.1" }, options);
    expect(decision.action).toBe("fail");
    expect(decision.cause).toBe("rule");
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
    expect(decision).toMatchObject({ action: "fail", cause: "rule" });
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
    expect(decision).toMatchObject({ action: "fail", cause: "registry" });
    expect(decision.reason).toMatch(/the registry timed out, 1 times/);
  });

  it("retries a timeout while reading the body, and names it", async () => {
    const stalled = () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.error(new DOMException("timed out", "TimeoutError"));
          },
        }),
        { status: 200 },
      );
    const { calls, options } = harness([stalled(), stalled(), stalled()]);
    const decision = await decide(manifest, options);
    expect(calls).toHaveLength(3);
    expect(decision).toMatchObject({ action: "fail", cause: "registry" });
    expect(decision.reason).toMatch(
      /timed out while sending its answer, 3 times/,
    );
    expect(decision.reason).not.toMatch(/JSON/);
  });

  it("asks the registry it is given", async () => {
    const { calls, options } = harness([new Response(null, { status: 404 })]);
    await decide(manifest, { ...options, registry: "http://127.0.0.1:9" });
    expect(calls[0][0]).toBe("http://127.0.0.1:9/magick-data");
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

describe("the command line", () => {
  const script = fileURLToPath(
    new URL("./npm-publish-decision.mjs", import.meta.url),
  );
  const dir = mkdtempSync(join(tmpdir(), "npm-publish-decision-cli-"));
  /** What the fake registry answers for each path, as status and body. */
  const answers = new Map<string, [number, unknown]>();
  let server: Server;
  let registry: string;

  beforeAll(async () => {
    server = createServer((request, response) => {
      const [status, body] = answers.get(request.url ?? "") ?? [404, null];
      response.writeHead(status, { "content-type": "application/json" });
      response.end(body === null ? "" : JSON.stringify(body));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    registry = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  });

  /** A tarball holding `package/package.json` for `name` at `version`. */
  function tarball(name: string, version: string): string {
    const root = mkdtempSync(join(dir, "pkg-"));
    mkdirSync(join(root, "package"));
    writeFileSync(
      join(root, "package", "package.json"),
      JSON.stringify({ name, version }),
    );
    const path = join(root, "x.tgz");
    spawnSync("tar", ["-czf", path, "-C", root, "package"]);
    return path;
  }

  /** Runs the script as CI does, returning its exit code, log and outputs. */
  async function run(args: string[]) {
    const output = join(mkdtempSync(join(dir, "out-")), "github_output");
    writeFileSync(output, "");
    let code = 0;
    let stdout = "";
    try {
      ({ stdout } = await promisify(execFile)(
        process.execPath,
        [script, ...args, "--registry", registry],
        {
          env: {
            ...process.env,
            GITHUB_ACTIONS: "true",
            GITHUB_OUTPUT: output,
          },
        },
      ));
    } catch (error) {
      const failure = error as { code: number; stdout: string };
      code = failure.code;
      stdout = failure.stdout;
    }
    const outputs = Object.fromEntries(
      readFileSync(output, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => line.split(/=(.*)/s).slice(0, 2)),
    );
    return { code, stdout, outputs };
  }

  it("writes the outputs both workflows read, from a tarball", async () => {
    answers.set("/cli-a", [
      200,
      { "dist-tags": { latest: "0.1.0-rc.0" }, versions: { "0.1.0-rc.0": {} } },
    ]);
    const path = tarball("cli-a", "0.1.0");
    const { code, stdout, outputs } = await run([path]);
    expect(code).toBe(0);
    expect(outputs).toEqual({
      action: "publish",
      publish: "true",
      published: "false",
      tag: "latest",
      name: "cli-a",
      version: "0.1.0",
    });
    expect(stdout).toContain(`tarball: cli-a@0.1.0 ${integrityOf(path)}`);
  });

  it("computes npm's integrity", () => {
    const path = tarball("cli-i", "1.0.0");
    expect(integrityOf(path)).toBe(
      `sha512-${createHash("sha512").update(readFileSync(path)).digest("base64")}`,
    );
  });

  it("reads a package.json, and skips a package the registry lacks", async () => {
    const manifest = join(dir, "package.json");
    writeFileSync(
      manifest,
      JSON.stringify({ name: "cli-b", version: "0.1.0-rc.0" }),
    );
    const { code, outputs } = await run(["--manifest", manifest]);
    expect(code).toBe(0);
    expect(outputs).toMatchObject({
      action: "skip",
      publish: "false",
      published: "false",
      tag: "next",
    });
  });

  it("fails that 404 with --expect-exists", async () => {
    const { code, outputs } = await run([
      tarball("cli-c", "0.1.0"),
      "--expect-exists",
    ]);
    expect(code).toBe(1);
    expect(outputs.action).toBe("fail");
  });

  it("reports a published version, and warns when its content differs", async () => {
    answers.set("/cli-d", [
      200,
      {
        "dist-tags": { latest: "0.1.0" },
        versions: { "0.1.0": { dist: { integrity: "sha512-other" } } },
      },
    ]);
    const { code, stdout, outputs } = await run([tarball("cli-d", "0.1.0")]);
    expect(code).toBe(0);
    expect(outputs).toMatchObject({ action: "skip", published: "true" });
    expect(stdout).toMatch(/^::warning::cli-d@0\.1\.0 is published with/m);
  });

  it("warns instead of failing as --advisory says", async () => {
    answers.set("/cli-e", [
      200,
      { "dist-tags": { latest: "0.2.0" }, versions: { "0.2.0": {} } },
    ]);
    answers.set("/cli-f", [403, null]);
    const backwards = tarball("cli-e", "0.1.1");
    const refused = tarball("cli-f", "0.1.0");

    expect((await run([backwards])).code).toBe(1);
    expect((await run([backwards, "--advisory", "registry"])).code).toBe(1);
    const all = await run([backwards, "--advisory", "all"]);
    expect(all.code).toBe(0);
    expect(all.outputs.action).toBe("fail");
    expect(all.stdout).toMatch(/^::warning::.*not greater than latest/m);

    expect((await run([refused])).code).toBe(1);
    const registryOnly = await run([refused, "--advisory", "registry"]);
    expect(registryOnly.code).toBe(0);
    expect(registryOnly.stdout).toMatch(/^::warning::.*answered 403/m);
  });

  it("refuses a usage it does not know", async () => {
    expect((await run([])).code).toBe(1);
    expect(
      (await run(["--advisory", "some", tarball("x", "1.0.0")])).code,
    ).toBe(1);
    expect((await run(["a.tgz", "b.tgz"])).code).toBe(1);
  });
});
