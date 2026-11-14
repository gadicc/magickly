/** New-purpose operator service preparation; no adoption, renewal, policy write or hosted work. */
import "server-only";
import { createHash } from "node:crypto";
import { join } from "node:path";
import * as v from "valibot";
import { parseBoundedResearchJson } from "./boundedJson";
import {
  createConfiguredResearchApplication,
  prepareResearchConfiguredServiceDocument,
  type ResearchConfiguredServiceDocument,
  type ResearchConfiguredServiceOptions,
} from "./configuredService";
import {
  assertPrivateRetentionFileSnapshot,
  readPrivateRetentionManifest,
  requirePrivateRetentionDirectory,
} from "./privateFiles";
import {
  inspectResearchPublication,
  prepareResearchPublication,
  type ResearchPublicationInput,
} from "./publication";
import {
  prepareResearchReadEnvelope,
  type ResearchReadEnvelopeInput,
} from "./readAdoption";
import {
  prepareResearchRetentionProfile,
  type ResearchRetentionProfileInput,
} from "./retentionProfile";

export const RESEARCH_OPERATOR_STARTUP_ERROR =
  "Private operator service unavailable";
export const RESEARCH_OPERATOR_STARTUP_BYTE_LIMIT = 1024 * 1024;
const sha = (s: string) => createHash("sha256").update(s).digest("hex"),
  hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/)),
  shape = v.strictObject({
    schema_version: v.literal(1),
    kind: v.literal("private-operator-query-service-startup"),
    service_document_json: v.string(),
    publication_input: v.unknown(),
  });
const fail = (): never => {
  throw Error(RESEARCH_OPERATOR_STARTUP_ERROR);
};
/** Private configuration only. Actual identities, corpus and target bindings stay outside Git and client responses. */
export interface ResearchOperatorStartupInput {
  readonly schema_version: 1;
  readonly kind: "private-operator-query-service-startup";
  readonly service_document_json: string;
  readonly publication_input: ResearchPublicationInput;
}
function compile(input: ResearchOperatorStartupInput) {
  const value = v.parse(shape, input),
    publication = prepareResearchPublication(
      value.publication_input as ResearchPublicationInput,
    ),
    facts = inspectResearchPublication(publication),
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
  const owned: ResearchOperatorStartupInput = {
    schema_version: 1,
    kind: "private-operator-query-service-startup",
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
    RESEARCH_OPERATOR_STARTUP_BYTE_LIMIT
  )
    fail();
  return { owned, facts, document };
}
/** Rebuild the two explicitly known approval-bearing children and every derived digest. Never recursively strip caller fields. */
function rebind(input: ResearchOperatorStartupInput, approvalSha256: string) {
  const { owned, facts, document } = compile(input),
    scope = { ...facts.target.scope, approvalSha256 },
    retention = prepareResearchRetentionProfile({
      ...(JSON.parse(
        facts.retention_profile_json,
      ) as ResearchRetentionProfileInput),
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
    publication = prepareResearchPublication(publicationInput),
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
function intent(input: ResearchOperatorStartupInput) {
  // A fixed internal sentinel breaks the approval/digest cycle. Existing compilers
  // first enforce all duplicate bindings; every other fact remains in the hash.
  // These normalized sentinel children are never returned or used as a startup.
  return sha(
    JSON.stringify({
      schema_version: 1,
      kind: "private-operator-query-service-intent",
      startup: rebind(input, "0".repeat(64)),
    }),
  );
}
/** Propose NEW exact native approval/startup bytes. This neither adopts the proposal nor reuses the input's approval or cleanup authority. */
export function proposeResearchOperatorStartup(
  input: ResearchOperatorStartupInput,
) {
  try {
    return prepareResearchOperatorStartup(rebind(input, intent(input)));
  } catch {
    return fail();
  }
}
/** Require a distinct purpose bound into the native approval, all canonical children and the independently pinned immutable runtime. */
export function prepareResearchOperatorStartup(
  input: ResearchOperatorStartupInput,
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
/** Trusted outer code/account/endpoint custody remains required; the file and matching hashes cannot attest it. */
export interface ResearchOperatorStartupOptions {
  readonly root: string;
  readonly independentlyAdoptedStartupSha256: string;
  readonly runtimeRevision: string;
  readonly authorityEndpointIdentity: string;
  readonly database: ResearchConfiguredServiceOptions["database"];
  readonly authOptions: ResearchConfiguredServiceOptions["authOptions"];
  readonly apiKey: ResearchConfiguredServiceOptions["apiKey"];
  /** Additional restrictions only. Native/source/price/cleanup guards always remain mandatory. */
  readonly generation?: ResearchConfiguredServiceOptions["generation"];
  readonly priceFetch?: typeof fetch;
  readonly requestFetch?: typeof fetch;
}
/** Explicit new-purpose service assembly from an owner-only immutable external package. Writes nothing; no route or environment flag invokes this automatically. */
export function loadResearchOperatorStartup(
  options: ResearchOperatorStartupOptions,
) {
  try {
    const expected = v.parse(hash, options.independentlyAdoptedStartupSha256),
      runtimeRevision = v.parse(hash, options.runtimeRevision),
      authorityEndpointIdentity = v.parse(
        hash,
        options.authorityEndpointIdentity,
      ),
      root = options.root,
      directory = join(root, "operator-startups"),
      before = [
        [root, requirePrivateRetentionDirectory(root)],
        [directory, requirePrivateRetentionDirectory(directory)],
      ] as const;
    if (before.some(([, snapshot]) => snapshot.mode !== BigInt(0o700))) fail();
    const path = join(directory, expected + ".json"),
      file = readPrivateRetentionManifest(path);
    if (file.sha256 !== expected) fail();
    const prepared = prepareResearchOperatorStartup(
      parseBoundedResearchJson(
        file.text,
        RESEARCH_OPERATOR_STARTUP_BYTE_LIMIT,
      ) as ResearchOperatorStartupInput,
    );
    if (prepared.documentJson !== file.text) fail();
    const input = JSON.parse(
        prepared.documentJson,
      ) as ResearchOperatorStartupInput,
      document = JSON.parse(
        input.service_document_json,
      ) as ResearchConfiguredServiceDocument;
    if (options.authOptions.baseURL !== document.origin) fail();
    const application = createConfiguredResearchApplication({
      documentJson: input.service_document_json,
      independentlyAdoptedDocumentSha256: sha(input.service_document_json),
      publication: prepareResearchPublication(input.publication_input),
      corpusRoot: join(root, "runtime-corpora"),
      database: options.database,
      authOptions: options.authOptions,
      apiKey: options.apiKey,
      runtime: {
        kind: "immutable-deployment",
        revision: runtimeRevision,
        authorityEndpointIdentity,
      },
      generation: options.generation,
      priceFetch: options.priceFetch,
      requestFetch: options.requestFetch,
    });
    assertPrivateRetentionFileSnapshot(
      path,
      RESEARCH_OPERATOR_STARTUP_BYTE_LIMIT,
      "code",
      file.snapshot_sha256,
    );
    for (const [path, original] of before) {
      const current = requirePrivateRetentionDirectory(path),
        stringify = (value: unknown) =>
          JSON.stringify(value, (_, field) =>
            typeof field === "bigint" ? String(field) : field,
          );
      if (stringify(current) !== stringify(original)) fail();
    }
    return application.handleRequest;
  } catch {
    return fail();
  }
}
