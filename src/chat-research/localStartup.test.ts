import { createHash } from "node:crypto";
/** Actual immutable fake files and genuine configured factory; no database/provider operation. */
import {
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as configuredModule from "./configuredService";
import {
  loadResearchLocalStartup,
  prepareResearchLocalStartup,
  RESEARCH_LOCAL_STARTUP_BYTE_LIMIT,
  RESEARCH_LOCAL_STARTUP_ERROR,
  type ResearchLocalStartupOptions,
} from "./localStartup";
import { localStartupFixture } from "./localStartup.fixture";
import { RESEARCH_MODEL_ID, RESEARCH_PROCESSOR_PROFILE } from "./modelRequest";
import { prepareResearchPublication } from "./publication";
import { publicationFixture } from "./publication.fixture";
import { prepareResearchReadEnvelope } from "./readAdoption";
import { prepareResearchRetentionProfile } from "./retentionProfile";

vi.mock("server-only", () => ({}));
const f = localStartupFixture();
let root: string,
  path: string,
  corpusDirectory: string,
  options: ResearchLocalStartupOptions;
const transaction = vi.fn(async () => {
  throw Error("Unexpected synthetic database call");
});
beforeEach(() => {
  transaction.mockClear();
  root = mkdtempSync("/tmp/magickli-startup-test-");
  chmodSync(root, 0o700);
  mkdirSync(join(root, "web-startups"), { mode: 0o700 });
  mkdirSync(join(root, "runtime-corpora"), { mode: 0o700 });
  const p = prepareResearchLocalStartup(f.startup);
  path = join(root, "web-startups", p.documentSha256 + ".json");
  writeFileSync(path, p.documentJson, { mode: 0o400 });
  corpusDirectory = join(root, "runtime-corpora", f.bundle.manifestSha256);
  mkdirSync(corpusDirectory, { mode: 0o700 });
  for (const [name, text] of [
    ["manifest.json", f.bundle.manifest],
    ["catalog.json", f.bundle.catalog],
    ["units.jsonl", f.bundle.units],
  ])
    writeFileSync(join(corpusDirectory, name), text, { mode: 0o400 });
  chmodSync(corpusDirectory, 0o500);
  options = {
    root,
    independentlyAdoptedStartupSha256: p.documentSha256,
    runtimeRevision: "a".repeat(64),
    authorityEndpointIdentity: "b".repeat(64),
    database: { transaction },
    authOptions: {
      baseURL: f.document.origin,
      secret: "synthetic-startup-secret-longer-than-thirty-two-characters",
      googleClientId: "synthetic-id",
      googleClientSecret: "synthetic-secret",
    },
    apiKey: "synthetic-not-a-real-key",
  };
});
afterEach(() => {
  chmodSync(root, 0o700);
  chmodSync(join(root, "web-startups"), 0o700);
  chmodSync(corpusDirectory, 0o700);
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});
it("loads an actual exact private package and actual corpus into the genuine handler without SQL/provider calls", async () => {
  const handler = loadResearchLocalStartup(options);
  expect(typeof handler).toBe("function");
  expect(transaction).not.toHaveBeenCalled();
  expect(
    (await handler(new Request(f.document.origin + "/chat/research/api")))
      .status,
  ).toBe(405);
  expect(transaction).not.toHaveBeenCalled();
});
it("compiles owned canonical metadata without inventing adoption or writing files", () => {
  const input = {
      ...f.startup,
      publication_input: {
        ...f.startup.publication_input,
        sourceStorage: { ...f.startup.publication_input.sourceStorage },
      },
    },
    prepared = prepareResearchLocalStartup(input);
  input.publication_input.sourceStorage.schemaName = "changed";
  expect(prepared.documentJson).toBe(readFileSync(path, "utf8"));
});
it.each([
  "extra",
  "wrong-kind",
  "child-sha",
  "service-whitespace",
  "immutable-deployment",
  "publication-mismatch",
])("refuses malformed compilation %s", (kind) => {
  const input = {
    ...f.startup,
    publication_input: {
      ...f.startup.publication_input,
      sourceStorage: { ...f.startup.publication_input.sourceStorage },
    },
  };
  if (kind === "extra") Object.assign(input, { extra: true });
  if (kind === "wrong-kind") Object.assign(input, { kind: "other" });
  if (kind === "child-sha")
    input.publication_input.sourcePolicySha256 = "c".repeat(64);
  if (kind === "service-whitespace") input.service_document_json += " ";
  if (kind === "immutable-deployment")
    input.service_document_json = JSON.stringify({
      ...f.document,
      web_runtime: { ...f.document.web_runtime, kind: "immutable-deployment" },
    });
  if (kind === "publication-mismatch")
    input.service_document_json = JSON.stringify({
      ...f.document,
      publication_sha256: "c".repeat(64),
    });
  expect(() => prepareResearchLocalStartup(input)).toThrow(
    RESEARCH_LOCAL_STARTUP_ERROR,
  );
});
it.each([
  "startup-pin",
  "runtime-pin",
  "endpoint-pin",
  "origin",
  "nonhex-pin",
  "missing-corpus",
])("refuses wrong real startup binding %s", (kind) => {
  if (kind === "startup-pin")
    options = { ...options, independentlyAdoptedStartupSha256: "c".repeat(64) };
  if (kind === "runtime-pin")
    options = { ...options, runtimeRevision: "c".repeat(64) };
  if (kind === "endpoint-pin")
    options = { ...options, authorityEndpointIdentity: "c".repeat(64) };
  if (kind === "origin")
    options = {
      ...options,
      authOptions: { ...options.authOptions, baseURL: "http://localhost:3004" },
    };
  if (kind === "nonhex-pin")
    options = { ...options, runtimeRevision: "../private" };
  if (kind === "missing-corpus") {
    chmodSync(corpusDirectory, 0o700);
    rmSync(join(corpusDirectory, "manifest.json"));
    chmodSync(corpusDirectory, 0o500);
  }
  expect(() => loadResearchLocalStartup(options)).toThrow(
    RESEARCH_LOCAL_STARTUP_ERROR,
  );
  expect(transaction).not.toHaveBeenCalled();
});
it.each([
  "writable-file",
  "hardlink",
  "symlink",
  "shared-root",
  "shared-directory",
  "oversize",
  "changed-bytes",
  "duplicate-root",
  "duplicate-child",
])("refuses unsafe or noncanonical immutable input %s", (kind) => {
  if (kind === "writable-file") chmodSync(path, 0o600);
  if (kind === "hardlink") linkSync(path, path + ".link");
  if (kind === "symlink") {
    const bytes = readFileSync(path);
    rmSync(path);
    writeFileSync(path + ".target", bytes, { mode: 0o400 });
    symlinkSync(path + ".target", path);
  }
  if (kind === "shared-root") chmodSync(root, 0o750);
  if (kind === "shared-directory") chmodSync(join(root, "web-startups"), 0o750);
  if (
    ["oversize", "changed-bytes", "duplicate-root", "duplicate-child"].includes(
      kind,
    )
  ) {
    chmodSync(path, 0o600);
    if (kind === "oversize")
      truncateSync(path, RESEARCH_LOCAL_STARTUP_BYTE_LIMIT + 1);
    if (kind === "changed-bytes")
      writeFileSync(path, readFileSync(path, "utf8") + "\n");
    if (kind === "duplicate-root")
      writeFileSync(
        path,
        readFileSync(path, "utf8").replace(
          '"schema_version":1',
          '"schema_version":1,"schema_version":1',
        ),
      );
    if (kind === "duplicate-child")
      writeFileSync(
        path,
        readFileSync(path, "utf8").replace(
          '"corpusVersion":',
          '"schemaName":"duplicate","corpusVersion":',
        ),
      );
    chmodSync(path, 0o400);
    if (kind !== "oversize") {
      const actualSha = createHash("sha256")
          .update(readFileSync(path))
          .digest("hex"),
        next = join(root, "web-startups", actualSha + ".json");
      renameSync(path, next);
      path = next;
      options = { ...options, independentlyAdoptedStartupSha256: actualSha };
    }
  }
  expect(() => loadResearchLocalStartup(options)).toThrow(
    RESEARCH_LOCAL_STARTUP_ERROR,
  );
  expect(transaction).not.toHaveBeenCalled();
});

it("rejects changed file bytes against the independently pinned original hash before assembly", () => {
  chmodSync(path, 0o600);
  writeFileSync(path, readFileSync(path, "utf8") + " ");
  chmodSync(path, 0o400);
  const factory = vi.spyOn(
    configuredModule,
    "createConfiguredResearchApplication",
  );
  expect(() => loadResearchLocalStartup(options)).toThrow(
    RESEARCH_LOCAL_STARTUP_ERROR,
  );
  expect(factory).not.toHaveBeenCalled();
  expect(transaction).not.toHaveBeenCalled();
});
it.each(["package", "root", "directory"])(
  "rechecks the original private snapshots after actual service assembly: %s",
  (kind) => {
    const original = configuredModule.createConfiguredResearchApplication;
    const factory = vi
      .spyOn(configuredModule, "createConfiguredResearchApplication")
      .mockImplementation((input) => {
        const handler = original(input);
        if (kind === "package") {
          chmodSync(path, 0o600);
          writeFileSync(path, readFileSync(path, "utf8") + " ");
          chmodSync(path, 0o400);
        } else
          mkdirSync(
            join(
              kind === "root" ? root : join(root, "web-startups"),
              "concurrent-child",
            ),
            { mode: 0o700 },
          );
        return handler;
      });
    expect(() => loadResearchLocalStartup(options)).toThrow(
      RESEARCH_LOCAL_STARTUP_ERROR,
    );
    expect(factory).toHaveBeenCalledOnce();
    expect(transaction).not.toHaveBeenCalled();
  },
);
it("keeps a stricter one-MiB startup limit even for otherwise valid generic child formats", () => {
  const policy = JSON.parse(f.startup.publication_input.sourcePolicyJson);
  delete policy.corpus_version;
  policy.sources[0].evidence_versions = Array.from({ length: 17000 }, (_, n) =>
    createHash("sha256")
      .update("synthetic historical snapshot " + n)
      .digest("hex"),
  );
  const g = publicationFixture(policy);
  Object.assign(g.scope, {
    model: RESEARCH_MODEL_ID,
    processorProfile: RESEARCH_PROCESSOR_PROFILE,
  });
  const retention = prepareResearchRetentionProfile(g.retentionInput),
    read = prepareResearchReadEnvelope(g.readInput),
    publicationInput = {
      ...g.input,
      retentionProfileJson: retention.document_json,
      retentionProfileSha256: retention.document_sha256,
      readEnvelopeJson: read.document_json,
      readEnvelopeSha256: read.document_sha256,
    },
    pub = prepareResearchPublication(publicationInput),
    service = configuredModule.prepareResearchConfiguredServiceDocument({
      ...f.document,
      publication_sha256: pub.sha256,
    }),
    input = {
      ...f.startup,
      service_document_json: service.documentJson,
      publication_input: publicationInput,
    };
  expect(Buffer.byteLength(JSON.stringify(input))).toBeGreaterThan(
    RESEARCH_LOCAL_STARTUP_BYTE_LIMIT,
  );
  expect(() => prepareResearchLocalStartup(input)).toThrow(
    RESEARCH_LOCAL_STARTUP_ERROR,
  );
});
