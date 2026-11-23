import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import manifest from "./manifest.json";
import { ROWS_DIRECTORY } from "./rows";
import { selectedProfile } from "./store";

/**
 * Meaning search uses every committed row that matches a record's exact
 * input (plan 087, decision 2), so a change to page prose, titles or
 * descriptions with no republish fails nothing: the changed records rank
 * by text only until `pnpm search:publish` (plan 070), and `search:build`
 * reports the coverage. Only malformed rows fail (rows.test.ts, and
 * `search:build` itself); nothing here compares the catalogue's digest.
 */
it("selects a registered profile, recorded exactly as registered", () => {
  expect(manifest.selected).toBeTruthy();
  expect(selectedProfile()?.key).toBe(manifest.selected);
});

it("commits rows for the selected profile only (plan 087, S2 decision 4)", () => {
  const directory = resolve(import.meta.dirname, "../../..", ROWS_DIRECTORY);
  expect(
    readdirSync(directory).filter((name) => !name.startsWith(".")),
  ).toEqual([manifest.selected]);
});
