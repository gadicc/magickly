/** New-purpose operator service preparation; no adoption, renewal, policy write or hosted work. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { parseBoundedResearchJson } from "./boundedJson";
import {
  createConfiguredResearchManagedApplication,
  prepareResearchConfiguredServiceDocument,
  type ResearchConfiguredManagedServiceOptions,
  type ResearchConfiguredServiceDocument,
} from "./configuredService";
import {
  prepareResearchManagedRetentionProfile,
  type ResearchManagedRetentionProfileInput,
} from "./managedRetentionProfile";
import {
  inspectResearchManagedPublication,
  prepareResearchManagedPublication,
  type ResearchPublicationInput,
} from "./publication";
import {
  prepareResearchReadEnvelope,
  type ResearchReadEnvelopeInput,
} from "./readAdoption";

import { copyResearchSourceAuthOptions } from "./sqlSourceReaders";

export const RESEARCH_MANAGED_STARTUP_ERROR =
  "Private managed operator service unavailable";
export const RESEARCH_MANAGED_STARTUP_BYTE_LIMIT = 1024 * 1024;
const sha = (s: string) => createHash("sha256").update(s).digest("hex"),
  hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/)),
  shape = v.strictObject({
    schema_version: v.literal(2),
    kind: v.literal("private-managed-operator-query-service-startup"),
    service_document_json: v.string(),
    publication_input: v.unknown(),
  });
const fail = (): never => {
  throw Error(RESEARCH_MANAGED_STARTUP_ERROR);
};
/** Private configuration only. Actual identities, corpus and target bindings stay outside Git and client responses. */
export interface ResearchManagedOperatorStartupInput {
  readonly schema_version: 2;
  readonly kind: "private-managed-operator-query-service-startup";
  readonly service_document_json: string;
  readonly publication_input: ResearchPublicationInput;
}
function compile(input: ResearchManagedOperatorStartupInput) {
  const value = v.parse(shape, input),
    publication = prepareResearchManagedPublication(
      value.publication_input as ResearchPublicationInput,
    ),
    facts = inspectResearchManagedPublication(publication),
    service = prepareResearchConfiguredServiceDocument(
      parseBoundedResearchJson(
        value.service_document_json,
        8192,
      ) as ResearchConfiguredServiceDocument,
    ),
    document = JSON.parse(
      service.documentJson,
    ) as ResearchConfiguredServiceDocument;
  if (
    value.service_document_json !== service.documentJson ||
    document.publication_sha256 !== publication.sha256 ||
    document.web_runtime.kind !== "immutable-deployment" ||
    document.native_target.table_oids.artifacts !==
      facts.target.artifactTableOid
  )
    fail();
  // Existing source-policy compiler accepts literal false for excerpts/images/downloads.
  const owned: ResearchManagedOperatorStartupInput = {
    schema_version: 2,
    kind: "private-managed-operator-query-service-startup",
    service_document_json: service.documentJson,
    publication_input: {
      sourcePolicyJson: facts.source_policy_json,
      sourcePolicySha256: facts.source_policy_sha256,
      retentionProfileJson: facts.retention_profile_json,
      retentionProfileSha256: sha(facts.retention_profile_json),
      readEnvelopeJson: facts.read_envelope_json,
      readEnvelopeSha256: facts.read_envelope_sha256,
      sourceStorage: facts.source_storage,
    },
  };
  if (
    Buffer.byteLength(JSON.stringify(owned)) >
    RESEARCH_MANAGED_STARTUP_BYTE_LIMIT
  )
    fail();
  return { owned, facts, document };
}
/** Rebuild the two explicitly known approval-bearing children and every derived digest. Never recursively strip caller fields. */
function rebind(
  input: ResearchManagedOperatorStartupInput,
  approvalSha256: string,
) {
  const { owned, facts, document } = compile(input),
    scope = { ...facts.target.scope, approvalSha256 },
    retention = prepareResearchManagedRetentionProfile({
      ...(JSON.parse(
        facts.retention_profile_json,
      ) as ResearchManagedRetentionProfileInput),
      scope,
    }),
    read = prepareResearchReadEnvelope({
      ...(JSON.parse(facts.read_envelope_json) as ResearchReadEnvelopeInput),
      original_scope: scope,
    }),
    publicationInput = {
      ...owned.publication_input,
      retentionProfileJson: retention.document_json,
      retentionProfileSha256: retention.document_sha256,
      readEnvelopeJson: read.document_json,
      readEnvelopeSha256: read.document_sha256,
    },
    publication = prepareResearchManagedPublication(publicationInput),
    service = prepareResearchConfiguredServiceDocument({
      ...document,
      publication_sha256: publication.sha256,
    });
  return {
    ...owned,
    service_document_json: service.documentJson,
    publication_input: publicationInput,
  };
}
function intent(input: ResearchManagedOperatorStartupInput) {
  // A fixed internal sentinel breaks the approval/digest cycle. Existing compilers
  // first enforce all duplicate bindings; every other fact remains in the hash.
  // These normalized sentinel children are never returned or used as a startup.
  return sha(
    JSON.stringify({
      schema_version: 2,
      kind: "private-managed-operator-query-service-intent",
      startup: rebind(input, "0".repeat(64)),
    }),
  );
}
/** Propose NEW exact native approval/startup bytes. This neither adopts the proposal nor reuses the input's approval or cleanup authority. */
export function proposeResearchManagedOperatorStartup(
  input: ResearchManagedOperatorStartupInput,
) {
  try {
    return prepareResearchManagedOperatorStartup(rebind(input, intent(input)));
  } catch {
    return fail();
  }
}
/** Require a distinct purpose bound into the native approval, all canonical children and the independently pinned immutable runtime. */
export function prepareResearchManagedOperatorStartup(
  input: ResearchManagedOperatorStartupInput,
) {
  try {
    const { owned, facts } = compile(input),
      intentSha256 = intent(owned);
    if (facts.target.scope.approvalSha256 !== intentSha256) fail();
    const documentJson = JSON.stringify(owned);
    return Object.freeze({
      documentJson,
      documentSha256: sha(documentJson),
      intentSha256,
    });
  } catch {
    return fail();
  }
}
/** Captured private startup from protected configuration plus independently adopted outer custody. No filesystem or environment fallback. */
export interface ResearchManagedOperatorStartupOptions
  extends Omit<
    ResearchConfiguredManagedServiceOptions,
    "documentJson" | "independentlyAdoptedDocumentSha256" | "publication"
  > {
  readonly startupJson: string;
  readonly independentlyAdoptedStartupSha256: string;
}
/** Assemble only the new managed purpose, genuine canonical corpus handles and all existing native/session/source/retention fences. No route is enabled and construction performs no I/O. */
export function createResearchManagedOperatorStartup(
  options: ResearchManagedOperatorStartupOptions,
) {
  try {
    const startupJson = options.startupJson,
      expected = v.parse(hash, options.independentlyAdoptedStartupSha256),
      input = parseBoundedResearchJson(
        startupJson,
        RESEARCH_MANAGED_STARTUP_BYTE_LIMIT,
      ) as ResearchManagedOperatorStartupInput,
      startup = prepareResearchManagedOperatorStartup(input);
    if (
      startup.documentSha256 !== expected ||
      startup.documentJson !== startupJson ||
      "corpusRoot" in options
    )
      fail();
    const document = JSON.parse(
      input.service_document_json,
    ) as ResearchConfiguredServiceDocument;
    const authOptions = copyResearchSourceAuthOptions(options.authOptions);
    if (authOptions.baseURL !== document.origin) fail();
    return createConfiguredResearchManagedApplication({
      documentJson: input.service_document_json,
      independentlyAdoptedDocumentSha256: sha(input.service_document_json),
      publication: prepareResearchManagedPublication(input.publication_input),
      preparedCorpus: options.preparedCorpus,
      preparedCatalog: options.preparedCatalog,
      database: options.database,
      authOptions,
      apiKey: options.apiKey,
      runtime: options.runtime,
      managedCleanupRuntime: options.managedCleanupRuntime,
      generation: options.generation,
      priceFetch: options.priceFetch,
      requestFetch: options.requestFetch,
    });
  } catch {
    return fail();
  }
}
