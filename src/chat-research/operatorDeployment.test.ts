import { expect, it, vi } from "vitest";
import {
  RESEARCH_OPERATOR_DEPLOYMENT_ERROR,
  readResearchOperatorDeployment,
} from "./operatorDeployment";
import { readResearchWebDeployment } from "./webDeployment";

vi.mock("server-only", () => ({}));
const env = () => ({
  NODE_ENV: "production",
  BETTER_AUTH_URL: "http://localhost:4179",
  MAGICKLI_PRIVATE_RESEARCH_OPERATOR: "1",
  MAGICKLI_OPERATOR_STARTUP_SHA256: "a".repeat(64),
  MAGICKLI_OPERATOR_RUNTIME_SHA256: "b".repeat(64),
  MAGICKLI_OPERATOR_ENDPOINT_SHA256: "c".repeat(64),
});
it("does not inspect any other settings or secrets without exact new-purpose opt-in", () => {
  expect(
    readResearchOperatorDeployment(
      new Proxy(
        {},
        {
          get: (_t, k) => {
            if (k === "MAGICKLI_PRIVATE_RESEARCH_OPERATOR") return undefined;
            throw Error("Unexpected read");
          },
        },
      ),
    ),
  ).toBeNull();
  expect(
    readResearchOperatorDeployment({
      MAGICKLI_PRIVATE_RESEARCH_OPERATOR: "true",
    }),
  ).toBeNull();
  expect(readResearchWebDeployment({})).toBeNull();
});
it("selects new-purpose owner-local deployment and immutable independently adopted pins", () => {
  const deployment = readResearchOperatorDeployment(env());
  expect(deployment).toEqual({
    origin: "http://localhost:4179",
    startupSha256: "a".repeat(64),
    runtimeRevision: "b".repeat(64),
    authorityEndpointIdentity: "c".repeat(64),
  });
  expect(Object.isFrozen(deployment)).toBe(true);
  expect(readResearchWebDeployment(env())).toEqual({
    mode: "operator",
    ...deployment,
  });
});
it("keeps original reader pins and purpose separate", () => {
  const old = {
    NODE_ENV: "production",
    BETTER_AUTH_URL: "http://localhost:4179",
    MAGICKLI_PRIVATE_RESEARCH_LOCAL: "1",
    MAGICKLI_RESEARCH_STARTUP_SHA256: "d".repeat(64),
    MAGICKLI_RESEARCH_RUNTIME_SHA256: "e".repeat(64),
    MAGICKLI_RESEARCH_ENDPOINT_SHA256: "f".repeat(64),
  };
  expect(readResearchOperatorDeployment(old)).toBeNull();
  expect(readResearchWebDeployment(old)?.mode).toBe("reader");
  expect(() =>
    readResearchWebDeployment({
      ...old,
      MAGICKLI_PRIVATE_RESEARCH_OPERATOR: "1",
    }),
  ).toThrow(RESEARCH_OPERATOR_DEPLOYMENT_ERROR);
  expect(() =>
    readResearchOperatorDeployment({
      ...old,
      MAGICKLI_PRIVATE_RESEARCH_OPERATOR: "1",
      MAGICKLI_PRIVATE_RESEARCH_LOCAL: undefined,
    }),
  ).toThrow(RESEARCH_OPERATOR_DEPLOYMENT_ERROR);
});
it.each([
  ["NODE_ENV", "development"],
  ["CI", "0"],
  ["VERCEL", "0"],
  ["VERCEL_ENV", "production"],
  ["VERCEL_URL", "localhost"],
  ["VERCEL_REGION", "local"],
  ["BETTER_AUTH_URL", "https://example.test"],
  ["BETTER_AUTH_URL", "http://user:pass@localhost:4179"],
  ["BETTER_AUTH_URL", "http://localhost:4179/path"],
  ["MAGICKLI_OPERATOR_STARTUP_SHA256", undefined],
  ["MAGICKLI_OPERATOR_RUNTIME_SHA256", "b".repeat(64) + "\n"],
  ["MAGICKLI_OPERATOR_ENDPOINT_SHA256", "../private"],
  ["MAGICKLI_PRIVATE_RESEARCH_LOCAL", "1"],
])("refuses invalid or ambiguous %s", (key, value) => {
  expect(() =>
    readResearchOperatorDeployment({ ...env(), [key!]: value }),
  ).toThrow(RESEARCH_OPERATOR_DEPLOYMENT_ERROR);
});

it("refuses a changing selection rather than substituting another service mode", () => {
  let reads = 0;
  expect(
    readResearchWebDeployment(
      new Proxy(env(), {
        get(target, key: string) {
          if (key === "MAGICKLI_PRIVATE_RESEARCH_OPERATOR")
            return ++reads === 1 ? "1" : undefined;
          return Reflect.get(target, key);
        },
      }),
    ),
  ).toBeNull();
});
