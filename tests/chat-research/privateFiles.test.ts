/** Synthetic owner-only input fixtures; no real profile, credentials, source material or DB. */
import { createHash } from "node:crypto";
import {
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import {
  prepareResearchRetentionProfile,
  readResearchRetentionProfile,
} from "../../src/chat-research/retentionProfile";

vi.mock("server-only", () => ({}));

import {
  assertPrivateRetentionFileSnapshot,
  inspectPrivateRetentionFile,
  PRIVATE_RETENTION_FILE_ERROR,
  readPrivateResearchCatalog,
  readPrivateRetentionManifestText,
  readPrivateRetentionProfileText,
  requirePrivateRetentionDirectory,
} from "../../src/chat-research/privateFiles";

const dirs: string[] = [];
function fixture(bytes: string | Uint8Array = "synthetic α profile") {
  const parent = mkdtempSync(join(tmpdir(), "magickli-retention-input-unit-"));
  chmodSync(parent, 0o700);
  dirs.push(parent);
  const file = join(parent, "profile.json");
  writeFileSync(file, bytes, { mode: 0o600 });
  return { parent, file };
}
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    chmodSync(dir, 0o700);
    rmSync(dir, { recursive: true, force: true });
  }
});
it("reads exact bounded UTF-8 from stable owner-only input and hashes public code/executable modes", () => {
  const { parent, file } = fixture();
  expect(readPrivateRetentionProfileText(file)).toBe("synthetic α profile");
  expect(typeof requirePrivateRetentionDirectory(parent).inode).toBe("bigint");
  const expected = createHash("sha256")
    .update("synthetic α profile")
    .digest("hex");
  expect(inspectPrivateRetentionFile(file, 128, "profile")).toMatchObject({
    sha256: expected,
    bytes: Buffer.byteLength("synthetic α profile"),
  });
  chmodSync(file, 0o400);
  expect(readPrivateRetentionManifestText(file)).toBe("synthetic α profile");
  expect(inspectPrivateRetentionFile(file, 128, "code").sha256).toBe(expected);
  expect(readPrivateRetentionProfileText(file)).toBe("synthetic α profile");
  chmodSync(file, 0o500);
  expect(inspectPrivateRetentionFile(file, 128, "executable").sha256).toBe(
    expected,
  );
});
it.each([0o644, 0o640, 0o660, 0o700, 0o4500])(
  "refuses profile permissions%o",
  (mode) => {
    const { file } = fixture();
    chmodSync(file, mode);
    expect(() => readPrivateRetentionProfileText(file)).toThrow(
      PRIVATE_RETENTION_FILE_ERROR,
    );
  },
);
it("refuses writable executable/code and wrong typed file purpose", () => {
  const { file } = fixture();
  for (const kind of ["code", "executable", "other"])
    expect(() =>
      inspectPrivateRetentionFile(file, 128, kind as "code"),
    ).toThrow(PRIVATE_RETENTION_FILE_ERROR);
});
it("refuses shared parents, aliases, symlinks and multiply linked files", () => {
  const { parent, file } = fixture(),
    alias = join(parent, "alias.json"),
    link = join(parent, "hard.json");
  chmodSync(parent, 0o755);
  expect(() => readPrivateRetentionProfileText(file)).toThrow(
    PRIVATE_RETENTION_FILE_ERROR,
  );
  chmodSync(parent, 0o700);
  symlinkSync(file, alias);
  expect(() => readPrivateRetentionProfileText(alias)).toThrow(
    PRIVATE_RETENTION_FILE_ERROR,
  );
  expect(() =>
    readPrivateRetentionProfileText(
      parent + "/../" + parent.split("/").at(-1) + "/profile.json",
    ),
  ).toThrow(PRIVATE_RETENTION_FILE_ERROR);
  linkSync(file, link);
  expect(() => readPrivateRetentionProfileText(file)).toThrow(
    PRIVATE_RETENTION_FILE_ERROR,
  );
  expect(() => readPrivateRetentionProfileText(link)).toThrow(
    PRIVATE_RETENTION_FILE_ERROR,
  );
});
it("refuses nonregular paths and missing paths with only a fixed public error", () => {
  const { parent } = fixture(),
    directory = join(parent, "directory");
  mkdirSync(directory, { mode: 0o700 });
  expect(() => readPrivateRetentionProfileText(directory)).toThrow(
    PRIVATE_RETENTION_FILE_ERROR,
  );
  expect(() =>
    readPrivateRetentionProfileText(join(parent, "missing")),
  ).toThrow(PRIVATE_RETENTION_FILE_ERROR);
  expect(() =>
    requirePrivateRetentionDirectory(join(parent, "missing")),
  ).toThrow(PRIVATE_RETENTION_FILE_ERROR);
});
it.each([0, -1, NaN, Infinity, 1.5, 256 * 1024 * 1024 + 1])(
  "refuses invalid byte cap%j",
  (cap) => {
    const { file } = fixture();
    expect(() => inspectPrivateRetentionFile(file, cap, "profile")).toThrow(
      PRIVATE_RETENTION_FILE_ERROR,
    );
  },
);
it("refuses oversize or malformed UTF-8 input and enforces exact encoded byte caps", () => {
  const a = fixture("x".repeat(8193));
  expect(() => readPrivateRetentionProfileText(a.file)).toThrow(
    PRIVATE_RETENTION_FILE_ERROR,
  );
  const b = fixture(Uint8Array.from([0xff]));
  expect(() => readPrivateRetentionProfileText(b.file)).toThrow(
    PRIVATE_RETENTION_FILE_ERROR,
  );
  const c = fixture("α");
  expect(() => inspectPrivateRetentionFile(c.file, 1, "profile")).toThrow(
    PRIVATE_RETENTION_FILE_ERROR,
  );
  expect(inspectPrivateRetentionFile(c.file, 2, "profile").bytes).toBe(2);
});

it("preserves a UTF-8 BOM so altered raw bytes cannot inherit the canonical profile's adopted digest", () => {
  const p = prepareResearchRetentionProfile({
    schema_version: 1,
    kind: "private-research-retention",
    scope: {
      windowId: "019ba96c-1000-7000-8000-000000000001",
      approvalSha256: "a".repeat(64),
      actorId: "019ba96c-1000-7000-8000-000000000002",
      corpusVersion: "b".repeat(64),
      model: "synthetic",
      processorProfile: "synthetic",
      beginsAtMs: 1790000000000,
      expiresAtMs: 1790000060000,
      maxRequests: 10,
      perRequestPico: 100,
      totalPico: 1000,
    },
    storage: { schemaName: "research_packets" },
    maintenance_schema: "research_maintenance",
    artifact_table_oid: 1234,
    runtime: {
      worker_sha256: "c".repeat(64),
      node_sha256: "d".repeat(64),
      input_inventory_sha256: "e".repeat(64),
    },
    packet_retention_ms: 2 * 86400000,
    purge_lag_ms: 6 * 3600000,
    cadence_ms: 6 * 3600000,
    stale_after_ms: 7 * 3600000,
    batch_size: 100,
    cleanup_scope: "all-expired-packets-in-physical-artifact-namespace",
    stop: "native-all-windows-closed-and-all-payloads-purged",
  });
  expect(
    readResearchRetentionProfile(p.document_json, p.document_sha256),
  ).toBeDefined();
  const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(p.document_json),
    ]),
    { file } = fixture(bytes),
    text = readPrivateRetentionProfileText(file);
  expect(Buffer.from(text)).toEqual(bytes);
  expect(() => readResearchRetentionProfile(text, p.document_sha256)).toThrow();
});

it("reads metadata catalogs larger than the runtime-manifest cap without relaxing immutable file rules", () => {
  const text = "x".repeat(4 * 1024 * 1024 + 1),
    { file } = fixture(text);
  chmodSync(file, 0o400);
  const value = readPrivateResearchCatalog(file);
  expect(value.text).toBe(text);
  expect(value.bytes).toBe(text.length);
  chmodSync(file, 0o600);
  expect(() => readPrivateResearchCatalog(file)).toThrow(
    PRIVATE_RETENTION_FILE_ERROR,
  );
});
it("rejects oversized or malformed UTF-8 private catalogs before adoption", () => {
  const { file } = fixture("synthetic");
  truncateSync(file, 32 * 1024 * 1024 + 1);
  chmodSync(file, 0o400);
  expect(() => readPrivateResearchCatalog(file)).toThrow(
    PRIVATE_RETENTION_FILE_ERROR,
  );
  chmodSync(file, 0o600);
  writeFileSync(file, Buffer.from([0xc3, 0x28]));
  chmodSync(file, 0o400);
  expect(() => readPrivateResearchCatalog(file)).toThrow(
    PRIVATE_RETENTION_FILE_ERROR,
  );
});

it("revalidates an immutable snapshot and refuses changed inputs or invalid caps", () => {
  const { file } = fixture("synthetic original");
  chmodSync(file, 0o400);
  const saved = inspectPrivateRetentionFile(file, 128, "code");
  expect(() =>
    assertPrivateRetentionFileSnapshot(
      file,
      128,
      "code",
      saved.snapshot_sha256,
    ),
  ).not.toThrow();
  expect(() =>
    assertPrivateRetentionFileSnapshot(file, 0, "code", saved.snapshot_sha256),
  ).toThrow(PRIVATE_RETENTION_FILE_ERROR);
  chmodSync(file, 0o600);
  writeFileSync(file, "synthetic changed bytes");
  chmodSync(file, 0o400);
  expect(() =>
    assertPrivateRetentionFileSnapshot(
      file,
      128,
      "code",
      saved.snapshot_sha256,
    ),
  ).toThrow(PRIVATE_RETENTION_FILE_ERROR);
});
