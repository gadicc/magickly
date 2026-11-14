/** Read-only server-side corpus store; no bucket creation, upload, listing, public URL or files-route registration. */
import "server-only";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as v from "valibot";
import { RESEARCH_CORPUS_FILE_LIMITS } from "./corpusBundle";
import {
  RESEARCH_REMOTE_CORPUS_ERROR,
  type ResearchCorpusObjectName,
  type ResearchPrivateCorpusObject,
} from "./remoteCorpus";

const shape = v.strictObject({
  kind: v.literal("r2-private-immutable-research-corpus"),
  account_id: v.pipe(v.string(), v.length(32), v.regex(/^[a-f0-9]{32}$/)),
  bucket: v.pipe(
    v.string(),
    v.minLength(3),
    v.maxLength(63),
    v.regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$(?![\s\S])/),
  ),
  jurisdiction: v.picklist(["default", "eu"]),
  corpus_manifest_sha256: v.pipe(
    v.string(),
    v.length(64),
    v.regex(/^[a-f0-9]{64}$/),
  ),
  custody_contract: v.literal(
    "outer-controlled-private-bucket-no-public-access-or-files-route",
  ),
  credential_contract: v.literal(
    "outer-controlled-read-only-token-for-this-bucket",
  ),
});
/** Actual account/bucket/jurisdiction/content-address must be independently bound into hosted adoption; strings do not prove provider privacy or token scope. */
export type ResearchPrivateCorpusStore = v.InferInput<typeof shape>;
/** Canonical source-free metadata only; actual identities stay outside the public repository. */
export function prepareResearchPrivateCorpusStore(
  input: ResearchPrivateCorpusStore,
) {
  try {
    return Object.freeze(v.parse(shape, input));
  } catch {
    throw Error(RESEARCH_REMOTE_CORPUS_ERROR);
  }
}
/** Explicit server-only credential input; no ambient AWS/ritual-file credential chain is consulted. */
export interface ResearchPrivateCorpusStoreOptions {
  readonly descriptor: ResearchPrivateCorpusStore;
  readonly credentials: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
  };
}
/** Construct only behind canonical operator/current-source gates. Each object is a single Get; the caller owns the returned stream and must destroy this client after its bounded load. */
export function createResearchPrivateCorpusStore(
  options: ResearchPrivateCorpusStoreOptions,
) {
  try {
    const descriptor = prepareResearchPrivateCorpusStore(options.descriptor),
      credentials = v.parse(
        v.strictObject({
          accessKeyId: v.pipe(
            v.string(),
            v.minLength(1),
            v.maxLength(1024),
            v.regex(/^[^\s\0]+$(?![\s\S])/),
          ),
          secretAccessKey: v.pipe(
            v.string(),
            v.minLength(1),
            v.maxLength(1024),
            v.regex(/^[^\s\0]+$(?![\s\S])/),
          ),
        }),
        options.credentials,
      ),
      client = new S3Client({
        region: "auto",
        endpoint: `https://${descriptor.account_id}${descriptor.jurisdiction === "eu" ? ".eu" : ""}.r2.cloudflarestorage.com`,
        credentials: { ...credentials },
        forcePathStyle: true,
        maxAttempts: 1,
        followRegionRedirects: false,
        useDualstackEndpoint: false,
        useFipsEndpoint: false,
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      });
    let closed = false;
    return Object.freeze({
      /** Fixed content-addressed object family only; arbitrary keys and signed URLs are unsupported. */
      async readObject(
        name: ResearchCorpusObjectName,
        signal: AbortSignal,
      ): Promise<ResearchPrivateCorpusObject> {
        let raw: unknown, body: ReadableStream<Uint8Array> | undefined;
        try {
          signal.throwIfAborted();
          if (
            closed ||
            typeof name !== "string" ||
            !Object.hasOwn(RESEARCH_CORPUS_FILE_LIMITS, name)
          )
            throw Error();
          const response = await client.send(
            new GetObjectCommand({
              Bucket: descriptor.bucket,
              Key: `private-research/v1/corpora/${descriptor.corpus_manifest_sha256}/${name}`,
            }),
            { abortSignal: signal },
          );
          raw = response.Body;
          if (raw instanceof ReadableStream) body = raw;
          else if (
            response.Body &&
            typeof response.Body.transformToWebStream === "function"
          )
            body = response.Body.transformToWebStream();
          signal.throwIfAborted();
          const bytes = response.ContentLength;
          if (
            closed ||
            response.$metadata.httpStatusCode !== 200 ||
            response.ContentEncoding ||
            response.ContentRange ||
            !(body instanceof ReadableStream) ||
            body.locked ||
            !Number.isSafeInteger(bytes) ||
            bytes! < 0 ||
            bytes! > RESEARCH_CORPUS_FILE_LIMITS[name]
          )
            throw Error();
          return Object.freeze({ body, bytes: bytes! });
        } catch {
          try {
            if (body && !body.locked) void body.cancel().catch(() => {});
          } catch {}
          try {
            if (
              raw &&
              typeof (raw as { destroy?: unknown }).destroy === "function"
            )
              (raw as { destroy(): void }).destroy();
          } catch {}
          throw Error(RESEARCH_REMOTE_CORPUS_ERROR);
        }
      },
      destroy() {
        if (!closed) {
          closed = true;
          client.destroy();
        }
      },
    });
  } catch {
    throw Error(RESEARCH_REMOTE_CORPUS_ERROR);
  }
}
