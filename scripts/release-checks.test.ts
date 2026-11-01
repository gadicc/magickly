import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  checkBuiltCrons,
  createReleaseChecks,
  EXPECTED_CRONS,
} from "./release-checks.mjs";

const env = {
  VERCEL_PROJECT_ID: "project",
  VERCEL_ORG_ID: "team",
  VERCEL_TOKEN: "test-api-only",
  DEPLOYMENT_URL: "https://staged-example.vercel.app",
  ACTIONS_ID_TOKEN_REQUEST_URL: "https://identity.example/token?run=1",
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: "test-request-only",
};
const project = { id: "project", accountId: "team" };
const deployment = {
  id: "deployment",
  projectId: "project",
  url: "staged-example.vercel.app",
  target: "production",
  readyState: "READY",
};
const completed = {
  ...project,
  targets: { production: { id: "deployment" } },
  lastAliasRequest: {
    toDeploymentId: "deployment",
    jobStatus: "succeeded",
    requestedAt: 1,
    type: "promote",
  },
};
const healthy = { ready: true, verified: true };
const alias = {
  alias: "magick.ly",
  projectId: "project",
  deploymentId: "deployment",
};
function harness(replies: Array<unknown | Response>, overrides = {}) {
  const calls: Array<[string, RequestInit]> = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    if (!replies.length) throw new Error("Unexpected request");
    const next = replies.shift();
    return next instanceof Response ? next : Response.json(next);
  });
  let time = 0;
  const checks = createReleaseChecks(
    { ...env, ...overrides },
    {
      fetch: fetcher,
      now: () => time,
      wait: async () => {
        time += 60_000;
      },
    },
  );
  return { checks, calls };
}

describe("production release state checks", () => {
  it("rejects old unresolved promotions without the CLI's age cutoff", async () => {
    const { checks, calls } = harness([
      {
        ...project,
        lastAliasRequest: {
          ...completed.lastAliasRequest,
          jobStatus: "pending",
          requestedAt: 1,
        },
      },
    ]);
    await expect(checks.preflight()).rejects.toThrow(
      "previous alias change remains unresolved",
    );
    expect(calls[0][0]).toBe(
      "https://api.vercel.com/v9/projects/project?rollbackInfo=true&teamId=team",
    );
  });
  it("accepts settled previous promotions but refuses rolling release configuration", async () => {
    await expect(
      harness([completed]).checks.preflight(),
    ).resolves.toBeUndefined();
    await expect(
      harness([{ ...project, rollingRelease: {} }]).checks.preflight(),
    ).rejects.toThrow("rolling release");
  });
  it("uses a short-lived identity only for the verified staged deployment", async () => {
    const { checks, calls } = harness([
      deployment,
      { value: "short-lived-token" },
      new Response("home"),
      new Response("null"),
      healthy,
    ]);
    await checks.staged();
    expect(calls).toHaveLength(5);
    expect(calls[1][0]).toContain("audience=https%3A%2F%2Fgithub.com%2Fgadicc");
    expect(
      calls
        .slice(2)
        .map(([url, options]) => [url, options.headers, options.redirect]),
    ).toEqual([
      [
        "https://staged-example.vercel.app/",
        { "x-vercel-trusted-oidc-idp-token": "short-lived-token" },
        "manual",
      ],
      [
        "https://staged-example.vercel.app/api/auth/get-session",
        { "x-vercel-trusted-oidc-idp-token": "short-lived-token" },
        "manual",
      ],
      [
        "https://staged-example.vercel.app/api/health/secrets",
        { "x-vercel-trusted-oidc-idp-token": "short-lived-token" },
        "manual",
      ],
    ]);
    expect(
      calls.every(([, options]) => !options.method || options.method === "GET"),
    ).toBe(true);
  });
  it.each([
    { projectId: "other-project" },
    { target: "preview" },
    { readyState: "BUILDING" },
  ])(
    "refuses a mismatched staged deployment before issuing an identity",
    async (change) => {
      const { checks, calls } = harness([{ ...deployment, ...change }]);
      await expect(checks.staged()).rejects.toThrow("mismatch");
      expect(calls).toHaveLength(1);
    },
  );
  it.each([
    "https://attacker.example",
    "https://user:pass@staged-example.vercel.app",
    "https://staged-example.vercel.app/other",
  ])("never sends credentials to an invalid deployment URL", async (url) => {
    const { checks, calls } = harness([], { DEPLOYMENT_URL: url });
    await expect(checks.staged()).rejects.toThrow("Invalid staged");
    expect(calls).toHaveLength(0);
  });
  it.each([
    new Response(null, {
      status: 302,
      headers: { location: "https://example.com/login" },
    }),
    new Response("<html>login</html>"),
    new Response("{}"),
    new Response("x".repeat(65)),
  ])(
    "rejects redirects, login pages, and invalid session bodies",
    async (auth) => {
      const { checks } = harness([
        deployment,
        { value: "short-lived-token" },
        new Response("home"),
        auth,
      ]);
      await expect(checks.staged()).rejects.toThrow();
    },
  );
  it.each([
    [new Response('{"ready":false}', { status: 503 }), "HTTP 503"],
    [Response.json({ ready: true, verified: false }), "not verified"],
    [Response.json({ ready: false, verified: true }), "not verified"],
    [Response.json({ ready: true }), "not verified"],
    [Response.json({ ready: "true", verified: 1 }), "not verified"],
    [new Response("null"), "not verified"],
    [new Response("<html>login</html>"), /JSON/],
    [
      new Response(`{"ready":true,"verified":true,"x":"${"x".repeat(40)}"}`),
      "Unexpected secrets health response",
    ],
    [new Response(null), "Missing secrets health response"],
  ])(
    "refuses a deployment whose secrets keys are not the recorded ones",
    async (health, message) => {
      const { checks } = harness([
        deployment,
        { value: "short-lived-token" },
        new Response("home"),
        new Response("null"),
        health,
      ]);
      await expect(checks.staged()).rejects.toThrow(message);
    },
  );
  it("waits for an uncertain promotion, checks the exact alias, and smokes without identity", async () => {
    const { checks, calls } = harness([
      deployment,
      {
        ...project,
        lastAliasRequest: {
          ...completed.lastAliasRequest,
          jobStatus: "pending",
        },
      },
      completed,
      alias,
      new Response("home"),
      new Response("null"),
      healthy,
      alias,
      completed,
    ]);
    await checks.promoted();
    expect(
      calls
        .filter(([url]) => url.includes("/v9/projects/"))
        .map(([url]) => url),
    ).toEqual(
      Array.from(
        { length: 3 },
        () =>
          "https://api.vercel.com/v9/projects/project?rollbackInfo=true&teamId=team",
      ),
    );
    expect(
      calls
        .filter(([url]) => url.startsWith("https://magick.ly/"))
        .map(([url, options]) => [url, options.headers]),
    ).toEqual([
      ["https://magick.ly/", {}],
      ["https://magick.ly/api/auth/get-session", {}],
      ["https://magick.ly/api/health/secrets", {}],
    ]);
  });
  it("smokes but still fails a partial promotion or wrong live alias", async () => {
    const { checks, calls } = harness([
      deployment,
      {
        ...completed,
        lastAliasRequest: {
          ...completed.lastAliasRequest,
          jobStatus: "failed",
        },
      },
      { ...alias, deploymentId: "other" },
      new Response("home"),
      new Response("null"),
      healthy,
      alias,
      {
        ...completed,
        lastAliasRequest: {
          ...completed.lastAliasRequest,
          jobStatus: "failed",
        },
      },
    ]);
    await expect(checks.promoted()).rejects.toThrow(
      "without all expected aliases",
    );
    expect(
      calls.some(([url]) => url === "https://magick.ly/api/auth/get-session"),
    ).toBe(true);
  });
  it("cannot mistake another deployment's success for the intended promotion", async () => {
    const { checks } = harness([
      deployment,
      ...Array.from({ length: 6 }, () => ({
        ...completed,
        lastAliasRequest: {
          ...completed.lastAliasRequest,
          toDeploymentId: "other",
          jobStatus: "succeeded",
        },
      })),
    ]);
    await expect(checks.promoted()).rejects.toThrow("outcome is uncertain");
  });
  it.each([
    {},
    { jobStatus: "succeeded" },
    { ...completed.lastAliasRequest, jobStatus: "mystery" },
  ])("fails closed on malformed promotion state", async (job) => {
    await expect(
      harness([{ ...project, lastAliasRequest: job }]).checks.preflight(),
    ).rejects.toThrow("unresolved");
  });
  it("rejects a new promotion started while the smoke check was running", async () => {
    const { checks } = harness([
      deployment,
      completed,
      alias,
      new Response("home"),
      new Response("null"),
      healthy,
      alias,
      {
        ...completed,
        lastAliasRequest: {
          ...completed.lastAliasRequest,
          requestedAt: 2,
          jobStatus: "pending",
        },
      },
    ]);
    await expect(checks.promoted()).rejects.toThrow(
      "changed during verification",
    );
  });
  it.each([
    { projectId: "other" },
    { alias: "other.example" },
    { deploymentId: "other" },
  ])("rejects a final alias identity mismatch", async (change) => {
    const { checks } = harness([
      deployment,
      completed,
      alias,
      new Response("home"),
      new Response("null"),
      healthy,
      { ...alias, ...change },
      completed,
    ]);
    await expect(checks.promoted()).rejects.toThrow(
      "without all expected aliases",
    );
  });

  it("detects a promotion that begins during the final alias read", async () => {
    let aliasReads = 0;
    let overlapping = false;
    const checks = createReleaseChecks(env, {
      fetch: async (url: string) => {
        if (url.includes("/v13/deployments/")) return Response.json(deployment);
        if (url.includes("/v4/aliases/")) {
          if (++aliasReads === 2) overlapping = true;
          return Response.json(alias);
        }
        if (url.includes("/v9/projects/"))
          return Response.json(
            overlapping
              ? {
                  ...completed,
                  lastAliasRequest: {
                    ...completed.lastAliasRequest,
                    requestedAt: 2,
                    jobStatus: "pending",
                  },
                }
              : completed,
          );
        if (url === "https://magick.ly/") return new Response("home");
        if (url === "https://magick.ly/api/auth/get-session")
          return new Response("null");
        if (url === "https://magick.ly/api/health/secrets")
          return Response.json(healthy);
        throw new Error("Unexpected request");
      },
    });
    await expect(checks.promoted()).rejects.toThrow(
      "changed during verification",
    );
  });
});

describe("the build's crons", () => {
  const directory = mkdtempSync(join(tmpdir(), "magickli-release-crons-"));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));
  const config = (value: unknown) => {
    const file = join(directory, `config-${Math.random()}.json`);
    writeFileSync(file, JSON.stringify(value));
    return file;
  };
  const cron = EXPECTED_CRONS[0];

  it("matches vercel.json", () => {
    const vercel = JSON.parse(
      readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
    );
    expect(vercel.crons).toEqual(EXPECTED_CRONS);
  });

  it("accepts the right entry", () => {
    expect(checkBuiltCrons(config({ version: 3, crons: [cron] }))).toEqual([
      cron,
    ]);
  });

  it("fails on a missing file or a missing crons list", () => {
    expect(() => checkBuiltCrons(join(directory, "absent.json"))).toThrow(
      "missing or unreadable",
    );
    expect(() => checkBuiltCrons(config({ version: 3 }))).toThrow(
      "crons are null",
    );
  });

  it("fails on a wrong path, schedule or extra entry", () => {
    for (const crons of [
      [{ ...cron, path: "/api/cron/other" }],
      [{ ...cron, schedule: "0 3 * * *" }],
      [cron, cron],
      [],
    ])
      expect(() => checkBuiltCrons(config({ crons }))).toThrow("expected");
  });
});
