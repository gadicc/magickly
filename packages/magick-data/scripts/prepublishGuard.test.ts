import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { packRefusal, refusal } from "./prepublishGuard.mjs";

/**
 * The `prepublishOnly` guard (plan 080): the source manifest is refused, the
 * manifest `pnpm pack` writes is not. The smoke test runs the guard against
 * both real manifests; CI's dry run proves npm runs it for a directory and
 * not for the tarball. The `prepack` guard lets pnpm pack and refuses npm,
 * whose tarball would keep the source manifest's exports, by the
 * `npm_execpath` each sets.
 */

const source = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

describe("prepublishOnly guard", () => {
  it("is what the manifest runs before a publish", () => {
    expect(source.scripts.prepublishOnly).toBe(
      "node scripts/prepublishGuard.mjs",
    );
  });

  it("refuses the source manifest, whose exports point into ./src/", () => {
    const message = refusal(source);
    expect(message).toMatch(/^Refusing to publish magick-data/);
    expect(message).toContain("./src/data.ts");
    expect(message).toContain("--keep-tarball");
  });

  it("lets the packed manifest through", () => {
    expect(
      refusal({ ...source, exports: source.publishConfig.exports }),
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

  it("is what the manifest runs before a pack, and never on install", () => {
    expect(source.scripts.prepack).toBe(
      "node scripts/prepublishGuard.mjs --pack",
    );
    // So that a refusal for want of npm_execpath cannot break an install.
    for (const hook of ["preinstall", "install", "postinstall", "prepare"])
      expect(source.scripts[hook]).toBeUndefined();
  });

  it("lets pnpm pack, whichever pnpm executable runs it", () => {
    expect(packRefusal(pnpm)).toBeUndefined();
    for (const execpath of [
      "/usr/lib/node_modules/pnpm/bin/pnpm.cjs",
      "C:\\Users\\u\\AppData\\Local\\pnpm\\pnpm.exe",
    ])
      expect(packRefusal({ ...pnpm, npm_execpath: execpath })).toBeUndefined();
  });

  it("refuses plain npm", () => {
    expect(packRefusal(npm)).toMatch(
      /^Refusing to pack magick-data with npm \(\/usr\/lib\/node_modules\/npm\/bin\/npm-cli\.js\)/,
    );
  });

  // npm passes on the user agent it inherits, so `pnpm exec npm pack`, or
  // npm in any shell a pnpm script started, says pnpm/; its npm_execpath
  // is its own (plan 080, second stage A review).
  it("refuses npm run under pnpm, whose user agent it inherited", () => {
    expect(packRefusal({ ...pnpm, npm_execpath: NPM_CLI })).toMatch(
      /with npm \(/,
    );
  });

  it("refuses another tool, even with pnpm's npm_execpath inherited", () => {
    expect(
      packRefusal({ ...pnpm, npm_config_user_agent: "bun/1.3.0" }),
    ).toMatch(/^Refusing to pack/);
    expect(
      packRefusal({ npm_execpath: "/usr/lib/node_modules/yarn/bin/yarn.js" }),
    ).toMatch(/yarn\.js/);
  });

  it("refuses safely when npm_execpath is missing", () => {
    for (const env of [
      {},
      { npm_config_user_agent: pnpm.npm_config_user_agent },
      { ...pnpm, npm_execpath: "" },
    ])
      expect(packRefusal(env)).toMatch(
        /with an unknown tool \(npm_execpath is not set\)/,
      );
  });

  it("runs from the command line as the prepack script does", () => {
    const guard = fileURLToPath(
      new URL("./prepublishGuard.mjs", import.meta.url),
    );
    const run = (env: Record<string, string>) => {
      const clean: NodeJS.ProcessEnv = { ...process.env };
      for (const key of Object.keys(clean))
        if (key.startsWith("npm_")) delete clean[key];
      return spawnSync(process.execPath, [guard, "--pack"], {
        env: { ...clean, ...env },
        encoding: "utf8",
      });
    };
    expect(run(pnpm).status).toBe(0);
    const refused = run({ ...pnpm, npm_execpath: NPM_CLI });
    expect(refused.status).toBe(1);
    expect(refused.stderr).toMatch(/^Refusing to pack magick-data with npm/);
    expect(run({}).status).toBe(1);
  });
});
