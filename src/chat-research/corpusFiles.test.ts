import * as fs from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  prepareResearchCorpusBundle,
  RESEARCH_CORPUS_BUNDLE_ERROR,
} from "./corpusBundle";
import { loadPrivateResearchCorpus } from "./corpusFiles";
import { queryFixture } from "./query.fixture";

vi.mock("server-only", () => ({}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readSync: vi.fn(actual.readSync),
    fstatSync: vi.fn(actual.fstatSync),
  };
});
const actualFs = await vi.importActual<typeof import("node:fs")>("node:fs");
let root: string, directory: string;
const fixture = queryFixture({
    texts: ["Synthetic one.", "Synthetic two.", "Synthetic three."],
  }),
  bundle = prepareResearchCorpusBundle(
    fixture.input,
    ["Synthetic one.", "Synthetic two.", "Synthetic three."].map((text, i) => ({
      unit_id: `unit${i + 1}`,
      text,
    })),
  );
beforeEach(() => {
  vi.mocked(fs.readSync).mockReset().mockImplementation(actualFs.readSync);
  vi.mocked(fs.fstatSync).mockReset().mockImplementation(actualFs.fstatSync);
  root = fs.mkdtempSync("/tmp/magickli-corpus-files-test-");
  fs.chmodSync(root, 0o700);
  directory = join(root, bundle.manifestSha256);
  fs.mkdirSync(directory, { mode: 0o700 });
  fs.writeFileSync(join(directory, "manifest.json"), bundle.manifest, {
    mode: 0o400,
  });
  fs.writeFileSync(join(directory, "catalog.json"), bundle.catalog, {
    mode: 0o400,
  });
  fs.writeFileSync(join(directory, "units.jsonl"), bundle.units, {
    mode: 0o400,
  });
  fs.chmodSync(directory, 0o500);
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.chmodSync(directory, 0o700);
  fs.rmSync(root, { recursive: true, force: true });
});
it("loads a complete immutable private synthetic bundle without network or authorization", () => {
  const loaded = loadPrivateResearchCorpus(root, bundle.manifestSha256);
  expect(loaded.manifestSha256).toBe(bundle.manifestSha256);
  expect(loaded.catalog.revision).toBe(fixture.catalog.revision);
});
it.each([
  "root mode",
  "directory mode",
  "extra entry",
  "missing file",
  "file mode",
  "symlink",
  "hardlink",
  "corrupt bytes",
  "invalid UTF8",
  "oversized file",
])("refuses %s", (kind) => {
  const file = join(directory, "units.jsonl");
  fs.chmodSync(directory, 0o700);
  if (kind === "root mode") fs.chmodSync(root, 0o755);
  else if (kind === "directory mode") fs.chmodSync(directory, 0o700);
  else if (kind === "extra entry")
    fs.writeFileSync(join(directory, "extra"), "fake");
  else if (kind === "missing file") fs.unlinkSync(file);
  else if (kind === "file mode") fs.chmodSync(file, 0o600);
  else if (kind === "symlink") {
    fs.renameSync(file, join(root, "other"));
    fs.symlinkSync(join(root, "other"), file);
  } else if (kind === "hardlink") fs.linkSync(file, join(root, "other"));
  else {
    fs.chmodSync(file, 0o600);
    if (kind === "oversized file") fs.truncateSync(file, 128 * 1024 * 1024 + 1);
    else
      fs.writeFileSync(
        file,
        kind === "invalid UTF8" ? Buffer.from([255]) : "changed",
      );
    fs.chmodSync(file, 0o400);
  }
  if (kind !== "directory mode") fs.chmodSync(directory, 0o500);
  expect(() => loadPrivateResearchCorpus(root, bundle.manifestSha256)).toThrow(
    RESEARCH_CORPUS_BUNDLE_ERROR,
  );
});
it.each(["", "../escape", "A".repeat(64), bundle.manifestSha256 + "\n"])(
  "refuses unpinned digest %j",
  (digest) => {
    expect(() => loadPrivateResearchCorpus(root, digest)).toThrow(
      RESEARCH_CORPUS_BUNDLE_ERROR,
    );
  },
);
it("refuses a symlink root even if its files match", () => {
  const alias = join(root, "alias");
  fs.symlinkSync(root, alias);
  expect(() => loadPrivateResearchCorpus(alias, bundle.manifestSha256)).toThrow(
    RESEARCH_CORPUS_BUNDLE_ERROR,
  );
});
it("owns loaded bytes despite subsequent filesystem changes", async () => {
  const runtime = loadPrivateResearchCorpus(root, bundle.manifestSha256);
  const file = join(directory, "units.jsonl");
  fs.chmodSync(file, 0o600);
  fs.writeFileSync(file, "changed");
  expect(
    await runtime.materialize(
      { catalog_revision: runtime.catalog.revision, unit_ids: ["unit1"] },
      new AbortController().signal,
    ),
  ).toEqual([{ unit_id: "unit1", text: "Synthetic one." }]);
});

it.each([
  "change",
  "grow",
  "fd identity",
  "root directory",
  "artifact directory",
])("refuses %s racing the owned read", async (kind) => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs"),
    originalRead = actual.readSync,
    originalStat = actual.fstatSync;
  let unitsCompleted = false,
    changed = false;
  vi.mocked(fs.readSync).mockImplementation(
    (...args: Parameters<typeof fs.readSync>) => {
      const fd = args[0],
        path = fs.readlinkSync(`/proc/self/fd/${fd}`),
        n = Reflect.apply(originalRead, fs, args);
      if (path.endsWith("/units.jsonl") && n === 0) unitsCompleted = true;
      // The inspector's final EOF has completed; mutate on the data reader's next file.
      if (unitsCompleted && !changed && path.endsWith("/catalog.json")) {
        changed = true;
        if (kind === "root directory") {
          fs.writeFileSync(join(root, "new"), "synthetic");
        } else if (kind === "artifact directory") {
          fs.chmodSync(directory, 0o700);
          fs.writeFileSync(join(directory, "new"), "synthetic");
          fs.chmodSync(directory, 0o500);
        } else if (kind === "fd identity") {
          vi.mocked(fs.fstatSync).mockImplementation(
            (...a: Parameters<typeof fs.fstatSync>) => {
              const result = Reflect.apply(originalStat, fs, a);
              return {
                ...result,
                ino:
                  typeof result.ino === "bigint"
                    ? result.ino + BigInt(1)
                    : result.ino + 1,
              } as ReturnType<typeof fs.fstatSync>;
            },
          );
        } else {
          const target = join(directory, "manifest.json");
          fs.chmodSync(target, 0o600);
          fs.writeFileSync(
            target,
            kind === "grow" ? "x".repeat(8193) : "corrupt",
          );
          fs.chmodSync(target, 0o400);
        }
      }
      return n;
    },
  );
  expect(() => loadPrivateResearchCorpus(root, bundle.manifestSha256)).toThrow(
    RESEARCH_CORPUS_BUNDLE_ERROR,
  );
  expect(changed).toBe(true);
});

it("rechecks an earlier owned file after a later file has been read", () => {
  let completed = 0,
    changed = false;
  vi.mocked(fs.readSync).mockImplementation(
    (...args: Parameters<typeof fs.readSync>) => {
      const n = Reflect.apply(actualFs.readSync, fs, args),
        path = fs.readlinkSync(`/proc/self/fd/${args[0]}`);
      if (path.endsWith("/units.jsonl") && n === 0 && ++completed === 2) {
        const earlier = join(directory, "catalog.json");
        fs.chmodSync(earlier, 0o600);
        fs.writeFileSync(earlier, "changed after read");
        fs.chmodSync(earlier, 0o400);
        changed = true;
      }
      return n;
    },
  );
  expect(() => loadPrivateResearchCorpus(root, bundle.manifestSha256)).toThrow(
    RESEARCH_CORPUS_BUNDLE_ERROR,
  );
  expect(changed).toBe(true);
});

it("retains original file and directory snapshots across awaited verification", async () => {
  const runtime = loadPrivateResearchCorpus(root, bundle.manifestSha256);
  await runtime.materialize(
    { catalog_revision: runtime.catalog.revision, unit_ids: ["unit1"] },
    new AbortController().signal,
  );
  const file = join(directory, "units.jsonl");
  fs.chmodSync(file, 0o600);
  fs.writeFileSync(file, "late change");
  fs.chmodSync(file, 0o400);
  expect(() => runtime.assertFilesUnchanged()).toThrow();
});
it("retains root identity across awaited verification even when bundle bytes still match", async () => {
  const runtime = loadPrivateResearchCorpus(root, bundle.manifestSha256);
  await runtime.materialize(
    { catalog_revision: runtime.catalog.revision, unit_ids: ["unit1"] },
    new AbortController().signal,
  );
  fs.writeFileSync(join(root, "late-entry"), "synthetic");
  expect(() => runtime.assertFilesUnchanged()).toThrow(
    RESEARCH_CORPUS_BUNDLE_ERROR,
  );
});
