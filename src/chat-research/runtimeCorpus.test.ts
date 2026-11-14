import { expect, it, vi } from "vitest";
import { localStartupFixture } from "./localStartup.fixture";
import {
  inspectResearchRuntimeCatalog,
  inspectResearchRuntimeCorpus,
  prepareResearchRuntimeCatalog,
  prepareResearchRuntimeCorpus,
} from "./runtimeCorpus";

vi.mock("server-only", () => ({}));
it("owns real canonical bundle ports and verifies the independent manifest", async () => {
  const f = localStartupFixture(),
    mutable = { ...f.bundle },
    prepared = prepareResearchRuntimeCorpus(mutable);
  mutable.units = "changed";
  expect(Object.isFrozen(prepared)).toBe(true);
  const runtime = inspectResearchRuntimeCorpus(
    prepared,
    f.bundle.manifestSha256,
  );
  expect(runtime.stats.source_count).toBe(3);
  expect(
    await runtime.materialize(
      { catalog_revision: runtime.catalog.revision, unit_ids: ["unit1"] },
      new AbortController().signal,
    ),
  ).toEqual([{ unit_id: "unit1", text: "Synthetic source one." }]);
});
it("refuses forged/copied preparation, mismatched manifest and changed bytes", () => {
  const f = localStartupFixture(),
    prepared = prepareResearchRuntimeCorpus(f.bundle);
  for (const copied of [
    { ...prepared },
    JSON.parse(JSON.stringify(prepared)),
    {},
  ])
    expect(() =>
      inspectResearchRuntimeCorpus(copied, f.bundle.manifestSha256),
    ).toThrow("Private research corpus unavailable");
  expect(() => inspectResearchRuntimeCorpus(prepared, "a".repeat(64))).toThrow(
    "Private research corpus unavailable",
  );
  expect(() =>
    prepareResearchRuntimeCorpus({ ...f.bundle, units: f.bundle.units + " " }),
  ).toThrow("Private research corpus unavailable");
});

it("prepares metadata without any unit bytes, and cannot substitute it for a generation corpus", () => {
  const f = localStartupFixture(),
    catalog = prepareResearchRuntimeCatalog({
      manifestSha256: f.bundle.manifestSha256,
      manifest: f.bundle.manifest,
      catalog: f.bundle.catalog,
    }),
    runtime = inspectResearchRuntimeCatalog(catalog, f.bundle.manifestSha256);
  expect(runtime.stats.unit_count).toBe(3);
  expect(runtime).not.toHaveProperty("search");
  expect(() =>
    inspectResearchRuntimeCorpus(catalog as never, f.bundle.manifestSha256),
  ).toThrow();
  expect(() =>
    inspectResearchRuntimeCatalog({ ...catalog }, f.bundle.manifestSha256),
  ).toThrow();
  expect(() =>
    inspectResearchRuntimeCatalog(catalog, "f".repeat(64)),
  ).toThrow();
});
