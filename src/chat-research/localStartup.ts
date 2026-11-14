/** Concrete private-file assembly only; no env/key reader, SQL writer or adoption is installed. */
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
  prepareResearchPublication,
  type ResearchPublicationInput,
} from "./publication";
export const RESEARCH_LOCAL_STARTUP_ERROR =
  "Private research startup unavailable";
export const RESEARCH_LOCAL_STARTUP_BYTE_LIMIT = 1024 * 1024;
const fail = (): never => {
  throw Error(RESEARCH_LOCAL_STARTUP_ERROR);
};
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const shape = v.strictObject({
  schema_version: v.literal(1),
  kind: v.literal("private-local-research-startup"),
  service_document_json: v.string(),
  publication_input: v.strictObject({
    sourcePolicyJson: v.string(),
    sourcePolicySha256: hash,
    retentionProfileJson: v.string(),
    retentionProfileSha256: hash,
    readEnvelopeJson: v.string(),
    readEnvelopeSha256: hash,
    sourceStorage: v.strictObject({
      corpusVersion: v.string(),
      schemaName: v.optional(v.string()),
      authSchemaName: v.optional(v.string()),
    }),
  }),
});
/** Canonical private configuration, not consent or a source/spending capability. Never send it to a client or public receipt. */
export interface ResearchLocalStartupInput {
  readonly schema_version: 1;
  readonly kind: "private-local-research-startup";
  readonly service_document_json: string;
  readonly publication_input: ResearchPublicationInput;
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
/** Pure exact-child compilation. Each existing compiler retains its own smaller bounds and policy checks. */
export function prepareResearchLocalStartup(input: ResearchLocalStartupInput) {
  try {
    const value = v.parse(shape, input),
      publication = prepareResearchPublication(value.publication_input),
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
      service.documentJson !== value.service_document_json ||
      document.publication_sha256 !== publication.sha256 ||
      document.web_runtime.kind !== "reviewed-local-launch"
    )
      fail();
    const documentJson = JSON.stringify(value);
    if (Buffer.byteLength(documentJson) > RESEARCH_LOCAL_STARTUP_BYTE_LIMIT)
      fail();
    return Object.freeze({ documentJson, documentSha256: sha(documentJson) });
  } catch {
    return fail();
  }
}
/** Independent reviewed outer runtime and actual root only; a copied file/hash cannot create adoption. */
export interface ResearchLocalStartupOptions {
  readonly root: string;
  readonly independentlyAdoptedStartupSha256: string;
  readonly runtimeRevision: string;
  readonly authorityEndpointIdentity: string;
  readonly database: ResearchConfiguredServiceOptions["database"];
  readonly authOptions: ResearchConfiguredServiceOptions["authOptions"];
  readonly apiKey: ResearchConfiguredServiceOptions["apiKey"];
  /** Reviewed caller restriction. Actual Next bootstrap supplies read-only; a private fixed-purpose driver supplies exact-operation guards. */
  readonly generation?: ResearchConfiguredServiceOptions["generation"];
  readonly priceFetch?: typeof fetch;
  readonly requestFetch?: typeof fetch;
}
/** Load the genuine configured service from an immutable private package and pinned corpus. Trusted generic root permits synthetic fixtures; the app separately fixes its OS-owned non-Git/non-temp location. Creates/writes nothing. */
export function loadResearchLocalStartup(options: ResearchLocalStartupOptions) {
  try {
    const expected = v.parse(hash, options.independentlyAdoptedStartupSha256),
      runtimeRevision = v.parse(hash, options.runtimeRevision),
      authorityEndpointIdentity = v.parse(
        hash,
        options.authorityEndpointIdentity,
      ),
      root = options.root,
      directory = join(root, "web-startups"),
      before = [
        [root, requirePrivateRetentionDirectory(root)],
        [directory, requirePrivateRetentionDirectory(directory)],
      ] as const;
    if (before.some(([, s]) => s.mode !== BigInt(0o700))) fail();
    const path = join(directory, expected + ".json"),
      file = readPrivateRetentionManifest(path);
    if (file.sha256 !== expected) fail();
    const prepared = prepareResearchLocalStartup(
      parseBoundedResearchJson(
        file.text,
        RESEARCH_LOCAL_STARTUP_BYTE_LIMIT,
      ) as ResearchLocalStartupInput,
    );
    // The file's SHA was already independently matched; exact canonical bytes
    // imply the same digest without a redundant second digest comparison.
    if (prepared.documentJson !== file.text) fail();
    const input = JSON.parse(
        prepared.documentJson,
      ) as ResearchLocalStartupInput,
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
        kind: "reviewed-local-launch",
        revision: runtimeRevision,
        authorityEndpointIdentity,
      },
      generation: options.generation,
      priceFetch: options.priceFetch,
      requestFetch: options.requestFetch,
    });
    assertPrivateRetentionFileSnapshot(
      path,
      RESEARCH_LOCAL_STARTUP_BYTE_LIMIT,
      "code",
      file.snapshot_sha256,
    );
    for (const [path, original] of before) {
      const current = requirePrivateRetentionDirectory(path);
      if (
        JSON.stringify(current, (_, value) =>
          typeof value === "bigint" ? String(value) : value,
        ) !==
        JSON.stringify(original, (_, value) =>
          typeof value === "bigint" ? String(value) : value,
        )
      )
        fail();
    }
    return application.handleRequest;
  } catch {
    return fail();
  }
}
