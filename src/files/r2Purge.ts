import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createS3FileStorage } from "@gadicc/loom/files/s3";
import { readRitualStorageConfig } from "./ritualStorageConfig";

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

/** The client calls the purge makes; tests pass a fake. */
export interface RitualPurgeClient {
  send(
    command: DeleteObjectCommand | ListObjectsV2Command,
    options?: { abortSignal?: AbortSignal },
  ): Promise<unknown>;
  destroy(): void;
}

/** Deletes a purged ritual's objects from this deployment's bucket. */
export interface RitualObjectPurger {
  /** The configured bucket; every recorded bucket must equal it. */
  readonly bucket: string;
  /** Deletes one object; a missing one is success. */
  deleteObject(bucket: string, key: string): Promise<void>;
  /** Lists every key under a prefix (paged); callers treat errors as best-effort. */
  listPrefix(bucket: string, prefix: string): Promise<string[]>;
  destroy(): void;
}

const TIMEOUT_MS = 10_000;
const PREFIX = /^(?:ritual-bundles|ritual-files)\/[^/]+\/$/;

function missing(error: unknown) {
  const value = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  } | null;
  return (
    value?.$metadata?.httpStatusCode === 404 ||
    value?.name === "NoSuchKey" ||
    value?.name === "NotFound"
  );
}

/**
 * The only module that deletes objects (plan 065, §5), imported only by the
 * purge. It wires Loom's S3 adapter with DeleteObjectCommand, which is what
 * stops Loom's silent no-op without one; the Files route's adapter stays
 * read-only. Every call names a bucket, and a bucket other than this
 * deployment's is refused, so a preview key is never deleted from
 * production or the reverse. Each request is capped at ten seconds.
 */
export function createRitualObjectPurger(
  environment: RuntimeEnvironment,
  options: { client?: RitualPurgeClient } = {},
): RitualObjectPurger {
  const config = readRitualStorageConfig(environment);
  const client: RitualPurgeClient =
    options.client ??
    (new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: config.credentials,
      forcePathStyle: true,
      maxAttempts: 2,
      followRegionRedirects: false,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      ...(config.kind === "minio"
        ? { requestHandler: { httpAgent: { keepAlive: false } } }
        : {}),
    }) as unknown as RitualPurgeClient);
  const storage = createS3FileStorage({
    provider: config.kind,
    bucket: config.bucket,
    commands: { GetObjectCommand, PutObjectCommand, DeleteObjectCommand },
    client: {
      send: async (command) => ({
        ...((await client.send(command as DeleteObjectCommand, {
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        })) as object),
      }),
    },
  });
  const own = (bucket: string) => {
    if (bucket !== config.bucket)
      throw new Error("Refusing another bucket's object");
  };
  return {
    bucket: config.bucket,
    async deleteObject(bucket, key) {
      own(bucket);
      if (!key || key.startsWith("/")) throw new Error("Invalid object key");
      try {
        // Loom's adapter only has a delete when DeleteObjectCommand is wired;
        // never let a missing one pass as success.
        if (!storage.deleteObject)
          throw new Error("Object deletion is not wired");
        await storage.deleteObject({ bucket, objectKey: key });
      } catch (error) {
        if (!missing(error)) throw error;
      }
    },
    async listPrefix(bucket, prefix) {
      own(bucket);
      if (!PREFIX.test(prefix)) throw new Error("Invalid object prefix");
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const page = (await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: token,
          }),
          { abortSignal: AbortSignal.timeout(TIMEOUT_MS) },
        )) as ListObjectsV2CommandOutput;
        for (const item of page.Contents ?? [])
          if (item.Key?.startsWith(prefix)) keys.push(item.Key);
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return keys;
    },
    destroy: () => client.destroy(),
  };
}
