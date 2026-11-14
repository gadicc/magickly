/** Synthetic read-envelope data and target binding; no operator adoption or authority is asserted. */
import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import { createUuidV7 } from "../lib/ids";
import { queryFixture } from "./query.fixture";
import {
  createResearchReadAdoptionPorts,
  prepareResearchReadEnvelope,
  RESEARCH_MAX_READ_WINDOW_MS,
  RESEARCH_READ_ADOPTION_ERROR,
  type ResearchReadEnvelopeInput,
} from "./readAdoption";
import { RESEARCH_ARTIFACT_RETENTION_MS } from "./requestArtifact";
import type { ResearchRetainedReadBinding } from "./retainedDelivery";
import type { ResearchAdmissionDatabase } from "./sqlAdmission";
import { parseResearchSourceStorage } from "./sqlSourceReaders";

vi.mock("server-only", () => ({}));
const active = () => new AbortController().signal;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
function fixture() {
  const f = queryFixture(),
    context = structuredClone(f.evidenceInput),
    actor = context.subject.user_id,
    original = {
      windowId: createUuidV7(),
      approvalSha256: sha("synthetic old approval"),
      actorId: actor,
      corpusVersion: "a".repeat(64),
      model: "synthetic-read-model",
      processorProfile: "synthetic-profile",
      beginsAtMs: 1000,
      expiresAtMs: 2000,
      maxRequests: 3,
      perRequestPico: 100,
      totalPico: 300,
    },
    input: ResearchReadEnvelopeInput = {
      schema_version: 1,
      kind: "private-operator-retained-read",
      original_scope: original,
      accounting_storage: { schemaName: "synthetic_accounting" },
      source_storage: {
        corpusVersion: original.corpusVersion,
        schemaName: "synthetic_policy",
        authSchemaName: "synthetic_auth",
      },
      read_until_ms: 1000 + RESEARCH_MAX_READ_WINDOW_MS,
      packet_retention_ms: RESEARCH_ARTIFACT_RETENTION_MS,
      display: "answers-and-citations",
      excerpts: false,
      images: false,
      downloads: false,
      mutable_read_authority: "original-corpus-source-policy",
    },
    prepared = prepareResearchReadEnvelope(input),
    database = { transaction: vi.fn() } as unknown as ResearchAdmissionDatabase,
    options = {
      database,
      scope: original,
      storage: input.accounting_storage,
      sourceStorage: input.source_storage,
      documentJson: prepared.document_json,
      adoptedDocumentSha256: prepared.document_sha256,
    },
    originalContext = {
      subject: context.subject,
      corpus_version: original.corpusVersion,
      expires_at_ms: 1500,
      bindings: [
        {
          reference_id: "ref1",
          source_id: "synthetic_source",
          source_version: "b".repeat(64),
          evidence_version: "c".repeat(64),
        },
      ],
      visible_reference_ids: ["ref1"],
    },
    contextJson = JSON.stringify(originalContext),
    binding: ResearchRetainedReadBinding = {
      database,
      scope: original,
      storage: input.accounting_storage,
      source_storage: parseResearchSourceStorage(input.source_storage),
      permit_id: createUuidV7(),
      read_until_ms: input.read_until_ms,
      current_subject: { ...context.subject, session_id: createUuidV7() },
      completed: {
        answer_id: "answer-synthetic",
        answer_sha256: "1".repeat(64),
        response_artifact_sha256: "2".repeat(64),
        request_revision: "3".repeat(64),
        query_revision: "4".repeat(64),
        original_source_context_json: contextJson,
        original_source_context_sha256: sha(contextJson),
        retain_until_ms: 1500 + RESEARCH_ARTIFACT_RETENTION_MS,
      },
    };
  return { input, prepared, database, options, binding };
}
it("prepares deterministic canonical data without dates/IDs/I/O and returns only exact-target static ports", async () => {
  const f = fixture(),
    ports = createResearchReadAdoptionPorts(f.options);
  expect(prepareResearchReadEnvelope(f.input)).toEqual(f.prepared);
  expect(Object.keys(ports).sort()).toEqual([
    "assertReadReady",
    "assertReadServiceScope",
    "readUntilMs",
    "requireReadActive",
  ]);
  expect(ports.readUntilMs).toBe(f.input.read_until_ms);
  await ports.requireReadActive(
    "prepare",
    { ...f.binding, completed: null },
    active(),
  );
  await ports.requireReadActive("delivery", f.binding, active());
  expect(ports.assertReadReady(f.binding, active())).toBeUndefined();
  expect(f.database.transaction).not.toHaveBeenCalled();
});
it.each([
  [
    "extra",
    (x: Record<string, unknown>) => {
      x.unknown = true;
    },
  ],
  [
    "display",
    (x: Record<string, unknown>) => {
      x.display = "excerpts";
    },
  ],
  [
    "images",
    (x: Record<string, unknown>) => {
      x.images = true;
    },
  ],
  [
    "retention",
    (x: Record<string, unknown>) => {
      x.packet_retention_ms = 1;
    },
  ],
  [
    "mutable authority",
    (x: Record<string, unknown>) => {
      x.mutable_read_authority = "file";
    },
  ],
  [
    "read too short",
    (x: Record<string, unknown>) => {
      x.read_until_ms = 1999;
    },
  ],
  [
    "read too long",
    (x: Record<string, unknown>) => {
      x.read_until_ms = 1001 + RESEARCH_MAX_READ_WINDOW_MS;
    },
  ],
  [
    "mismatched corpus",
    (x: Record<string, unknown>) => {
      (x.source_storage as { corpusVersion: string }).corpusVersion =
        "f".repeat(64);
    },
  ],
  [
    "unsafe time",
    (x: Record<string, unknown>) => {
      x.read_until_ms = Number.MAX_SAFE_INTEGER + 1;
    },
  ],
])("refuses invalid envelope %s", (_name, mutate) => {
  const f = fixture(),
    input = structuredClone(f.input) as unknown as Record<string, unknown>;
  mutate(input);
  expect(() =>
    prepareResearchReadEnvelope(input as unknown as ResearchReadEnvelopeInput),
  ).toThrow(RESEARCH_READ_ADOPTION_ERROR);
});
it("refuses altered/noncanonical/duplicate/oversized bytes and an independently mismatched adopted digest", () => {
  const f = fixture();
  for (const change of [
    { documentJson: f.prepared.document_json + "\n" },
    {
      documentJson: f.prepared.document_json.replace(
        '"schema_version":1',
        '"schema_version":1,"schema_version":1',
      ),
    },
    { documentJson: " ".repeat(4097) },
    { adoptedDocumentSha256: "f".repeat(64) },
    { adoptedDocumentSha256: "bad" },
    { scope: { ...f.options.scope, windowId: createUuidV7() } },
    { storage: { schemaName: "other" } },
    { sourceStorage: { ...f.options.sourceStorage, authSchemaName: "other" } },
  ])
    expect(() =>
      createResearchReadAdoptionPorts({ ...f.options, ...change }),
    ).toThrow(RESEARCH_READ_ADOPTION_ERROR);
});
it.each([
  [
    "database",
    (b: ResearchRetainedReadBinding) => ({ ...b, database: { ...b.database } }),
  ],
  [
    "window",
    (b: ResearchRetainedReadBinding) => ({
      ...b,
      scope: { ...b.scope, windowId: createUuidV7() },
    }),
  ],
  [
    "approval",
    (b: ResearchRetainedReadBinding) => ({
      ...b,
      scope: { ...b.scope, approvalSha256: "f".repeat(64) },
    }),
  ],
  [
    "source target",
    (b: ResearchRetainedReadBinding) => ({
      ...b,
      source_storage: { ...b.source_storage, authSchemaName: "other" },
    }),
  ],
  [
    "read expiry",
    (b: ResearchRetainedReadBinding) => ({
      ...b,
      read_until_ms: b.read_until_ms + 1,
    }),
  ],
  [
    "actor",
    (b: ResearchRetainedReadBinding) => ({
      ...b,
      current_subject: { ...b.current_subject, user_id: createUuidV7() },
    }),
  ],
  [
    "session",
    (b: ResearchRetainedReadBinding) => ({
      ...b,
      current_subject: { ...b.current_subject, session_id: "bad" },
    }),
  ],
  ["permit", (b: ResearchRetainedReadBinding) => ({ ...b, permit_id: "bad" })],
  [
    "missing result",
    (b: ResearchRetainedReadBinding) => ({ ...b, completed: null }),
  ],
  [
    "context hash",
    (b: ResearchRetainedReadBinding) => ({
      ...b,
      completed: {
        ...b.completed!,
        original_source_context_sha256: "f".repeat(64),
      },
    }),
  ],
  [
    "revision",
    (b: ResearchRetainedReadBinding) => ({
      ...b,
      completed: { ...b.completed!, query_revision: "bad" },
    }),
  ],
  [
    "early retention",
    (b: ResearchRetainedReadBinding) => ({
      ...b,
      completed: {
        ...b.completed!,
        retain_until_ms:
          b.scope.beginsAtMs + RESEARCH_ARTIFACT_RETENTION_MS - 1,
      },
    }),
  ],
  [
    "late retention",
    (b: ResearchRetainedReadBinding) => ({
      ...b,
      completed: {
        ...b.completed!,
        retain_until_ms: b.scope.expiresAtMs + RESEARCH_ARTIFACT_RETENTION_MS,
      },
    }),
  ],
])("refuses delivery binding drift in %s", async (_name, mutate) => {
  const f = fixture(),
    ports = createResearchReadAdoptionPorts(f.options),
    binding = mutate(f.binding);
  await expect(
    ports.requireReadActive("delivery", binding, active()),
  ).rejects.toThrow(RESEARCH_READ_ADOPTION_ERROR);
  expect(() => ports.assertReadReady(binding, active())).toThrow(
    RESEARCH_READ_ADOPTION_ERROR,
  );
});
it("refuses context corpus/owner/noncanonical drift even with a freshly recomputed data hash", () => {
  const f = fixture(),
    ports = createResearchReadAdoptionPorts(f.options);
  for (const mutate of [
    (x: Record<string, unknown>) => {
      x.corpus_version = "f".repeat(64);
    },
    (x: Record<string, unknown>) => {
      (x.subject as { user_id: string }).user_id = createUuidV7();
    },
  ]) {
    const value = JSON.parse(f.binding.completed!.original_source_context_json);
    mutate(value);
    const json = JSON.stringify(value);
    expect(() =>
      ports.assertReadReady(
        {
          ...f.binding,
          completed: {
            ...f.binding.completed!,
            original_source_context_json: json,
            original_source_context_sha256: sha(json),
          },
        },
        active(),
      ),
    ).toThrow(RESEARCH_READ_ADOPTION_ERROR);
  }
  const json = f.binding.completed!.original_source_context_json + "\n";
  expect(() =>
    ports.assertReadReady(
      {
        ...f.binding,
        completed: {
          ...f.binding.completed!,
          original_source_context_json: json,
          original_source_context_sha256: sha(json),
        },
      },
      active(),
    ),
  ).toThrow(RESEARCH_READ_ADOPTION_ERROR);
});
it("owns startup data and refuses invalid stage/order/cancellation without I/O", async () => {
  const f = fixture(),
    ports = createResearchReadAdoptionPorts(f.options),
    original = structuredClone(f.input);
  (f.input.original_scope as { windowId: string }).windowId = createUuidV7();
  f.options.documentJson = "{}";
  f.options.adoptedDocumentSha256 = "f".repeat(64);
  const binding = { ...f.binding, scope: original.original_scope };
  expect(ports.assertReadReady(binding, active())).toBeUndefined();
  await expect(
    ports.requireReadActive("prepare", binding, active()),
  ).rejects.toThrow(RESEARCH_READ_ADOPTION_ERROR);
  await expect(
    ports.requireReadActive("unknown" as "prepare", binding, active()),
  ).rejects.toThrow(RESEARCH_READ_ADOPTION_ERROR);
  const aborted = AbortSignal.abort();
  expect(() => ports.assertReadReady(binding, aborted)).toThrow(
    RESEARCH_READ_ADOPTION_ERROR,
  );
  expect(f.database.transaction).not.toHaveBeenCalled();
});

it("authorizes an exact permit-free service scope without making old permit fields optional", () => {
  const f = fixture(),
    ports = createResearchReadAdoptionPorts(f.options),
    { permit_id: _permit, completed: _completed, ...base } = f.binding;
  expect(ports.assertReadServiceScope(base, active())).toBeUndefined();
  expect(() =>
    ports.assertReadServiceScope(
      {
        ...base,
        current_subject: { ...base.current_subject, user_id: createUuidV7() },
      },
      active(),
    ),
  ).toThrow(RESEARCH_READ_ADOPTION_ERROR);
  expect(() =>
    ports.assertReadServiceScope(
      { ...base, read_until_ms: base.read_until_ms + 1 },
      active(),
    ),
  ).toThrow(RESEARCH_READ_ADOPTION_ERROR);
  expect(() => ports.assertReadReady(base as never, active())).toThrow(
    RESEARCH_READ_ADOPTION_ERROR,
  );
  expect(f.database.transaction).not.toHaveBeenCalled();
});
