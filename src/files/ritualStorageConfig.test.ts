import { describe, expect, it, vi } from "vitest";
import { assertLocalRitualStorageBoundary } from "./ritualStorageConfig";

vi.mock("server-only", () => ({}));

const development = {
  NODE_ENV: "development",
  BETTER_AUTH_URL: "http://localhost:3004",
  FILES_S3_ENDPOINT: "http://127.0.0.1:9000",
  DATABASE_URL:
    "postgresql://magickli_dev:synthetic@db.localtest.me:5432/magickli_dev?sslmode=disable",
};

describe("local ritual storage database boundary", () => {
  it("allows the shared machine database endpoint in ordinary development", () => {
    expect(() => assertLocalRitualStorageBoundary(development)).not.toThrow();
  });

  it("keeps acceptance restricted to numeric loopback without a query", () => {
    const acceptance = {
      ...development,
      NODE_ENV: "production",
      MAGICKLI_LOCAL_ACCEPTANCE: "1",
      BETTER_AUTH_URL: "http://127.0.0.1:3115",
    };
    expect(() => assertLocalRitualStorageBoundary(acceptance)).toThrow();
    expect(() =>
      assertLocalRitualStorageBoundary({
        ...acceptance,
        DATABASE_URL:
          "postgresql://acceptance:synthetic@127.0.0.1:5432/acceptance",
      }),
    ).not.toThrow();
  });
});
