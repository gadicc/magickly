import { expect, it, vi } from "vitest";
import {
  RESEARCH_LOCAL_DEPLOYMENT_ERROR,
  readResearchLocalDeployment,
} from "./localDeployment";

vi.mock("server-only", () => ({}));
const deploymentEnv = () => ({
  MAGICKLI_PRIVATE_RESEARCH_LOCAL: "1",
  NODE_ENV: "production",
  BETTER_AUTH_URL: "http://localhost:4179",
  MAGICKLI_RESEARCH_STARTUP_SHA256: "a".repeat(64),
  MAGICKLI_RESEARCH_RUNTIME_SHA256: "b".repeat(64),
  MAGICKLI_RESEARCH_ENDPOINT_SHA256: "c".repeat(64),
});
it("is disabled without the exact opt-in and does not inspect unrelated secrets", () => {
  const env = new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === "MAGICKLI_PRIVATE_RESEARCH_LOCAL") return undefined;
        throw Error("Must not read secrets");
      },
    },
  );
  expect(readResearchLocalDeployment(env)).toBeNull();
  expect(
    readResearchLocalDeployment({ MAGICKLI_PRIVATE_RESEARCH_LOCAL: "true" }),
  ).toBeNull();
});
it("owns valid exact local nonsecret facts", () => {
  const env = deploymentEnv(),
    p = readResearchLocalDeployment(env);
  env.BETTER_AUTH_URL = "http://elsewhere";
  expect(p).toEqual({
    origin: "http://localhost:4179",
    startupSha256: "a".repeat(64),
    runtimeRevision: "b".repeat(64),
    authorityEndpointIdentity: "c".repeat(64),
  });
  expect(Object.isFrozen(p)).toBe(true);
});
it.each([
  ["NODE_ENV", "development"],
  ["CI", "0"],
  ["VERCEL", "1"],
  ["VERCEL_ENV", "production"],
  ["VERCEL_URL", "example.test"],
  ["VERCEL_REGION", "local"],
  ["BETTER_AUTH_URL", "https://example.test"],
  ["BETTER_AUTH_URL", "http://localhost:4179/path"],
  ["BETTER_AUTH_URL", "https://localhost:4179"],
  ["BETTER_AUTH_URL", "http://user:pass@localhost:4179"],
  ["MAGICKLI_RESEARCH_STARTUP_SHA256", "missing"],
  ["MAGICKLI_RESEARCH_RUNTIME_SHA256", "a".repeat(64) + "\n"],
  ["MAGICKLI_RESEARCH_ENDPOINT_SHA256", undefined],
])("refuses invalid local runtime %s", (key, value) => {
  expect(() =>
    readResearchLocalDeployment({ ...deploymentEnv(), [key]: value }),
  ).toThrow(RESEARCH_LOCAL_DEPLOYMENT_ERROR);
});
it.each(["http://127.0.0.1:4179", "http://[::1]:4179"])(
  "permits explicit loopback origin %s",
  (origin) => {
    expect(
      readResearchLocalDeployment({
        ...deploymentEnv(),
        BETTER_AUTH_URL: origin,
      })!.origin,
    ).toBe(origin);
  },
);
