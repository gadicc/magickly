/** Synthetic-only proposal and actual immutable-file assembly controls. No live corpus, authority or provider. */
import { createHash } from "node:crypto";
import {
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ResearchConfiguredServiceDocument } from "./configuredService";
import * as configured from "./configuredService";
import type { ResearchReadEnvelopeInput } from "./readAdoption";
import type { ResearchRetentionProfileInput } from "./retentionProfile";
import type { ResearchSourcePolicyInput } from "./sourcePolicy";

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

import { prepareResearchLocalStartup } from "./localStartup";
import { localStartupFixture } from "./localStartup.fixture";
import {
  loadResearchOperatorStartup,
  prepareResearchOperatorStartup,
  proposeResearchOperatorStartup,
  RESEARCH_OPERATOR_STARTUP_BYTE_LIMIT,
  RESEARCH_OPERATOR_STARTUP_ERROR,
  type ResearchOperatorStartupInput,
  type ResearchOperatorStartupOptions,
} from "./operatorStartup";
import { prepareResearchPublication } from "./publication";
import { prepareResearchReadEnvelope } from "./readAdoption";
import { prepareResearchRetentionProfile } from "./retentionProfile";
import { prepareResearchSourcePolicy } from "./sourcePolicy";

vi.mock("server-only", () => ({}));
const fixture = localStartupFixture(),
  sha = (s: string) => createHash("sha256").update(s).digest("hex"),
  proposedInput: ResearchOperatorStartupInput = {
    ...fixture.startup,
    kind: "private-operator-query-service-startup",
    service_document_json: configured.prepareResearchConfiguredServiceDocument({
      ...fixture.document,
      web_runtime: {
        ...fixture.document.web_runtime,
        kind: "immutable-deployment",
      },
    }).documentJson,
  },
  proposal = proposeResearchOperatorStartup(proposedInput),
  input = () =>
    JSON.parse(proposal.documentJson) as Mutable<ResearchOperatorStartupInput>;
// Deliberately recompile legitimate child changes so negative tests reach the new
// purpose/capability check rather than merely failing an obsolete child checksum.
function change(
  value: Mutable<ResearchOperatorStartupInput>,
  edit: (
    r: Mutable<ResearchRetentionProfileInput>,
    read: Mutable<ResearchReadEnvelopeInput>,
    doc: Mutable<ResearchConfiguredServiceDocument>,
    policy: Mutable<ResearchSourcePolicyInput>,
  ) => void,
) {
  const r = JSON.parse(value.publication_input.retentionProfileJson),
    read = JSON.parse(value.publication_input.readEnvelopeJson),
    doc = JSON.parse(value.service_document_json),
    policy = JSON.parse(value.publication_input.sourcePolicyJson);
  delete policy.corpus_version;
  edit(r, read, doc, policy);
  const source = prepareResearchSourcePolicy(policy),
    retention = prepareResearchRetentionProfile(r),
    envelope = prepareResearchReadEnvelope(read);
  value.publication_input = {
    ...value.publication_input,
    sourcePolicyJson: source.policyJson,
    sourcePolicySha256: source.policySha256,
    retentionProfileJson: retention.document_json,
    retentionProfileSha256: retention.document_sha256,
    readEnvelopeJson: envelope.document_json,
    readEnvelopeSha256: envelope.document_sha256,
  };
  doc.publication_sha256 = prepareResearchPublication(
    value.publication_input,
  ).sha256;
  value.service_document_json =
    configured.prepareResearchConfiguredServiceDocument(doc).documentJson;
  return value;
}
it("proposes a stable distinct native intent with all final child hashes, without adopting anything", () => {
  expect(prepareResearchOperatorStartup(input())).toEqual(proposal);
  expect(proposeResearchOperatorStartup(input())).toEqual(proposal);
  const r = JSON.parse(input().publication_input.retentionProfileJson);
  expect(r.scope.approvalSha256).toBe(proposal.intentSha256);
  expect(r.scope.approvalSha256).not.toBe("a".repeat(64));
  expect(Object.isFrozen(proposal)).toBe(true);
  expect(() => prepareResearchOperatorStartup(proposedInput)).toThrow(
    RESEARCH_OPERATOR_STARTUP_ERROR,
  );
  expect(() => prepareResearchLocalStartup(input() as never)).toThrow();
  expect(() =>
    prepareResearchOperatorStartup(fixture.startup as never),
  ).toThrow(RESEARCH_OPERATOR_STARTUP_ERROR);
});
it("ignores only the old approval link when proposing, and keeps the internal sentinel private", () => {
  const revised = change(input(), (r, read) => {
    r.scope.approvalSha256 = "f".repeat(64);
    read.original_scope.approvalSha256 = "f".repeat(64);
  });
  expect(proposeResearchOperatorStartup(revised)).toEqual(proposal);
  expect(() => prepareResearchOperatorStartup(revised)).toThrow(
    RESEARCH_OPERATOR_STARTUP_ERROR,
  );
  expect(proposal.documentJson).not.toContain(
    '"approvalSha256":"' + "0".repeat(64),
  );
});
it.each([
  "count",
  "budget",
  "dates",
  "actor",
  "read",
  "cleanup",
  "runtime",
  "endpoint",
  "origin",
  "oid",
  "manifest",
])("binds changed canonical semantics: %s", (kind) => {
  const revised = change(input(), (r, read, doc, policy) => {
    if (kind === "count")
      r.scope.maxRequests = read.original_scope.maxRequests = 9;
    if (kind === "budget")
      r.scope.totalPico = read.original_scope.totalPico = 900;
    if (kind === "dates")
      r.scope.expiresAtMs = read.original_scope.expiresAtMs = 3600000;
    if (kind === "actor") {
      r.scope.actorId = read.original_scope.actorId =
        "019aa111-0000-7000-8000-000000000003";
      for (const source of policy.sources)
        source.grants[0].user_id = r.scope.actorId;
    }
    if (kind === "read") read.read_until_ms -= 1000;
    if (kind === "cleanup") r.runtime.worker_sha256 = "f".repeat(64);
    if (kind === "runtime") doc.web_runtime.revision = "f".repeat(64);
    if (kind === "endpoint") doc.authority_endpoint_identity = "f".repeat(64);
    if (kind === "origin") doc.origin = "http://127.0.0.1:4181";
    if (kind === "oid") doc.native_target.table_oids.sessions += 100;
    if (kind === "manifest") doc.corpus_manifest_sha256 = "f".repeat(64);
  });
  expect(() => prepareResearchOperatorStartup(revised)).toThrow(
    RESEARCH_OPERATOR_STARTUP_ERROR,
  );
  expect(proposeResearchOperatorStartup(revised).intentSha256).not.toBe(
    proposal.intentSha256,
  );
});
it.each([
  "extra",
  "local-kind",
  "child-sha",
  "service-space",
  "artifact-oid",
  "reviewed-local",
  "scope-disagreement",
])("refuses malformed or contradictory configuration: %s", (kind) => {
  const value = input();
  if (kind === "extra") Object.assign(value, { extra: true });
  if (kind === "local-kind")
    Object.assign(value, { kind: "private-local-research-startup" });
  if (kind === "child-sha")
    value.publication_input.sourcePolicySha256 = "f".repeat(64);
  if (kind === "service-space") value.service_document_json += " ";
  if (kind === "artifact-oid" || kind === "reviewed-local") {
    const doc = JSON.parse(value.service_document_json);
    if (kind === "artifact-oid") doc.native_target.table_oids.artifacts += 100;
    else doc.web_runtime.kind = "reviewed-local-launch";
    value.service_document_json =
      configured.prepareResearchConfiguredServiceDocument(doc).documentJson;
  }
  if (kind === "scope-disagreement") {
    const read = JSON.parse(value.publication_input.readEnvelopeJson);
    read.original_scope.maxRequests = 9;
    const envelope = prepareResearchReadEnvelope(read);
    value.publication_input.readEnvelopeJson = envelope.document_json;
    value.publication_input.readEnvelopeSha256 = envelope.document_sha256;
  }
  expect(() => proposeResearchOperatorStartup(value)).toThrow(
    RESEARCH_OPERATOR_STARTUP_ERROR,
  );
});
it.each(["excerpt", "image", "download"])(
  "forbids broader source or grant capability: %s",
  (cap) => {
    for (const grant of [false, true]) {
      const value = input(),
        policy = JSON.parse(value.publication_input.sourcePolicyJson);
      if (grant) policy.sources[0].grants[0].capabilities[cap] = true;
      else policy.sources[0].rights[cap] = true;
      value.publication_input.sourcePolicyJson = JSON.stringify(policy);
      value.publication_input.sourcePolicySha256 = sha(
        value.publication_input.sourcePolicyJson,
      );
      expect(() => proposeResearchOperatorStartup(value)).toThrow(
        RESEARCH_OPERATOR_STARTUP_ERROR,
      );
    }
  },
);
let root: string,
  path: string,
  corpus: string,
  options: ResearchOperatorStartupOptions;
const transaction = vi.fn(async () => {
  throw Error("Unexpected synthetic SQL");
});
beforeEach(() => {
  transaction.mockClear();
  root = mkdtempSync("/tmp/magickli-operator-test-");
  chmodSync(root, 0o700);
  mkdirSync(join(root, "operator-startups"), { mode: 0o700 });
  mkdirSync(join(root, "runtime-corpora"), { mode: 0o700 });
  path = join(root, "operator-startups", proposal.documentSha256 + ".json");
  writeFileSync(path, proposal.documentJson, { mode: 0o400 });
  corpus = join(root, "runtime-corpora", fixture.bundle.manifestSha256);
  mkdirSync(corpus, { mode: 0o700 });
  for (const [name, text] of [
    ["manifest.json", fixture.bundle.manifest],
    ["catalog.json", fixture.bundle.catalog],
    ["units.jsonl", fixture.bundle.units],
  ])
    writeFileSync(join(corpus, name), text, { mode: 0o400 });
  chmodSync(corpus, 0o500);
  options = {
    root,
    independentlyAdoptedStartupSha256: proposal.documentSha256,
    runtimeRevision: "a".repeat(64),
    authorityEndpointIdentity: "b".repeat(64),
    database: { transaction },
    authOptions: {
      baseURL: fixture.document.origin,
      secret: "synthetic-secret-over-thirty-two-characters",
      googleClientId: "synthetic",
      googleClientSecret: "synthetic",
    },
    apiKey: vi.fn(() => {
      throw Error("Unexpected credential access");
    }),
    priceFetch: vi.fn(),
    requestFetch: vi.fn(),
  };
});
afterEach(() => {
  chmodSync(root, 0o700);
  chmodSync(join(root, "operator-startups"), 0o700);
  chmodSync(corpus, 0o700);
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});
it("assembles the real configured application from an immutable package without startup I/O", async () => {
  const handler = loadResearchOperatorStartup(options);
  expect(
    (await handler(new Request(fixture.document.origin + "/chat/research/api")))
      .status,
  ).toBe(405);
  expect(transaction).not.toHaveBeenCalled();
  expect(options.apiKey).not.toHaveBeenCalled();
  expect(options.priceFetch).not.toHaveBeenCalled();
  expect(options.requestFetch).not.toHaveBeenCalled();
});
it.each([
  "startup-pin",
  "runtime-pin",
  "endpoint-pin",
  "origin",
  "nonhex",
  "writable",
  "hardlink",
  "symlink",
  "root-mode",
  "directory-mode",
  "oversize",
  "bytes",
  "canonical",
  "missing-corpus",
  "old-purpose",
])("refuses actual unsafe or incorrect startup: %s", (kind) => {
  if (kind === "startup-pin")
    options = { ...options, independentlyAdoptedStartupSha256: "f".repeat(64) };
  if (kind === "runtime-pin")
    options = { ...options, runtimeRevision: "f".repeat(64) };
  if (kind === "endpoint-pin")
    options = { ...options, authorityEndpointIdentity: "f".repeat(64) };
  if (kind === "origin")
    options = {
      ...options,
      authOptions: { ...options.authOptions, baseURL: "http://localhost:1" },
    };
  if (kind === "nonhex")
    options = { ...options, independentlyAdoptedStartupSha256: "../private" };
  if (kind === "writable") chmodSync(path, 0o600);
  if (kind === "hardlink") linkSync(path, path + ".link");
  if (kind === "symlink") {
    rmSync(path);
    writeFileSync(path + ".target", proposal.documentJson, { mode: 0o400 });
    symlinkSync(path + ".target", path);
  }
  if (kind === "root-mode") chmodSync(root, 0o750);
  if (kind === "directory-mode")
    chmodSync(join(root, "operator-startups"), 0o750);
  if (["oversize", "bytes", "canonical", "old-purpose"].includes(kind)) {
    chmodSync(path, 0o600);
    if (kind === "oversize")
      truncateSync(path, RESEARCH_OPERATOR_STARTUP_BYTE_LIMIT + 1);
    if (kind === "bytes") writeFileSync(path, proposal.documentJson + " ");
    if (kind === "canonical" || kind === "old-purpose") {
      const bytes =
        kind === "canonical"
          ? proposal.documentJson + " "
          : prepareResearchLocalStartup(fixture.startup).documentJson;
      rmSync(path);
      options = { ...options, independentlyAdoptedStartupSha256: sha(bytes) };
      path = join(root, "operator-startups", sha(bytes) + ".json");
      writeFileSync(path, bytes, { mode: 0o600 });
    }
    chmodSync(path, 0o400);
  }
  if (kind === "missing-corpus") {
    chmodSync(corpus, 0o700);
    rmSync(join(corpus, "manifest.json"));
    chmodSync(corpus, 0o500);
  }
  expect(() => loadResearchOperatorStartup(options)).toThrow(
    RESEARCH_OPERATOR_STARTUP_ERROR,
  );
  expect(transaction).not.toHaveBeenCalled();
  expect(options.apiKey).not.toHaveBeenCalled();
  expect(options.requestFetch).not.toHaveBeenCalled();
});
it.each(["file", "root", "directory"])(
  "detects replacement during assembly: %s",
  (kind) => {
    const original = configured.createConfiguredResearchApplication;
    vi.spyOn(
      configured,
      "createConfiguredResearchApplication",
    ).mockImplementation((value) => {
      const application = original(value);
      if (kind === "file") {
        chmodSync(path, 0o600);
        writeFileSync(path, readFileSync(path, "utf8") + " ");
        chmodSync(path, 0o400);
      } else
        mkdirSync(
          join(
            kind === "root" ? root : join(root, "operator-startups"),
            "changed",
          ),
          { mode: 0o700 },
        );
      return application;
    });
    expect(() => loadResearchOperatorStartup(options)).toThrow(
      RESEARCH_OPERATOR_STARTUP_ERROR,
    );
    expect(transaction).not.toHaveBeenCalled();
  },
);
