import { describe, expect, it } from "vitest";
import {
  LOCAL_DEVELOPMENT_DATABASE,
  LOCAL_DEVELOPMENT_ORIGIN,
  LOCAL_DEVELOPMENT_ROLE,
  readLocalDevelopmentConfig,
} from "./config";

const databaseUrl = `postgresql://${LOCAL_DEVELOPMENT_ROLE}:synthetic-password@db.localtest.me:5432/${LOCAL_DEVELOPMENT_DATABASE}?sslmode=disable`;
const environment = {
  DATABASE_URL_UNPOOLED: databaseUrl,
  DATABASE_URL: databaseUrl,
  BETTER_AUTH_URL: LOCAL_DEVELOPMENT_ORIGIN,
  FILES_STORAGE_PROVIDER: "minio",
  FILES_S3_ENDPOINT: "http://127.0.0.1:9000",
  FILES_S3_BUCKET: "magickly-dev",
  LOOM_LOCAL_TEST_LOGIN: "1",
};

describe("local development database boundary", () => {
  it("accepts matching runtime and migration candidates", () => {
    expect(
      readLocalDevelopmentConfig({
        ...environment,
        DATABASE_URL_DIRECT: databaseUrl,
        POSTGRES_URL_NON_POOLING: databaseUrl,
        MIGRATION_DATABASE_URL_UNPOOLED: databaseUrl,
        MIGRATION_DATABASE_URL: databaseUrl,
      }),
    ).toEqual({ databaseUrl });
  });

  it.each([
    {
      DATABASE_URL:
        "postgresql://other:pass@db.localtest.me:5432/other?sslmode=disable",
    },
    {
      DATABASE_URL_DIRECT:
        "postgresql://other:pass@db.localtest.me:5432/other?sslmode=disable",
    },
    {
      POSTGRES_URL_NON_POOLING:
        "postgresql://other:pass@db.localtest.me:5432/other?sslmode=disable",
    },
    {
      MIGRATION_DATABASE_URL:
        "postgresql://other:pass@db.localtest.me:5432/other?sslmode=disable",
    },
    {
      DATABASE_URL_UNPOOLED:
        "postgresql://other:pass@db.localtest.me:5432/other?sslmode=disable",
    },
    { DATABASE_URL_UNPOOLED: databaseUrl.replace("5432", "5433") },
    {
      DATABASE_URL_UNPOOLED: databaseUrl.replace(
        "db.localtest.me",
        "localhost",
      ),
    },
    {
      DATABASE_URL_UNPOOLED: databaseUrl.replace(
        "?sslmode=disable",
        "?sslmode=require",
      ),
    },
    { BETTER_AUTH_URL: "http://127.0.0.1:3115" },
    { FILES_S3_BUCKET: "magickli-local-acceptance" },
    { MAGICKLI_LOCAL_ACCEPTANCE: "1" },
    { VERCEL_ENV: "development" },
    { NODE_ENV: "production" },
  ])("rejects drift before writes %#", (patch) => {
    expect(() =>
      readLocalDevelopmentConfig({ ...environment, ...patch }),
    ).toThrow(/LOCAL_DEVELOPMENT_/);
  });
});
