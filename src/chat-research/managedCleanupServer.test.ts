/** Entry/secret ordering only; runner/native lifecycle is independently covered. No real env or socket. */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ResearchManagedCleanupOptions } from "./managedCleanup";
import { managedCleanupEntryFixture } from "./managedCleanupEntry.fixture";
import { RESEARCH_MANAGED_CLEANUP_PATH } from "./managedCleanupHttp";
import {
  createManagedResearchCleanupServer as create,
  handleManagedResearchCleanup,
  parseResearchManagedCleanupConnection as parse,
} from "./managedCleanupServer";

const m = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./managedCleanup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./managedCleanup")>();
  return { ...actual, runResearchManagedCleanup: m.run };
});
beforeEach(() => {
  vi.clearAllMocks();
  m.run.mockResolvedValue({ status: "healthy", reconciled: false });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function request(authorization?: string, signal?: AbortSignal) {
  return new Request(
    "https://research.example.test" + RESEARCH_MANAGED_CLEANUP_PATH,
    {
      headers: {
        host: "research.example.test",
        ...(authorization ? { authorization } : {}),
      },
      signal,
    },
  );
}
it("default app entry and independent disabled factory deny without any secret access", async () => {
  vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_MANAGED_CLEANUP", undefined);
  expect((await handleManagedResearchCleanup(request())).status).toBe(404);
  const env = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === "MAGICKLI_PRIVATE_RESEARCH_MANAGED_CLEANUP") return undefined;
        throw Error("No other setting");
      },
    },
  );
  expect((await create(env)(request())).status).toBe(404);
  expect(m.run).not.toHaveBeenCalled();
});
it("refuses malformed enabled configuration without private values in the response", async () => {
  const f = managedCleanupEntryFixture();
  const r = await create({
    ...f.env,
    MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON: "bad",
  })(request());
  expect(r.status).toBe(503);
  expect(await r.text()).toBe('{"error":"Private cleanup unavailable"}');
});
it.each([undefined, "Bearer " + "b".repeat(64)])(
  "denies offered token %j before private configuration or credentials",
  async (offered) => {
    const f = managedCleanupEntryFixture(),
      env = { ...f.env };
    Object.defineProperty(env, "MAGICKLI_MANAGED_CLEANUP_PRIVATE_JSON", {
      get() {
        throw Error("Private config accessed");
      },
    });
    Object.defineProperty(env, "MAGICKLI_MANAGED_CLEANUP_DATABASE_URL", {
      get() {
        throw Error("URL accessed");
      },
    });
    expect((await create(env)(request(offered))).status).toBe(404);
    expect(m.run).not.toHaveBeenCalled();
  },
);
it("owns target options after token while deferring the URL to the validated runner", async () => {
  const f = managedCleanupEntryFixture(),
    env = { ...f.env },
    read = vi.fn(() => f.url);
  Object.defineProperty(env, "MAGICKLI_MANAGED_CLEANUP_DATABASE_URL", {
    get: read,
  });
  const r = await create(env)(request("Bearer " + f.token));
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toContain("no-store");
  expect(read).not.toHaveBeenCalled();
  const o = m.run.mock.calls[0][0] as ResearchManagedCleanupOptions;
  expect(o.independentlyAdoptedRoleOid).toBe(321);
  expect(o.independentlyAdoptedProfileSha256).toBe(f.deployment.profileSha256);
  expect(o.connection()).toMatchObject({
    role: "magickli_research_cleanup_v1",
    password: "b".repeat(64),
  });
  expect(read).toHaveBeenCalledOnce();
});
it.each(["missing", "hash", "oversized", "malformed", "shape"])(
  "refuses private %s before runner or URL access",
  async (mode) => {
    const f = managedCleanupEntryFixture(),
      env: Record<string, string | undefined> = { ...f.env };
    const raw =
      mode === "missing"
        ? undefined
        : mode === "hash"
          ? "{}"
          : mode === "oversized"
            ? " ".repeat(32769)
            : mode === "malformed"
              ? "{"
              : JSON.stringify({
                  schema_version: 1,
                  documentJson: "synthetic",
                  extra: true,
                });
    env.MAGICKLI_MANAGED_CLEANUP_PRIVATE_JSON = raw;
    if (mode !== "hash" && raw !== undefined)
      env.MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON = JSON.stringify({
        ...f.deployment,
        privateConfigSha256: createHash("sha256").update(raw).digest("hex"),
      });
    expect((await create(env)(request("Bearer " + f.token))).status).toBe(503);
    expect(m.run).not.toHaveBeenCalled();
  },
);
it("never falls back to an ordinary database if the dedicated URL is missing", async () => {
  const f = managedCleanupEntryFixture();
  await create({ ...f.env, MAGICKLI_MANAGED_CLEANUP_DATABASE_URL: undefined })(
    request("Bearer " + f.token),
  );
  const o = m.run.mock.calls[0][0] as ResearchManagedCleanupOptions;
  expect(() => o.connection()).toThrow("Private cleanup unavailable");
});
it("denies a missing secret and an aborted request without private loading", async () => {
  const f = managedCleanupEntryFixture();
  expect(
    (
      await create({ ...f.env, MAGICKLI_MANAGED_CLEANUP_SECRET: undefined })(
        request("Bearer " + f.token),
      )
    ).status,
  ).toBe(503);
  const c = new AbortController();
  c.abort();
  expect(
    (await create(f.env)(request("Bearer " + f.token, c.signal))).status,
  ).toBe(503);
  expect(m.run).not.toHaveBeenCalled();
});
it("retains the original work end across cheap descriptor parsing", async () => {
  const f = managedCleanupEntryFixture(),
    env = { ...f.env },
    clock = vi.spyOn(performance, "now").mockReturnValue(0);
  Object.defineProperty(env, "MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON", {
    get() {
      clock.mockReturnValue(40001);
      return JSON.stringify(f.deployment);
    },
  });
  expect((await create(env)(request("Bearer " + f.token))).status).toBe(503);
  expect(m.run).not.toHaveBeenCalled();
});
it("does not start the runner if a private getter exhausts the config deadline", async () => {
  const f = managedCleanupEntryFixture(),
    env = { ...f.env },
    clock = vi.spyOn(performance, "now").mockReturnValue(0);
  Object.defineProperty(env, "MAGICKLI_MANAGED_CLEANUP_PRIVATE_JSON", {
    get() {
      clock.mockReturnValue(9000);
      return f.raw;
    },
  });
  expect((await create(env)(request("Bearer " + f.token))).status).toBe(503);
  expect(m.run).not.toHaveBeenCalled();
});
it("refuses an unreviewed actual Node major before reading a secret", async () => {
  const f = managedCleanupEntryFixture(),
    original = Object.getOwnPropertyDescriptor(process.versions, "node")!;
  Object.defineProperty(process.versions, "node", {
    ...original,
    value: "22.13.0",
  });
  try {
    expect((await create(f.env)(request("Bearer " + f.token))).status).toBe(
      503,
    );
    expect(m.run).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(process.versions, "node", original);
  }
});
it("suppresses runner diagnostics", async () => {
  const f = managedCleanupEntryFixture();
  m.run.mockRejectedValue(Error("Synthetic secret"));
  const r = await create(f.env)(request("Bearer " + f.token));
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("Synthetic secret");
});
it("parses a canonical dedicated cleanup URL", () => {
  const f = managedCleanupEntryFixture();
  expect(Object.isFrozen(parse(f.url))).toBe(true);
  expect(parse(f.url)).toMatchObject({
    role: "magickli_research_cleanup_v1",
    database: "synthetic_research",
  });
});
it.each([
  "http://bad",
  "postgresql://%xx:bad@bad/x",
  " ",
  "x".repeat(16385),
  ...[
    "role",
    "password",
    "database",
    "port",
    "host",
    "pooler",
    "fragment",
    "ssl",
    "channel",
    "duplicate",
    "extra",
    "scheme",
  ].map((x) => x),
])("refuses credential variant %s", (variant) => {
  const f = managedCleanupEntryFixture(),
    u = new URL(f.url);
  switch (variant) {
    case "role":
      u.username = "magickli_research_runtime_v1";
      break;
    case "password":
      u.password = "short";
      break;
    case "database":
      u.pathname = "/bad-name";
      break;
    case "port":
      u.port = "5433";
      break;
    case "host":
      u.hostname = "untrusted.example";
      break;
    case "pooler":
      u.hostname = u.hostname.replace(".eu-", "-pooler.eu-");
      break;
    case "fragment":
      u.hash = "x";
      break;
    case "ssl":
      u.searchParams.set("sslmode", "require");
      break;
    case "channel":
      u.searchParams.delete("channel_binding");
      break;
    case "duplicate":
      u.searchParams.append("sslmode", "verify-full");
      break;
    case "extra":
      u.searchParams.set("options", "bad");
      break;
    case "scheme":
      expect(() => parse(f.url.replace("postgresql:", "http:"))).toThrow(
        "Private cleanup unavailable",
      );
      return;
    default:
      expect(() => parse(variant)).toThrow();
      return;
  }
  expect(() => parse(u.toString())).toThrow("Private cleanup unavailable");
});

it.each(["\n", "\r", "\u2028", "\u2029"])(
  "refuses encoded line terminators in cleanup passwords and database names %j",
  (suffix) => {
    const f = managedCleanupEntryFixture();
    for (const field of ["password", "pathname"] as const) {
      const u = new URL(f.url);
      u[field] += encodeURIComponent(suffix);
      expect(() => parse(u.toString())).toThrow("Private cleanup unavailable");
    }
  },
);
