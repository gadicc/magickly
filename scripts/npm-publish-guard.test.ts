import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { packRefusal, refusal } from "./npm-publish-guard.mjs";

/**
 * The packages' `prepublishOnly` guard (plan 080): a source manifest is
 * refused, the manifest `pnpm pack` writes is not. Each package's smoke
 * test runs the guard against both its real manifests; CI's dry run proves
 * npm runs it for a directory and not for the tarball. The `prepack` guard
 * lets pnpm pack and refuses npm, whose tarball would keep the source
 * manifest's exports, by the `npm_execpath` each sets. Both packages run
 * this one file (stage G).
 */

const PACKAGES = ["magick-data", "magick-components"] as const;
const packageDir = (name: string) =>
  fileURLToPath(new URL(`../packages/${name}/`, import.meta.url));
const manifestOf = (name: string) =>
  JSON.parse(readFileSync(`${packageDir(name)}package.json`, "utf8"));

describe("prepublishOnly guard", () => {
  it.each(PACKAGES)("is what %s runs before a publish", (name) => {
    expect(manifestOf(name).scripts.prepublishOnly).toBe(
      "node ../../scripts/npm-publish-guard.mjs",
    );
  });

  it.each([
    ["magick-data", "./src/data.ts"],
    ["magick-components", "./src/astrology/Kamea.tsx"],
  ])(
    "refuses %s's source manifest, whose exports point into ./src/",
    (name, first) => {
      const message = refusal(manifestOf(name));
      expect(message).toMatch(new RegExp(`^Refusing to publish ${name} `));
      expect(message).toContain(first);
      expect(message).toContain(`pnpm --filter ${name} smoke --keep-tarball`);
    },
  );

  it.each(PACKAGES)("lets %s's packed manifest through", (name) => {
    const manifest = manifestOf(name);
    expect(
      refusal({ ...manifest, exports: manifest.publishConfig.exports }),
    ).toBeUndefined();
  });

  it("finds ./src/ under conditions, arrays and a bare string", () => {
    expect(
      refusal({ name: "x", exports: { ".": { types: "./src/a.ts" } } }),
    ).toBeDefined();
    expect(
      refusal({ name: "x", exports: { ".": ["./lib/a.js", "./src/a.ts"] } }),
    ).toBeDefined();
    expect(refusal({ name: "x", exports: "./src/a.ts" })).toBeDefined();
    expect(refusal({ name: "x", exports: "./lib/a.js" })).toBeUndefined();
    expect(refusal({ name: "x", exports: { ".": null } })).toBeUndefined();
    expect(refusal({ name: "x" })).toBeUndefined();
  });
});

describe("prepack guard", () => {
  // As each package manager sets them for a lifecycle script.
  const NPM_CLI = "/usr/lib/node_modules/npm/bin/npm-cli.js";
  const npm = {
    npm_execpath: NPM_CLI,
    npm_config_user_agent:
      "npm/11.19.1 node/v24.22.2 linux x64 workspaces/false",
  };
  const pnpm = {
    npm_execpath:
      "/home/u/.local/share/pnpm/.tools/@pnpm+exe/11.28.2/node_modules/@pnpm/exe/pnpm",
    npm_config_user_agent: "pnpm/11.28.2 npm/? node/v24.22.2 linux x64",
  };

  it.each(PACKAGES)(
    "is what %s runs before a pack, and never on install",
    (name) => {
      const { scripts } = manifestOf(name);
      expect(scripts.prepack).toBe(
        "node ../../scripts/npm-publish-guard.mjs --pack",
      );
      // So that a refusal for want of npm_execpath cannot break an install.
      for (const hook of ["preinstall", "install", "postinstall", "prepare"])
        expect(scripts[hook]).toBeUndefined();
    },
  );

  it("lets pnpm pack, whichever pnpm executable runs it", () => {
    expect(packRefusal(pnpm, "magick-data")).toBeUndefined();
    for (const execpath of [
      "/usr/lib/node_modules/pnpm/bin/pnpm.cjs",
      "C:\\Users\\u\\AppData\\Local\\pnpm\\pnpm.exe",
    ])
      expect(
        packRefusal({ ...pnpm, npm_execpath: execpath }, "magick-data"),
      ).toBeUndefined();
  });

  it("refuses plain npm", () => {
    expect(packRefusal(npm, "magick-data")).toMatch(
      /^Refusing to pack magick-data with npm \(\/usr\/lib\/node_modules\/npm\/bin\/npm-cli\.js\)/,
    );
  });

  // npm passes on the user agent it inherits, so `pnpm exec npm pack`, or
  // npm in any shell a pnpm script started, says pnpm/; its npm_execpath
  // is its own (plan 080, second stage A review).
  it("refuses npm run under pnpm, whose user agent it inherited", () => {
    expect(
      packRefusal({ ...pnpm, npm_execpath: NPM_CLI }, "magick-data"),
    ).toMatch(/with npm \(/);
  });

  it("refuses another tool, even with pnpm's npm_execpath inherited", () => {
    expect(
      packRefusal(
        { ...pnpm, npm_config_user_agent: "bun/1.3.0" },
        "magick-data",
      ),
    ).toMatch(/^Refusing to pack/);
    expect(
      packRefusal(
        { npm_execpath: "/usr/lib/node_modules/yarn/bin/yarn.js" },
        "magick-data",
      ),
    ).toMatch(/yarn\.js/);
  });

  it("refuses safely when npm_execpath is missing", () => {
    for (const env of [
      {},
      { npm_config_user_agent: pnpm.npm_config_user_agent },
      { ...pnpm, npm_execpath: "" },
    ])
      expect(packRefusal(env, "magick-data")).toMatch(
        /with an unknown tool \(npm_execpath is not set\)/,
      );
  });

  it("runs from the command line as the prepack script does", () => {
    const guard = fileURLToPath(
      new URL("./npm-publish-guard.mjs", import.meta.url),
    );
    // In the package's directory, whose manifest names the package.
    const run = (name: string, env: Record<string, string>) => {
      const clean: NodeJS.ProcessEnv = { ...process.env };
      for (const key of Object.keys(clean))
        if (key.startsWith("npm_")) delete clean[key];
      return spawnSync(process.execPath, [guard, "--pack"], {
        cwd: packageDir(name),
        env: { ...clean, ...env },
        encoding: "utf8",
      });
    };
    for (const name of PACKAGES) {
      expect(run(name, pnpm).status).toBe(0);
      const refused = run(name, { ...pnpm, npm_execpath: NPM_CLI });
      expect(refused.status).toBe(1);
      expect(refused.stderr).toMatch(
        new RegExp(`^Refusing to pack ${name} with npm`),
      );
      expect(run(name, {}).status).toBe(1);
    }
  });
});
