import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { packRefusal, refusal } from "./prepublishGuard.mjs";

/**
 * The `prepublishOnly` guard (plan 080): the source manifest is refused, the
 * manifest `pnpm pack` writes is not. The smoke test runs the guard against
 * both real manifests; CI's dry run proves npm runs it for a directory and
 * not for the tarball. The `prepack` guard lets pnpm pack and refuses npm,
 * whose tarball would keep the source manifest's exports.
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
  it("is what the manifest runs before a pack", () => {
    expect(source.scripts.prepack).toBe(
      "node scripts/prepublishGuard.mjs --pack",
    );
  });

  it("lets pnpm pack", () => {
    expect(
      packRefusal("pnpm/11.28.2 npm/? node/v24.18.0 linux x64"),
    ).toBeUndefined();
  });

  it("refuses npm, and anything it cannot name", () => {
    expect(
      packRefusal("npm/11.18.0 node/v24.18.0 linux x64 workspaces/false"),
    ).toMatch(/^Refusing to pack magick-data with npm\/11\.18\.0/);
    expect(packRefusal("yarn/4.0.0 npm/? node/v24.18.0")).toMatch(/yarn/);
    expect(packRefusal(undefined)).toMatch(/an unknown tool/);
    expect(packRefusal("")).toMatch(/an unknown tool/);
  });
});
