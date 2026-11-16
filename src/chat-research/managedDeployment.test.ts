import { expect, it, vi } from "vitest";
import {
  prepareResearchManagedDeployment,
  readResearchManagedDeployment,
} from "./managedDeployment";
import {
  managedDeploymentEnvironment,
  managedDeploymentFixture,
} from "./managedDeployment.fixture";

vi.mock("server-only", () => ({}));
it("stays disabled before reading private or descriptor settings", () => {
  const env = {
    get MAGICKLI_MANAGED_DEPLOYMENT_JSON(): string {
      throw Error("Must not read");
    },
  };
  expect(readResearchManagedDeployment(env)).toBeNull();
});
it.each(["preview", "production"])(
  "accepts an independently adopted HTTPS %s descriptor",
  (VERCEL_ENV) => {
    expect(
      readResearchManagedDeployment({
        ...managedDeploymentEnvironment(),
        VERCEL_ENV,
      }),
    ).toEqual(managedDeploymentFixture());
  },
);
it.each([
  { NODE_ENV: "development" },
  { VERCEL: undefined },
  { VERCEL_ENV: "development" },
  { VERCEL_REGION: "iad1" },
  { MAGICKLI_PRIVATE_RESEARCH_LOCAL: "1" },
  { MAGICKLI_PRIVATE_RESEARCH_OPERATOR: "1" },
  { BETTER_AUTH_URL: "https://other.example" },
  { MAGICKLI_MANAGED_DEPLOYMENT_JSON: undefined },
  { MAGICKLI_MANAGED_DEPLOYMENT_JSON: "{" },
  { MAGICKLI_MANAGED_DEPLOYMENT_JSON: " ".repeat(8193) },
])("refuses conflicting/platform/descriptor drift %j", (delta) => {
  expect(() =>
    readResearchManagedDeployment({
      ...managedDeploymentEnvironment(),
      ...delta,
    }),
  ).toThrow(/^Private managed research unavailable$/);
});
it.each([
  { origin: "http://localhost:3000" },
  { origin: "https://research.example.test/" },
  { runtimeRoleOid: 702 },
  { operatorId: "some-email@example.test" },
  { privateConfigSha256: "bad" },
])("refuses invalid adopted bindings %j", (delta) => {
  const d = { ...managedDeploymentFixture(), ...delta };
  expect(() =>
    readResearchManagedDeployment({
      ...managedDeploymentEnvironment(),
      BETTER_AUTH_URL: d.origin,
      MAGICKLI_MANAGED_DEPLOYMENT_JSON: JSON.stringify(d),
    }),
  ).toThrow();
});
it("canonicalizes only known descriptor fields across UI augmentation/key order", () => {
  const d = managedDeploymentFixture(),
    ui = {
      mode: "managed",
      ...Object.fromEntries(Object.entries(d).reverse()),
    };
  expect(prepareResearchManagedDeployment(ui as unknown as typeof d)).toEqual(
    d,
  );
  expect(
    JSON.stringify(prepareResearchManagedDeployment(ui as unknown as typeof d)),
  ).toBe(JSON.stringify(prepareResearchManagedDeployment(d)));
});

it.each([
  { origin: "http://localhost" },
  { origin: "https://research.example.test/" },
  { runtimeRoleOid: 702 },
])(
  "canonical projection also enforces hosted-only semantics on direct callers %j",
  (delta) => {
    expect(() =>
      prepareResearchManagedDeployment({
        ...managedDeploymentFixture(),
        ...delta,
      }),
    ).toThrow();
  },
);
