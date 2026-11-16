/** Real constructors with synthetic canonical bytes and inert SQL/provider spies only. */
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import * as configured from "./configuredService";
import { prepareResearchLocalStartup } from "./localStartup";
import { localStartupFixture } from "./localStartup.fixture";
import {
  createResearchManagedOperatorStartup,
  prepareResearchManagedOperatorStartup,
  proposeResearchManagedOperatorStartup,
  RESEARCH_MANAGED_STARTUP_ERROR,
  type ResearchManagedOperatorStartupInput,
  type ResearchManagedOperatorStartupOptions,
} from "./managedOperatorStartup";
import { managedOperatorStartupFixture } from "./managedOperatorStartup.fixture";
import { prepareResearchManagedRetentionProfile } from "./managedRetentionProfile";
import { prepareResearchOperatorStartup } from "./operatorStartup";
import { prepareResearchManagedPublication } from "./publication";
import { prepareResearchReadEnvelope } from "./readAdoption";
import { prepareResearchRuntimeCorpus } from "./runtimeCorpus";

vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());
const sha = (s: string) => createHash("sha256").update(s).digest("hex"),
  fixture = managedOperatorStartupFixture(),
  input = () =>
    JSON.parse(
      fixture.proposal.documentJson,
    ) as ResearchManagedOperatorStartupInput;
function options(): ResearchManagedOperatorStartupOptions {
  return {
    startupJson: fixture.proposal.documentJson,
    independentlyAdoptedStartupSha256: fixture.proposal.documentSha256,
    preparedCorpus: prepareResearchRuntimeCorpus(fixture.bundle),
    database: {
      transaction: vi.fn(() => {
        throw Error("Unexpected SQL");
      }),
    },
    authOptions: {
      baseURL: fixture.document.origin,
      secret: "synthetic-secret-over-thirty-two-characters",
      googleClientId: "synthetic",
      googleClientSecret: "synthetic",
    },
    apiKey: vi.fn(() => {
      throw Error("Unexpected key access");
    }),
    runtime: {
      ...fixture.document.web_runtime,
      authorityEndpointIdentity: fixture.document.authority_endpoint_identity,
    },
    managedCleanupRuntime: fixture.runtime,
    priceFetch: vi.fn(),
    requestFetch: vi.fn(),
    generation: "read-only",
  };
}
function changed(
  value: ResearchManagedOperatorStartupInput,
  edit: (
    profile: Record<string, unknown>,
    read: Record<string, unknown>,
    doc: configured.ResearchConfiguredServiceDocument,
  ) => void,
) {
  const profile = JSON.parse(value.publication_input.retentionProfileJson),
    read = JSON.parse(value.publication_input.readEnvelopeJson),
    doc = JSON.parse(value.service_document_json);
  edit(profile, read, doc);
  const p = prepareResearchManagedRetentionProfile(profile),
    r = prepareResearchReadEnvelope(read);
  const publication_input = {
    ...value.publication_input,
    retentionProfileJson: p.document_json,
    retentionProfileSha256: p.document_sha256,
    readEnvelopeJson: r.document_json,
    readEnvelopeSha256: r.document_sha256,
  };
  return {
    ...value,
    publication_input,
    service_document_json: configured.prepareResearchConfiguredServiceDocument({
      ...doc,
      publication_sha256:
        prepareResearchManagedPublication(publication_input).sha256,
    }).documentJson,
  };
}
it("proposes a distinct stable managed intent while rebuilding only the two known approval links", () => {
  expect(prepareResearchManagedOperatorStartup(input())).toEqual(
    fixture.proposal,
  );
  expect(proposeResearchManagedOperatorStartup(input())).toEqual(
    fixture.proposal,
  );
  const oldApproval = changed(input(), (p, r) => {
    (p.scope as { approvalSha256: string }).approvalSha256 = "f".repeat(64);
    (r.original_scope as { approvalSha256: string }).approvalSha256 =
      "f".repeat(64);
  });
  expect(proposeResearchManagedOperatorStartup(oldApproval)).toEqual(
    fixture.proposal,
  );
  expect(() => prepareResearchManagedOperatorStartup(oldApproval)).toThrow(
    RESEARCH_MANAGED_STARTUP_ERROR,
  );
  expect(() => prepareResearchManagedOperatorStartup(fixture.input)).toThrow(
    RESEARCH_MANAGED_STARTUP_ERROR,
  );
  expect(fixture.proposal.documentJson).not.toContain(
    '"approvalSha256":"' + "0".repeat(64),
  );
});
it("refuses local/operator purposes and cannot be adopted by their existing loaders", () => {
  expect(() =>
    prepareResearchManagedOperatorStartup(
      localStartupFixture().startup as never,
    ),
  ).toThrow();
  expect(() => prepareResearchLocalStartup(input() as never)).toThrow();
  expect(() => prepareResearchOperatorStartup(input() as never)).toThrow();
});
it.each([
  "worker_artifact_sha256",
  "dependency_lock_sha256",
  "critical_inputs_sha256",
  "project_scope_sha256",
] as const)("binds managed %s into the new native intent", (key) => {
  const edited = changed(input(), (p) => {
    (p.runtime as Record<string, unknown>)[key] = "f".repeat(64);
  });
  expect(proposeResearchManagedOperatorStartup(edited).intentSha256).not.toBe(
    fixture.proposal.intentSha256,
  );
  expect(() => prepareResearchManagedOperatorStartup(edited)).toThrow();
});
it("assembles the actual configured managed app without startup SQL, credential or provider work", async () => {
  const o = options(),
    app = createResearchManagedOperatorStartup(o);
  expect(
    (
      await app.handleRequest(
        new Request(fixture.document.origin + "/chat/research/api"),
      )
    ).status,
  ).toBe(403);
  expect(
    (await app.handleRequest(new Request(fixture.document.origin + "/other")))
      .status,
  ).toBe(404);
  expect(o.database.transaction).not.toHaveBeenCalled();
  expect(o.apiKey).not.toHaveBeenCalled();
  expect(o.priceFetch).not.toHaveBeenCalled();
  expect(o.requestFetch).not.toHaveBeenCalled();
});
it.each([
  "hash",
  "bytes",
  "runtime",
  "endpoint",
  "cleanup",
  "corpus",
  "local-root",
] as const)(
  "refuses managed startup %s drift before SQL or key work",
  (key) => {
    const o = options();
    let edited: ResearchManagedOperatorStartupOptions = o;
    if (key === "hash")
      edited = { ...o, independentlyAdoptedStartupSha256: "f".repeat(64) };
    if (key === "bytes")
      edited = {
        ...o,
        startupJson: o.startupJson + "\n",
        independentlyAdoptedStartupSha256: sha(o.startupJson + "\n"),
      };
    if (key === "runtime")
      edited = { ...o, runtime: { ...o.runtime, revision: "f".repeat(64) } };
    if (key === "endpoint")
      edited = {
        ...o,
        runtime: { ...o.runtime, authorityEndpointIdentity: "f".repeat(64) },
      };
    if (key === "cleanup")
      edited = {
        ...o,
        managedCleanupRuntime: {
          ...o.managedCleanupRuntime,
          project_scope_sha256: "f".repeat(64),
        },
      };
    if (key === "corpus")
      edited = { ...o, preparedCorpus: { ...o.preparedCorpus! } };
    if (key === "local-root")
      edited = { ...o, corpusRoot: "/tmp/disallowed" } as never;
    expect(() => createResearchManagedOperatorStartup(edited)).toThrow(
      RESEARCH_MANAGED_STARTUP_ERROR,
    );
    expect(o.database.transaction).not.toHaveBeenCalled();
    expect(o.apiKey).not.toHaveBeenCalled();
  },
);
it("captures the auth settings once and forwards the validated origin snapshot", () => {
  const o = options(),
    good = o.authOptions,
    bad = { ...good, baseURL: "http://localhost:1" };
  let reads = 0;
  const spy = vi.spyOn(
    configured,
    "createConfiguredResearchManagedApplication",
  );
  const app = createResearchManagedOperatorStartup({
    ...o,
    get authOptions() {
      return ++reads === 1 ? good : bad;
    },
  });
  expect(app.handleRequest).toBeTypeOf("function");
  expect(reads).toBe(1);
  expect(spy.mock.calls[0][0].authOptions.baseURL).toBe(good.baseURL);
});
it("does not downgrade managed runtime through a changing kind getter", () => {
  const o = options(),
    doc = JSON.parse(input().service_document_json);
  doc.web_runtime.kind = "reviewed-local-launch";
  const localKind = configured.prepareResearchConfiguredServiceDocument(doc);
  let reads = 0;
  expect(() =>
    configured.createConfiguredResearchManagedApplication({
      ...o,
      documentJson: localKind.documentJson,
      independentlyAdoptedDocumentSha256: localKind.documentSha256,
      publication: prepareResearchManagedPublication(input().publication_input),
      runtime: {
        revision: o.runtime.revision,
        authorityEndpointIdentity: o.runtime.authorityEndpointIdentity,
        get kind() {
          return ++reads === 1
            ? "immutable-deployment"
            : "reviewed-local-launch";
        },
      },
    }),
  ).toThrow(configured.RESEARCH_CONFIGURED_SERVICE_ERROR);
  expect(reads).toBe(1);
  expect(o.database.transaction).not.toHaveBeenCalled();
});

it("rejects a self-consistent declared Node22 app under the actual Node24 runtime before SQL or key work", () => {
  const o = options(),
    edited = changed(input(), (p) => {
      (p.runtime as { node_major: number }).node_major = 22;
    });
  expect(() =>
    configured.createConfiguredResearchManagedApplication({
      ...o,
      documentJson: edited.service_document_json,
      independentlyAdoptedDocumentSha256: sha(edited.service_document_json),
      publication: prepareResearchManagedPublication(edited.publication_input),
      managedCleanupRuntime: { ...o.managedCleanupRuntime, node_major: 22 },
    }),
  ).toThrow(configured.RESEARCH_CONFIGURED_SERVICE_ERROR);
  expect(o.database.transaction).not.toHaveBeenCalled();
  expect(o.apiKey).not.toHaveBeenCalled();
});
