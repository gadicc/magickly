import { describe, expect, it } from "vitest";
import { checkExistingPromotion } from "./existing-promotion.mjs";

const sha = "a".repeat(40);
const env = {
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_REPOSITORY: "gadicc/magickly",
  GITHUB_SHA: sha,
  GITHUB_TOKEN: "github-read-only",
  VERCEL_TOKEN: "vercel-only",
  VERCEL_PROJECT_ID: "project",
  VERCEL_ORG_ID: "team",
  DEPLOYMENT_URL: "https://staged-example.vercel.app",
  EXPECTED_DEPLOYMENT_ID: "dpl_staged",
  EXPECTED_PRODUCTION_DEPLOYMENT_ID: "dpl_live",
  EXPECTED_SOURCE_SHA: sha,
  PROMOTION_EXPIRES_AT_MS: "3700000",
};
const live = {
  id: "dpl_live",
  projectId: "project",
  target: "production",
  readyState: "READY",
  meta: { githubCommitSha: sha },
};
const staged = { ...live, id: "dpl_staged", url: "staged-example.vercel.app" };
const job = {
  toDeploymentId: "dpl_live",
  requestedAt: 1,
  type: "promote",
  jobStatus: "succeeded",
};
const project = {
  id: "project",
  accountId: "team",
  targets: { production: { id: "dpl_live" } },
  lastAliasRequest: job,
};
const alias = {
  alias: "magick.ly",
  projectId: "project",
  deploymentId: "dpl_live",
};
const main = { ref: "refs/heads/main", object: { type: "commit", sha } };
function harness(
  overrides: Record<string, unknown> = {},
  change?: (path: string, count: number) => unknown,
) {
  const calls: Array<[string, RequestInit]> = [];
  const counts = new Map<string, number>();
  let time = 100_000;
  const run = () =>
    checkExistingPromotion(
      { ...env, ...overrides },
      {
        now: () => time,
        fetch: async (url: string, init: RequestInit) => {
          calls.push([url, init]);
          const path = new URL(url).pathname;
          const count = (counts.get(path) ?? 0) + 1;
          counts.set(path, count);
          const modified = change?.(path, count);
          if (modified !== undefined)
            return modified instanceof Response
              ? modified
              : Response.json(modified);
          if (path.endsWith("/git/ref/heads/main")) return Response.json(main);
          if (path === "/v9/projects/project") return Response.json(project);
          if (path === "/v4/aliases/magick.ly") return Response.json(alias);
          if (path === "/v13/deployments/dpl_live") return Response.json(live);
          if (path === "/v13/deployments/dpl_staged")
            return Response.json(staged);
          throw new Error("Unexpected request");
        },
      },
    );
  return {
    run,
    calls,
    setTime: (value: number) => {
      time = value;
    },
  };
}

describe("existing configuration promotion", () => {
  it("requires the same already-live, staged and workflow source without cross-sending credentials", async () => {
    const { run, calls } = harness();
    await expect(run()).resolves.toBeUndefined();
    expect(calls).toHaveLength(8);
    for (const [url, init] of calls) {
      expect(init.redirect).toBe("error");
      expect(init.method ?? "GET").toBe("GET");
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe(
        new URL(url).hostname === "api.github.com"
          ? "Bearer github-read-only"
          : "Bearer vercel-only",
      );
    }
  });
  it.each([
    { GITHUB_EVENT_NAME: "push" },
    { GITHUB_REF: "refs/heads/other" },
    { GITHUB_REPOSITORY: "other/repo" },
    { GITHUB_SHA: "b".repeat(40) },
    { EXPECTED_SOURCE_SHA: "bad" },
    { EXPECTED_DEPLOYMENT_ID: "dpl_live" },
    { EXPECTED_DEPLOYMENT_ID: "other" },
    { DEPLOYMENT_URL: "https://attacker.example" },
    { DEPLOYMENT_URL: "https://secret@staged-example.vercel.app" },
    { DEPLOYMENT_URL: "https://staged-example.vercel.app/other" },
    { PROMOTION_EXPIRES_AT_MS: "100000" },
    { PROMOTION_EXPIRES_AT_MS: "3700001" },
    { PROMOTION_EXPIRES_AT_MS: "NaN" },
  ])("refuses invalid dispatch input before networking: %j", async (change) => {
    const { run, calls } = harness(change);
    await expect(run()).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  it.each([
    { id: "dpl_other" },
    { projectId: "other" },
    { readyState: "BUILDING" },
    { target: "preview" },
    { meta: { githubCommitSha: "b".repeat(40) } },
    { url: "different.vercel.app" },
  ])("refuses a changed staged target: %j", async (change) => {
    const { run } = harness({}, (path) =>
      path.endsWith("/dpl_staged") ? { ...staged, ...change } : undefined,
    );
    await expect(run()).rejects.toThrow();
  });
  it("cannot use configuration promotion to bypass a new migration", async () => {
    const { run } = harness({}, (path) =>
      path.endsWith("/dpl_live")
        ? { ...live, meta: { githubCommitSha: "b".repeat(40) } }
        : undefined,
    );
    await expect(run()).rejects.toThrow("source or deployment mismatch");
  });
  it("refuses current main advancing while metadata is checked", async () => {
    const { run } = harness({}, (path, count) =>
      path.endsWith("/heads/main") && count === 2
        ? { ...main, object: { type: "commit", sha: "b".repeat(40) } }
        : undefined,
    );
    await expect(run()).rejects.toThrow("Main changed");
  });
  it("refuses an alias moving during metadata checks", async () => {
    const { run } = harness({}, (path, count) =>
      path.includes("/aliases/") && count === 2
        ? { ...alias, deploymentId: "dpl_new" }
        : undefined,
    );
    await expect(run()).rejects.toThrow("alias changed");
  });
  it.each([
    { lastAliasRequest: { ...job, jobStatus: "in-progress" } },
    { targets: { production: { id: "dpl_new" } } },
    { accountId: "other" },
    { rollingRelease: {} },
  ])(
    "refuses an unsettled or changed production target: %j",
    async (change) => {
      const { run } = harness({}, (path) =>
        path.includes("/projects/") ? { ...project, ...change } : undefined,
      );
      await expect(run()).rejects.toThrow("baseline changed or is unsettled");
    },
  );
  it("detects even a terminal promotion change during the guard", async () => {
    const { run } = harness({}, (path, count) =>
      path.includes("/projects/") && count === 2
        ? { ...project, lastAliasRequest: { ...job, requestedAt: 2 } }
        : undefined,
    );
    await expect(run()).rejects.toThrow("changed during verification");
  });
  it("does not renew the caller's window after response decoding", async () => {
    const h = harness({}, (path, count) => {
      if (path.endsWith("/heads/main") && count === 2) {
        h.setTime(3_700_000);
        return main;
      }
    });
    await expect(h.run()).rejects.toThrow("invalid or expired");
  });
  it("does not return provider response bodies on failure", async () => {
    const { run } = harness(
      {},
      () => new Response("private-do-not-report", { status: 500 }),
    );
    await expect(run()).rejects.toThrow("Current main source check failed");
  });
});
