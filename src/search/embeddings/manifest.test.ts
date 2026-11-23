import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import manifest from "./manifest.json";
import { EMBEDDING_PROFILES } from "./profiles";
import { ROWS_DIRECTORY } from "./rows";
import { type SearchEmbeddingManifest, selectedProfile } from "./store";

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
  // Only what is still read (plan 087, S3): no matrix, digest or row count.
  expect(manifest).toEqual({
    version: 2,
    selected: manifest.selected,
    profile: EMBEDDING_PROFILES.find(({ key }) => key === manifest.selected),
  });
});

it("refuses a registered profile edited in place, or a manifest without its copy", () => {
  const [profile] = EMBEDDING_PROFILES;
  const of = (copy: unknown) =>
    ({
      version: 2,
      selected: profile.key,
      profile: copy,
    }) as SearchEmbeddingManifest;
  expect(selectedProfile(of(profile))).toBe(profile);
  expect(selectedProfile({ version: 2, selected: null, profile: null })).toBe(
    null,
  );
  // Every row key hashes the whole profile, so an edited recipe is a new
  // profile under a new key (plan 087, S2 decision 5).
  expect(() => selectedProfile(of({ ...profile, revision: "edited" }))).toThrow(
    /Invalid search embedding manifest/,
  );
  expect(() => selectedProfile(of(null))).toThrow(
    /Invalid search embedding manifest/,
  );
  expect(() =>
    selectedProfile({ ...of(profile), selected: "unregistered" }),
  ).toThrow(/Invalid search embedding manifest/);
});

it("commits rows for the selected profile only (plan 087, S2 decision 4)", () => {
  const directory = resolve(import.meta.dirname, "../../..", ROWS_DIRECTORY);
  expect(
    readdirSync(directory).filter((name) => !name.startsWith(".")),
  ).toEqual([manifest.selected]);
});
