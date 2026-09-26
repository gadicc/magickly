import "server-only";

import { RUNTIME_DATABASE_URL_ENV_NAMES } from "@gadicc/loom/db/database-url";
import {
  type MinioRitualStorageConfig,
  type R2RitualStorageConfig,
  validateMinioRitualStorageConfig,
  validateR2RitualStorageConfig,
} from "./r2RitualStorage";

export type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;
export type RitualStorageConfig =
  | R2RitualStorageConfig
  | MinioRitualStorageConfig;

function required(environment: RuntimeEnvironment, key: string) {
  const value = environment[key]?.trim();
  if (!value || value.includes("\0"))
    throw new Error("Ritual storage is not configured");
  return value;
}

function loopbackOrigin(value: string, allowLocalhost = false) {
  try {
    const url = new URL(value);
    const localHost =
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]" ||
      (allowLocalhost && url.hostname === "localhost");
    if (
      url.protocol !== "http:" ||
      !localHost ||
      !url.port ||
      value !== url.origin
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error("Local ritual storage is not configured");
  }
}

function loopbackDatabaseUrl(value: string, development: boolean) {
  try {
    const url = new URL(value);
    const authority = value
      .slice(value.indexOf("://") + 3)
      .split(/[/?#]/, 1)[0]
      ?.split("@")
      .at(-1);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      (url.hostname !== "127.0.0.1" &&
        url.hostname !== "[::1]" &&
        !(development && url.hostname === "db.localtest.me")) ||
      !url.port ||
      authority !== url.host ||
      url.pathname.length < 2 ||
      (url.search !== "" &&
        !(development && url.search === "?sslmode=disable")) ||
      url.hash !== ""
    )
      throw new Error();
  } catch {
    throw new Error("Local ritual storage is not configured");
  }
}

/**
 * MinIO is limited to local database and storage endpoints in a local
 * production build or ordinary Next development process. Development also
 * permits db.localtest.me for the shared local Neon proxy; acceptance stays
 * numeric-only with no database URL query.
 */
export function assertLocalRitualStorageBoundary(
  environment: RuntimeEnvironment,
) {
  const development =
    environment.NODE_ENV === "development" &&
    environment.MAGICKLI_LOCAL_ACCEPTANCE === undefined;
  if (
    Object.entries(environment).some(
      ([key, value]) =>
        value !== undefined && (key === "VERCEL" || key.startsWith("VERCEL_")),
    )
  )
    throw new Error("Local ritual storage is not configured");
  loopbackOrigin(required(environment, "BETTER_AUTH_URL"), development);
  loopbackOrigin(required(environment, "FILES_S3_ENDPOINT"));
  const configuredDatabaseUrls = RUNTIME_DATABASE_URL_ENV_NAMES.map((key) =>
    environment[key]?.trim(),
  ).filter((value): value is string => Boolean(value));
  if (configuredDatabaseUrls.length === 0)
    throw new Error("Local ritual storage is not configured");
  for (const value of configuredDatabaseUrls)
    loopbackDatabaseUrl(value, development);
}

/** Reads only Loom's canonical S3 variables; no ambient AWS fallback. */
export function readRitualStorageConfig(
  environment: RuntimeEnvironment,
): RitualStorageConfig {
  if (
    required(environment, "FILES_S3_REGION") !== "auto" ||
    required(environment, "FILES_S3_FORCE_PATH_STYLE") !== "true"
  )
    throw new Error("Ritual storage is not configured");
  const shared = {
    endpoint: required(environment, "FILES_S3_ENDPOINT"),
    bucket: required(environment, "FILES_S3_BUCKET"),
    credentials: {
      accessKeyId: required(environment, "FILES_S3_ACCESS_KEY_ID"),
      secretAccessKey: required(environment, "FILES_S3_SECRET_ACCESS_KEY"),
    },
    stagingPrefix: "ritual-staging",
    canonicalPrefix: "ritual-files",
  };
  const provider = required(environment, "FILES_STORAGE_PROVIDER");
  if (provider === "cloudflare-r2")
    return validateR2RitualStorageConfig({ kind: "r2", ...shared });
  if (provider === "minio") {
    assertLocalRitualStorageBoundary(environment);
    return validateMinioRitualStorageConfig({ kind: "minio", ...shared });
  }
  throw new Error("Ritual storage is not configured");
}
