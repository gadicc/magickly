import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The app's tasks against the data package's checks. `pnpm data:check`
 * delegates to the magick-data package, and the app's builds are what must
 * run it, so this reads the app's package.json rather than the package's.
 */
describe("pnpm data:check", () => {
  it("runs before both of the builds that read the data", () => {
    const { scripts } = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    for (const task of ["build", "check:turbopack"])
      expect(scripts[task]).toContain("pnpm data:check");
  });
});
