import { describe, expect, it, vi } from "vitest";
import {
  readLegacyPublicR2Config,
  readLegacyPublicR2StorageConfigs,
  readLegacyRelocationR2Config,
} from "./legacyPublicR2";
import { readRitualUploadStorageConfig } from "./ritualUploadRuntime";

vi.mock("server-only", () => ({}));
vi.mock("../auth/session", () => ({
  getCurrentSqlUserId: vi.fn(async () => null),
}));
vi.mock("../db/neonFull", () => ({ db: {} }));

const endpoint =
  "https://00000000000000000000000000000000.r2.cloudflarestorage.com";
const localDatabase =
  "postgresql://local:synthetic@127.0.0.1:5432/magickli_acceptance_20260914";
const minio = {
  NODE_ENV: "production",
  BETTER_AUTH_URL: "http://127.0.0.1:3115",
  DATABASE_URL: localDatabase,
  FILES_STORAGE_PROVIDER: "minio",
  FILES_S3_REGION: "auto",
  FILES_S3_FORCE_PATH_STYLE: "true",
  FILES_S3_ENDPOINT: "http://127.0.0.1:9125",
  FILES_S3_BUCKET: "magickli-local-acceptance",
  FILES_S3_ACCESS_KEY_ID: "LOCALONLY",
  FILES_S3_SECRET_ACCESS_KEY: "synthetic-only",
};
const development = {
  ...minio,
  NODE_ENV: "development",
  MAGICKLI_LOCAL_ACCEPTANCE: undefined,
  BETTER_AUTH_URL: "http://localhost:3004",
  FILES_S3_ENDPOINT: "http://127.0.0.1:9000",
  FILES_S3_BUCKET: "magickly-dev",
};

describe("file runtime configuration", () => {
  it("maps Loom's explicit Cloudflare provider configuration to the closed R2 adapter", () => {
    expect(
      readRitualUploadStorageConfig({
        FILES_STORAGE_PROVIDER: "cloudflare-r2",
        FILES_S3_REGION: "auto",
        FILES_S3_FORCE_PATH_STYLE: "true",
        FILES_S3_ENDPOINT: endpoint,
        FILES_S3_BUCKET: "private-ritual-files",
        FILES_S3_ACCESS_KEY_ID: "EXAMPLE",
        FILES_S3_SECRET_ACCESS_KEY: "synthetic-only",
      }),
    ).toEqual({
      kind: "r2",
      endpoint,
      bucket: "private-ritual-files",
      credentials: {
        accessKeyId: "EXAMPLE",
        secretAccessKey: "synthetic-only",
      },
      stagingPrefix: "ritual-staging",
      canonicalPrefix: "ritual-files",
    });
  });

  it.each([
    { FILES_STORAGE_PROVIDER: "r2" },
    { FILES_S3_REGION: "weur" },
    { FILES_S3_FORCE_PATH_STYLE: "false" },
  ])("rejects incompatible private provider settings", (override) => {
    expect(() =>
      readRitualUploadStorageConfig({
        FILES_STORAGE_PROVIDER: "cloudflare-r2",
        FILES_S3_REGION: "auto",
        FILES_S3_FORCE_PATH_STYLE: "true",
        FILES_S3_ENDPOINT: endpoint,
        FILES_S3_BUCKET: "private-ritual-files",
        FILES_S3_ACCESS_KEY_ID: "EXAMPLE",
        FILES_S3_SECRET_ACCESS_KEY: "synthetic-only",
        ...override,
      }),
    ).toThrow("not configured");
  });

  it("maps loopback production-build storage to MinIO without an extra flag", () => {
    expect(readRitualUploadStorageConfig(minio)).toEqual({
      kind: "minio",
      endpoint: "http://127.0.0.1:9125",
      bucket: "magickli-local-acceptance",
      credentials: {
        accessKeyId: "LOCALONLY",
        secretAccessKey: "synthetic-only",
      },
      stagingPrefix: "ritual-staging",
      canonicalPrefix: "ritual-files",
    });
  });

  it("uses local MinIO in ordinary development without the acceptance flag", () => {
    expect(readRitualUploadStorageConfig(development)).toMatchObject({
      kind: "minio",
      endpoint: "http://127.0.0.1:9000",
      bucket: "magickly-dev",
    });
  });

  it.each([
    { NODE_ENV: "production" },
    { MAGICKLI_LOCAL_ACCEPTANCE: "0" },
    { VERCEL: "1" },
    { VERCEL_ENV: "development" },
    { BETTER_AUTH_URL: "http://localhost.evil.test:3004" },
    { BETTER_AUTH_URL: "https://localhost:3004" },
    { FILES_S3_ENDPOINT: "http://172.17.0.1:9000" },
    { DATABASE_URL: "postgresql://local:pass@remote.example:5432/local" },
  ])("rejects unsafe ordinary development storage %#", (override) => {
    expect(() =>
      readRitualUploadStorageConfig({ ...development, ...override }),
    ).toThrow("not configured");
  });

  it.each([
    { VERCEL: "1" },
    { VERCEL_ENV: "development" },
    { BETTER_AUTH_URL: "http://localhost:3115" },
    { BETTER_AUTH_URL: "http://127.0.0.1.evil.test:3115" },
    { FILES_S3_ENDPOINT: "http://2130706433:9125" },
    { FILES_S3_ENDPOINT: "http://127.0.0.1:9125/bucket" },
    { FILES_S3_ENDPOINT: "http://user@127.0.0.1:9125" },
    { DATABASE_URL: "postgresql://local:pass@localhost:5432/local" },
    { DATABASE_URL: "postgresql://local:pass@127.0.0.1.evil:5432/local" },
    {
      DATABASE_URL:
        "postgresql://local:pass@127.0.0.1:5432/local?host=remote.example",
    },
    { DATABASE_URL: "postgresql://local:pass@127.0.0.1:5432/local#remote" },
    { DATABASE_URL_DIRECT: "postgresql://remote.example:5432/local" },
    { DATABASE_URL_UNPOOLED: "postgresql://remote.example:5432/local" },
    { POSTGRES_URL_NON_POOLING: "postgresql://remote.example:5432/local" },
  ])("rejects local storage boundary substitution %#", (override) => {
    expect(() =>
      readRitualUploadStorageConfig({ ...minio, ...override }),
    ).toThrow("not configured");
  });

  it("keeps old AWS variables inside the legacy reader and normalizes only its known bucket endpoint", () => {
    expect(
      readLegacyPublicR2Config({
        AWS_S3_ENDPOINT_URL: `${endpoint}/legacy-bucket`,
        AWS_S3_DEFAULT_BUCKET: "legacy-bucket",
        AWS_REGION_APP: "weur",
        AWS_ACCESS_KEY_ID_APP: "LEGACYEXAMPLE",
        AWS_SECRET_ACCESS_KEY_APP: "legacy-synthetic-only",
        AWS_ACCESS_KEY_ID: "ambient",
        AWS_SECRET_ACCESS_KEY: "ambient",
      }),
    ).toEqual({
      kind: "r2",
      endpoint,
      region: "weur",
      bucket: "legacy-bucket",
      credentials: {
        accessKeyId: "LEGACYEXAMPLE",
        secretAccessKey: "legacy-synthetic-only",
      },
    });
    expect(() =>
      readLegacyPublicR2Config({
        AWS_S3_ENDPOINT_URL: `${endpoint}/another-bucket`,
        AWS_S3_DEFAULT_BUCKET: "legacy-bucket",
        AWS_REGION_APP: "weur",
        AWS_ACCESS_KEY_ID_APP: "LEGACYEXAMPLE",
        AWS_SECRET_ACCESS_KEY_APP: "legacy-synthetic-only",
      }),
    ).toThrow("not configured");
  });

  it("accepts the canonical private credentials only for the fixed relocation bucket", () => {
    const relocated = {
      FILES_STORAGE_PROVIDER: "cloudflare-r2",
      FILES_S3_REGION: "auto",
      FILES_S3_FORCE_PATH_STYLE: "true",
      FILES_S3_ENDPOINT: endpoint,
      FILES_S3_BUCKET: "magickli-files-production",
      FILES_S3_ACCESS_KEY_ID: "NEWEXAMPLE",
      FILES_S3_SECRET_ACCESS_KEY: "new-synthetic-only",
    };
    expect(readLegacyRelocationR2Config(relocated)).toEqual({
      kind: "r2",
      endpoint,
      region: "auto",
      bucket: "magickli-files-production",
      credentials: {
        accessKeyId: "NEWEXAMPLE",
        secretAccessKey: "new-synthetic-only",
      },
    });
    expect(readLegacyPublicR2StorageConfigs(relocated)).toHaveLength(1);
    expect(
      readLegacyRelocationR2Config({
        ...relocated,
        FILES_S3_BUCKET: "magickli-files-preview",
      }),
    ).toBeNull();
    expect(() =>
      readLegacyRelocationR2Config({
        ...relocated,
        FILES_S3_ACCESS_KEY_ID: "",
      }),
    ).toThrow("not configured");
  });
});
