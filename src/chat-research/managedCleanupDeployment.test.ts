import { expect, it, vi } from "vitest";
import { readResearchManagedCleanupDeployment as read } from "./managedCleanupDeployment";
import { managedCleanupEntryFixture } from "./managedCleanupEntry.fixture";

vi.mock("server-only", () => ({}));
it("reads no other settings when independently disabled", () => {
  expect(
    read(
      new Proxy(
        {},
        {
          get: (_t, k) => {
            if (k === "MAGICKLI_PRIVATE_RESEARCH_MANAGED_CLEANUP")
              return undefined;
            throw Error("No other setting");
          },
        },
      ),
    ),
  ).toBeNull();
});
it.each(["preview", "production"])(
  "accepts separately adopted %s cleanup while question entry is absent",
  (mode) => {
    const f = managedCleanupEntryFixture();
    expect(read({ ...f.env, VERCEL_ENV: mode })).toEqual(f.deployment);
    expect(Object.isFrozen(read(f.env)?.runtime)).toBe(true);
  },
);
it.each([
  ["NODE_ENV", "development"],
  ["VERCEL", ""],
  ["VERCEL_ENV", "development"],
  ["VERCEL_REGION", "iad1"],
  ["MAGICKLI_PRIVATE_RESEARCH_LOCAL", "1"],
  ["MAGICKLI_PRIVATE_RESEARCH_OPERATOR", "1"],
  ["BETTER_AUTH_URL", "https://wrong.example"],
  ["MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON", undefined],
  ["MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON", "{}"],
  ["MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON", "x".repeat(8193)],
])("refuses unadopted environment %s", (name, value) => {
  expect(() =>
    read({ ...managedCleanupEntryFixture().env, [name]: value }),
  ).toThrow("Private cleanup unavailable");
});
it.each([
  { origin: "http://research.example.test" },
  { origin: "https://research.example.test/path" },
  { roleOid: 0 },
  { roleOid: 4294967296 },
  { profileSha256: "bad" },
  { unexpected: true },
  { runtime: { invalid: true } },
])("refuses invalid descriptor %j", (change) => {
  const f = managedCleanupEntryFixture();
  expect(() =>
    read({
      ...f.env,
      MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON: JSON.stringify({
        ...f.deployment,
        ...change,
      }),
    }),
  ).toThrow();
});
it("does not borrow the older Node22 policy", () => {
  const f = managedCleanupEntryFixture();
  expect(() =>
    read({
      ...f.env,
      MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON: JSON.stringify({
        ...f.deployment,
        runtime: { ...f.deployment.runtime, node_major: 22 },
      }),
    }),
  ).toThrow();
});

it.each(["\n", "\r", "\u2028", "\u2029"])(
  "rejects trailing line terminator in an adopted digest %j",
  (suffix) => {
    const f = managedCleanupEntryFixture();
    expect(() =>
      read({
        ...f.env,
        MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON: JSON.stringify({
          ...f.deployment,
          profileSha256: f.deployment.profileSha256 + suffix,
        }),
      }),
    ).toThrow();
  },
);

it.each(["dedicated-bearer", "vercel-cron"] as const)(
  "accepts explicit scheduler authorization %s without selecting any secret",
  (authorization) => {
    const f = managedCleanupEntryFixture(),
      deployment = { ...f.deployment, authorization };
    expect(
      read({
        ...f.env,
        MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON: JSON.stringify(deployment),
      }),
    ).toEqual(deployment);
  },
);
it.each([null, "automatic", "", ["vercel-cron"]])(
  "refuses an ambiguous or unsupported scheduler authorization %j",
  (authorization) => {
    const f = managedCleanupEntryFixture();
    expect(() =>
      read({
        ...f.env,
        MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON: JSON.stringify({
          ...f.deployment,
          authorization,
        }),
      }),
    ).toThrow("Private cleanup unavailable");
  },
);
