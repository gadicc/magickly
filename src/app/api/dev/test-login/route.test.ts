import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class FixtureSetupError extends Error {}
  return {
    FixtureSetupError,
    hash: vi.fn(async () => "hashed-password"),
    provision: vi.fn(async () => {}),
    signIn: vi.fn(async () => new Response(null, { status: 200 })),
  };
});

vi.stubEnv("NODE_ENV", "development");
vi.stubEnv("LOOM_LOCAL_TEST_LOGIN", "1");
vi.stubEnv("VERCEL", "");
vi.stubEnv("VERCEL_ENV", "");

vi.mock("@/auth/localTestLogin", () => ({
  MAGICKLI_LOCAL_TEST_FIXTURE_SETUP_REQUIRED:
    "LOCAL_TEST_FIXTURE_SETUP_REQUIRED",
  MAGICKLI_LOCAL_TEST_IDENTITIES: {
    creator: {
      defaultCallbackURL: "/temples",
      email: "creator@local-acceptance.test",
      id: "019a0000-0000-7000-8000-000000000001",
      name: "Synthetic Creator",
      role: "creator",
    },
    reader: {
      defaultCallbackURL: "/study",
      email: "reader@local-acceptance.test",
      id: "019a0000-0000-7000-8000-000000000002",
      name: "Synthetic Reader",
      role: "reader",
    },
    admin: {
      defaultCallbackURL: "/admin",
      email: "admin@local-acceptance.test",
      id: "019a0000-0000-7000-8000-000000000003",
      name: "Synthetic Global Admin",
      role: "admin",
    },
  },
  MagickliLocalTestFixtureSetupError: mocks.FixtureSetupError,
  provisionMagickliLocalTestIdentity: mocks.provision,
}));
vi.mock("@/auth/runtime", () => ({
  sqlAuth: {
    $context: Promise.resolve({ password: { hash: mocks.hash } }),
    handler: mocks.signIn,
  },
}));

const route = await import("./route");

function request(method: "GET" | "POST" = "POST", identity = "creator") {
  return new Request("http://127.0.0.1:3116/api/dev/test-login", {
    body:
      method === "POST"
        ? new URLSearchParams({ identity, callbackURL: "/admin" })
        : undefined,
    headers: {
      host: "127.0.0.1:3116",
      origin: "http://127.0.0.1:3116",
      ...(method === "POST"
        ? { "content-type": "application/x-www-form-urlencoded" }
        : {}),
    },
    method,
  });
}

afterAll(() => vi.unstubAllEnvs());
beforeEach(() => vi.clearAllMocks());

describe("Magickli local developer login route", () => {
  it.each(["creator", "reader"])(
    "allows a seeded %s in ordinary development",
    async (identity) => {
      const response = await route.POST(request("POST", identity));
      expect(response.status).toBe(303);
      expect(mocks.provision).toHaveBeenCalledOnce();
      expect(mocks.signIn).toHaveBeenCalledOnce();
    },
  );

  it("rejects the acceptance admin identity in ordinary development", async () => {
    const response = await route.POST(request("POST", "admin"));
    expect(response.status).toBe(400);
    expect(mocks.provision).not.toHaveBeenCalled();
  });

  it("keeps unsupported GET probes hidden before hashing or provisioning", async () => {
    const response = await route.GET(request("GET"));
    expect(response.status).toBe(404);
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("returns an explicit setup response for an unseeded fixture", async () => {
    mocks.provision.mockRejectedValueOnce(new mocks.FixtureSetupError());
    const response = await route.POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "LOCAL_TEST_FIXTURE_SETUP_REQUIRED",
      message: "Run pnpm local-development:seed before local developer login.",
    });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("preserves the acceptance seed hint in an acceptance run", async () => {
    const previous = process.env.MAGICKLI_LOCAL_ACCEPTANCE;
    process.env.MAGICKLI_LOCAL_ACCEPTANCE = "1";
    try {
      mocks.provision.mockRejectedValueOnce(new mocks.FixtureSetupError());
      const response = await route.POST(request("POST", "admin"));
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        message: "Run pnpm local-acceptance:seed before local developer login.",
      });
    } finally {
      if (previous === undefined) delete process.env.MAGICKLI_LOCAL_ACCEPTANCE;
      else process.env.MAGICKLI_LOCAL_ACCEPTANCE = previous;
    }
  });
});
