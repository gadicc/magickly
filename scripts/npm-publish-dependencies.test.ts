import { execFile, spawnSync } from "node:child_process";
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
  checkDependencies,
  main,
  satisfies,
  WAIT_ATTEMPTS,
  WAIT_MS,
  workspaceDependencies,
  workspacePackages,
} from "./npm-publish-dependencies.mjs";

const components = {
  name: "magick-components",
  version: "0.1.0-rc.0",
  dependencies: { "magick-data": "^0.2.0", lune: "^0.4.0" },
  peerDependencies: { react: "^19" },
};
const packages = new Set(["magick-data", "magick-components"]);

const packument = (versions: string[]) =>
  Response.json({
    name: "magick-data",
    "dist-tags": {},
    versions: Object.fromEntries(versions.map((v) => [v, { version: v }])),
  });

/** A fetch that answers from a script of replies; the waits it was asked. */
function harness(replies: Response[]) {
  const urls: string[] = [];
  const waits: number[] = [];
  const lines: string[] = [];
  const fetcher = vi.fn(async (url: string) => {
    urls.push(url);
    const next = replies.shift();
    if (!next) throw new Error("Unexpected request");
    return next;
  });
  return {
    urls,
    waits,
    lines,
    options: {
      packages,
      fetch: fetcher as unknown as typeof fetch,
      wait: async (ms: number) => {
        waits.push(ms);
      },
      log: (line: string) => lines.push(line),
    },
  };
}

describe("satisfies", () => {
  it.each([
    ["0.2.0", "^0.2.0", true],
    ["0.2.7", "^0.2.0", true],
    ["0.3.0", "^0.2.0", false],
    ["0.1.9", "^0.2.0", false],
    ["0.3.0-rc.0", "^0.2.0", false],
    ["0.2.1-rc.0", "^0.2.0", false],
    ["1.4.0", "^1.2.3", true],
    ["2.0.0", "^1.2.3", false],
    ["0.0.3", "^0.0.3", true],
    ["0.0.4", "^0.0.3", false],
    ["0.1.0-rc.0", "^0.1.0-rc.0", true],
    ["0.1.0-rc.1", "^0.1.0-rc.0", true],
    ["0.1.0", "^0.1.0-rc.0", true],
    ["0.1.5", "~0.1.0", true],
    ["0.2.0", "~0.1.0", false],
    ["1.2.9", "~1.2.3", true],
    ["0.2.0", "0.2.0", true],
    ["0.2.1", "0.2.0", false],
    ["0.2.0", "=0.2.0", true],
  ])("%s against %s", (version, range, expected) => {
    expect(satisfies(version, range)).toBe(expected);
  });

  it("refuses a range it does not understand, or one pnpm left", () => {
    expect(() => satisfies("0.2.0", ">=0.2.0")).toThrow(/not a range/);
    expect(() => satisfies("0.2.0", "^0.2.0 || ^0.3.0")).toThrow(/not a range/);
    expect(() => satisfies("0.2.0", "*")).toThrow(/not a range/);
    expect(() => satisfies("0.2.0", "workspace:^")).toThrow(/not replaced/);
  });
});

describe("workspaceDependencies", () => {
  it("finds the dependencies on the repository's packages, in every field", () => {
    expect(workspaceDependencies(components, packages)).toEqual([
      { name: "magick-data", range: "^0.2.0", field: "dependencies" },
    ]);
    expect(
      workspaceDependencies(
        {
          name: "x",
          optionalDependencies: { "magick-data": "^0.2.0" },
          peerDependencies: { "magick-components": "~0.1.0" },
        },
        packages,
      ),
    ).toEqual([
      { name: "magick-data", range: "^0.2.0", field: "optionalDependencies" },
      { name: "magick-components", range: "~0.1.0", field: "peerDependencies" },
    ]);
    expect(
      workspaceDependencies(
        { name: "magick-data", version: "0.2.0" },
        packages,
      ),
    ).toEqual([]);
  });

  it("names the repository's packages from packages/", () => {
    const names = workspacePackages(
      fileURLToPath(new URL("../packages/", import.meta.url)),
    );
    expect(names).toEqual(new Set(["magick-data", "magick-components"]));
  });
});

describe("checkDependencies", () => {
  it("passes when npm lists a version satisfying the range", async () => {
    const { urls, lines, options } = harness([
      packument(["0.1.0", "0.2.0", "0.2.1", "0.3.0"]),
    ]);
    expect(await checkDependencies(components, options)).toEqual([]);
    expect(urls).toEqual(["https://registry.npmjs.org/magick-data"]);
    expect(lines.join("\n")).toMatch(/magick-data \^0\.2\.0.*npm has 0\.2\.1/);
  });

  it("passes a package with no dependency on the others, asking nothing", async () => {
    const { urls, options } = harness([]);
    expect(
      await checkDependencies(
        { name: "magick-data", version: "0.2.0" },
        options,
      ),
    ).toEqual([]);
    expect(urls).toEqual([]);
  });

  it("fails at once when npm lacks it and this run does not publish it", async () => {
    for (const reply of [
      packument(["0.1.0", "0.3.0"]),
      new Response(null, { status: 404 }),
    ]) {
      const { urls, waits, options } = harness([reply]);
      const failures = await checkDependencies(components, options);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatch(
        /depends on magick-data \^0\.2\.0.*not being published in this run/,
      );
      expect(urls).toHaveLength(1);
      expect(waits).toEqual([]);
    }
  });

  it("fails at once on a range it does not understand", async () => {
    const { urls, options } = harness([]);
    const failures = await checkDependencies(
      { ...components, dependencies: { "magick-data": "workspace:^" } },
      { ...options, sameRun: new Set(["magick-data"]) },
    );
    expect(failures[0]).toMatch(/not replaced/);
    expect(urls).toEqual([]);
  });

  it("waits for a package this run publishes, until npm lists it", async () => {
    const { urls, waits, lines, options } = harness([
      new Response(null, { status: 404 }),
      packument(["0.1.0"]),
      packument(["0.1.0", "0.2.0"]),
    ]);
    const failures = await checkDependencies(components, {
      ...options,
      sameRun: new Set(["magick-data"]),
    });
    expect(failures).toEqual([]);
    expect(urls).toHaveLength(3);
    expect(waits).toEqual([WAIT_MS, WAIT_MS]);
    expect(lines.at(-1)).toMatch(/npm has 0\.2\.0/);
  });

  it("gives up after a few minutes of waiting", async () => {
    expect(((WAIT_ATTEMPTS - 1) * WAIT_MS) / 60_000).toBe(5);
    const { urls, waits, options } = harness(
      Array.from({ length: 4 }, () => packument(["0.1.0"])),
    );
    const failures = await checkDependencies(components, {
      ...options,
      sameRun: new Set(["magick-data"]),
      attempts: 4,
      intervalMs: 10,
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/published in this run, but after 4 tries/);
    expect(urls).toHaveLength(4);
    expect(waits).toEqual([10, 10, 10]);
  });

  it("keeps waiting through a registry that fails, then reports it", async () => {
    const { options } = harness([
      new Response(null, { status: 403 }),
      new Response(null, { status: 403 }),
    ]);
    const failures = await checkDependencies(components, {
      ...options,
      sameRun: new Set(["magick-data"]),
      attempts: 2,
      intervalMs: 1,
    });
    expect(failures[0]).toMatch(/after 2 tries the registry answered 403/);
  });
});

describe("the command line", () => {
  const script = fileURLToPath(
    new URL("./npm-publish-dependencies.mjs", import.meta.url),
  );
  const dir = mkdtempSync(join(tmpdir(), "npm-publish-dependencies-"));
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

  /** A packages/ directory holding manifests for these names. */
  function workspace(names: string[]): string {
    const root = mkdtempSync(join(dir, "packages-"));
    for (const name of names) {
      mkdirSync(join(root, name));
      writeFileSync(
        join(root, name, "package.json"),
        JSON.stringify({ name, version: "0.0.0" }),
      );
    }
    return root;
  }

  /** A tarball holding `package/package.json` as given. */
  function tarball(manifest: object): string {
    const root = mkdtempSync(join(dir, "pkg-"));
    mkdirSync(join(root, "package"));
    writeFileSync(
      join(root, "package", "package.json"),
      JSON.stringify(manifest),
    );
    const path = join(root, "x.tgz");
    spawnSync("tar", ["-czf", path, "-C", root, "package"]);
    return path;
  }

  async function run(args: string[]) {
    try {
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [script, ...args, "--registry", registry],
        { env: { ...process.env, GITHUB_ACTIONS: "true" } },
      );
      return { code: 0, stdout };
    } catch (error) {
      const failure = error as { code: number; stdout: string };
      return { code: failure.code, stdout: failure.stdout };
    }
  }

  it("passes a dependency npm has, and fails one it lacks", async () => {
    const packagesDir = workspace(["cli-data", "cli-components"]);
    answers.set("/cli-data", [
      200,
      { "dist-tags": { latest: "0.2.0" }, versions: { "0.2.0": {} } },
    ]);
    const good = tarball({
      name: "cli-components",
      version: "0.1.0",
      dependencies: { "cli-data": "^0.2.0" },
    });
    expect(await run([good, "--packages", packagesDir])).toMatchObject({
      code: 0,
    });

    const bad = tarball({
      name: "cli-components",
      version: "0.1.0",
      dependencies: { "cli-data": "^0.3.0" },
    });
    const refused = await run([
      bad,
      "--packages",
      packagesDir,
      "--same-run",
      '[{"package":"cli-components","version":"0.1.0","tag":"latest"}]',
    ]);
    expect(refused.code).toBe(1);
    expect(refused.stdout).toMatch(
      /^::error::cli-components@0\.1\.0 depends on cli-data \^0\.3\.0/m,
    );
  });

  it("waits for a package the run publishes, from decide's list", async () => {
    const lines: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((line) => {
      lines.push(String(line));
    });
    try {
      const packagesDir = workspace(["cli-data2", "cli-components2"]);
      const path = tarball({
        name: "cli-components2",
        version: "0.1.0",
        dependencies: { "cli-data2": "^0.2.0" },
      });
      let asked = 0;
      const code = await main(
        [
          path,
          "--packages",
          packagesDir,
          "--same-run",
          '[{"package":"cli-data2","version":"0.2.0","tag":"latest"},{"package":"cli-components2","version":"0.1.0","tag":"latest"}]',
          "--registry",
          registry,
        ],
        {},
        {
          wait: async () => {
            // npm lists it after the second try.
            if (++asked === 2)
              answers.set("/cli-data2", [
                200,
                { "dist-tags": {}, versions: { "0.2.0": {} } },
              ]);
          },
          intervalMs: 1,
        },
      );
      expect(code).toBe(0);
      expect(asked).toBe(2);
      expect(lines.at(-1)).toMatch(/npm has 0\.2\.0/);
    } finally {
      log.mockRestore();
    }
  });

  it("refuses a usage it does not know", async () => {
    const path = tarball({ name: "x", version: "1.0.0" });
    expect((await run([])).code).toBe(1);
    expect((await run([path, path])).code).toBe(1);
    expect((await run([path, "--same-run", "{}"])).code).toBe(1);
    expect((await run([path, "--same-run", "[1]"])).code).toBe(1);
    expect((await run([join(dir, "missing.tgz")])).code).toBe(1);
  });
});

describe("the workflows", () => {
  const read = (name: string) =>
    readFileSync(
      new URL(`../.github/workflows/${name}`, import.meta.url),
      "utf8",
    );
  const publish = read("publish.yml");
  /** A job's text, from its key to the next job's. */
  const job = (workflow: string, name: string) => {
    const start = workflow.indexOf(`\n  ${name}:\n`);
    expect(start, name).toBeGreaterThan(-1);
    const next = workflow.slice(start + 1).search(/\n {2}[\w-]+:\n/);
    return workflow.slice(start, next < 0 ? undefined : start + 1 + next);
  };

  it("checks the dependencies in publish, before npm publish", () => {
    const steps = job(publish, "publish");
    const check = steps.indexOf("node scripts/npm-publish-dependencies.mjs");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(steps.indexOf('npm publish "$RUNNER_TEMP'));
    expect(steps).toContain('--same-run "$PACKAGES"');
    expect(steps).toContain("PACKAGES: ${{ needs.decide.outputs.packages }}");
  });

  it("lets the components' build skip magick-data only when the run publishes it", () => {
    const steps = job(publish, "build");
    expect(steps).toMatch(
      /if \[ "\$PACKAGE" = magick-components \] &&\n\s+jq -e 'any\(\.\[\]; \.package == "magick-data"\)' <<<"\$PACKAGES" >\/dev\/null; then\n\s+flags\+=\(--allow-unpublished-data\)/,
    );
  });

  it("dry-runs ci.yml's components tarball without needing magick-data on npm", () => {
    expect(job(read("ci.yml"), "components")).toMatch(
      /smoke --allow-unpublished-data\s+--keep-tarball/,
    );
  });
});
