/** Bootstrap plumbing only; canonical auth/source SQL contracts are tested separately. No real settings, credentials or sockets. */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { managedDeploymentFixture } from "./managedDeployment.fixture";
import { managedOperatorStartupFixture } from "./managedOperatorStartup.fixture";
import { RESEARCH_API_PATH, RESEARCH_CATALOG_API_PATH } from "./paths";

const m = vi.hoisted(() => ({
  database: vi.fn(),
  create: vi.fn(),
  principal: vi.fn(),
  close: vi.fn(),
  authority: { transaction: vi.fn() },
  reader: { transaction: vi.fn() },
  last: undefined as unknown,
  handler: vi.fn(),
  settings: {
    baseURL: "https://research.example.test",
    secret: "synthetic-auth-secret-over-thirty-two-characters",
    googleClientId: "synthetic",
    googleClientSecret: "synthetic",
    get db(): never {
      throw Error("Ordinary DB must not be adopted");
    },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("./managedDatabase", () => ({
  createResearchManagedDatabase: m.database,
}));
vi.mock("./managedSqlService", () => ({
  createResearchManagedSqlService: m.create,
}));
vi.mock("./previewSession", () => ({
  readPrivateResearchManagedOperatorPrincipal: m.principal,
}));
vi.mock("../auth/runtime", () => ({ sqlAuthOptions: m.settings }));
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function config(generation = "native-window") {
  return JSON.stringify({
    schema_version: 1,
    startupJson: "synthetic-startup",
    generation,
    corpusTarget: { datasetsOid: 801, unitsOid: 802 },
    cleanupRuntime: managedOperatorStartupFixture().runtime,
  });
}
async function start(
  generation: "read-only" | "native-window" = "native-window",
) {
  const raw = config(generation),
    d = {
      ...managedDeploymentFixture(),
      generation,
      privateConfigSha256: hash(raw),
    };
  vi.stubEnv(
    "MAGICKLI_MANAGED_RUNTIME_DATABASE_URL",
    "synthetic-authority-url",
  );
  const module = await import("./managedBootstrap");
  return { module, raw, d };
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  m.settings.baseURL = "https://research.example.test";
  m.database.mockImplementation((_url, pin) => ({
    database:
      pin.role === "magickli_research_runtime_v1" ? m.authority : m.reader,
    endpointIdentity: pin.endpointSha256,
    close: m.close,
  }));
  m.close.mockResolvedValue(undefined);
  m.handler.mockResolvedValue(Response.json({ ok: true }));
  m.create.mockImplementation((options) => {
    m.last = options;
    return m.handler;
  });
  m.principal.mockResolvedValue({
    identity: "synthetic-key",
    expiresAt: 2000000000000,
    deadlineAt: Number.MAX_SAFE_INTEGER,
    subject: {
      kind: "user",
      user_id: "019aa111-0000-7000-8000-000000000001",
      session_id: "019aa111-0000-7000-8000-000000000002",
    },
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function options() {
  return m.last as import("./managedSqlService").ResearchManagedSqlServiceOptions;
}
it("shares the same canonical page/API startup while loading no private configuration on shell/auth setup", async () => {
  const { module, d } = await start(),
    ui = {
      mode: "managed",
      ...Object.fromEntries(Object.entries(d).reverse()),
    };
  const page = await module.readManagedResearchPageSession(
    ui as unknown as typeof d,
    new Headers(),
    new AbortController().signal,
  );
  const handler = await module.bootstrapManagedResearch(
    d,
    new AbortController().signal,
    performance.now() + 8000,
  );
  expect(handler).toBeTypeOf("function");
  expect(m.database).toHaveBeenCalledOnce();
  expect(m.create).toHaveBeenCalledOnce();
  expect(page).toEqual({
    identity: expect.stringMatching(/^[a-f0-9]{64}$/),
    expiresAt: 2000000000000,
  });
  expect(JSON.stringify(page)).not.toContain(d.operatorId);
  expect(options().database).toBe(m.authority);
  expect(options().authOptions).not.toHaveProperty("db");
  expect(options().authNativeTarget?.roleOid).toBe(d.runtimeRoleOid);
  expect(m.principal.mock.calls[0][6]).toMatchObject({
    roleOid: d.runtimeRoleOid,
  });
  await expect(
    module.bootstrapManagedResearch(
      { ...d, runtimeRevision: "f".repeat(64) },
      new AbortController().signal,
      performance.now() + 8000,
    ),
  ).rejects.toThrow();
});
it("opens only the reader after the post-auth loader verifies independently pinned private configuration", async () => {
  const { module, d, raw } = await start();
  await module.bootstrapManagedResearch(
    d,
    new AbortController().signal,
    performance.now() + 8000,
  );
  expect(m.database).toHaveBeenCalledOnce();
  vi.stubEnv("MAGICKLI_MANAGED_PRIVATE_JSON", raw);
  vi.stubEnv("MAGICKLI_MANAGED_CORPUS_DATABASE_URL", "synthetic-reader-url");
  const privateOptions = await options().loadPrivateOptions(
    new AbortController().signal,
    performance.now() + 8000,
  );
  expect(m.database).toHaveBeenCalledTimes(2);
  expect(privateOptions.corpusDatabase).toBe(m.reader);
  expect(privateOptions.corpusNativeTarget).toMatchObject({
    roleOid: d.readerRoleOid,
    datasetsOid: 801,
  });
  expect(privateOptions.generation).toBeUndefined();
  const apiKey = privateOptions.apiKey;
  if (typeof apiKey !== "function") throw Error("Expected lazy key resolver");
  expect(() => apiKey()).toThrow();
  vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-provider-key");
  expect(apiKey()).toBe("synthetic-provider-key");
  await options().loadPrivateOptions(
    new AbortController().signal,
    performance.now() + 8000,
  );
  expect(m.database).toHaveBeenCalledTimes(2);
});
it("read-only hosted mode refuses questions without auth/private loading and forwards metadata with the original deadline", async () => {
  const { module, d, raw } = await start("read-only"),
    handler = await module.bootstrapManagedResearch(
      d,
      new AbortController().signal,
      performance.now() + 8000,
    );
  expect(
    (
      await handler(
        new Request(d.origin + RESEARCH_API_PATH, {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
  ).toBe(503);
  expect(m.handler).not.toHaveBeenCalled();
  expect(m.principal).not.toHaveBeenCalled();
  const deadline = performance.now() + 1000,
    req = new Request(d.origin + RESEARCH_CATALOG_API_PATH, {
      method: "POST",
      body: "{}",
    });
  await handler(req, deadline);
  expect(m.handler).toHaveBeenCalledWith(req, deadline);
  vi.stubEnv("MAGICKLI_MANAGED_PRIVATE_JSON", raw);
  vi.stubEnv("MAGICKLI_MANAGED_CORPUS_DATABASE_URL", "synthetic-reader-url");
  expect(
    (
      await options().loadPrivateOptions(
        new AbortController().signal,
        performance.now() + 8000,
      )
    ).generation,
  ).toBe("read-only");
});
it.each(["missing-authority", "auth-origin"])(
  "keeps startup failure sticky and closes a created root: %s",
  async (mode) => {
    const { module, d } = await start();
    if (mode === "missing-authority")
      vi.stubEnv("MAGICKLI_MANAGED_RUNTIME_DATABASE_URL", undefined);
    else m.settings.baseURL = "https://wrong.example.test";
    await expect(
      module.bootstrapManagedResearch(
        d,
        new AbortController().signal,
        performance.now() + 8000,
      ),
    ).rejects.toThrow();
    await expect(
      module.bootstrapManagedResearch(
        d,
        new AbortController().signal,
        performance.now() + 8000,
      ),
    ).rejects.toThrow();
    expect(m.close).toHaveBeenCalledTimes(mode === "auth-origin" ? 1 : 0);
  },
);
it("rejects missing/changed private settings, expired and cancelled loads before reader creation", async () => {
  const { module, d, raw } = await start();
  await module.bootstrapManagedResearch(
    d,
    new AbortController().signal,
    performance.now() + 8000,
  );
  const load = options().loadPrivateOptions;
  await expect(
    load(new AbortController().signal, performance.now() + 8000),
  ).rejects.toThrow();
  vi.stubEnv("MAGICKLI_MANAGED_PRIVATE_JSON", raw + " ");
  await expect(
    load(new AbortController().signal, performance.now() + 8000),
  ).rejects.toThrow();
  vi.stubEnv("MAGICKLI_MANAGED_PRIVATE_JSON", raw);
  await expect(
    load(new AbortController().signal, performance.now() + 8000),
  ).rejects.toThrow();
  await expect(load(new AbortController().signal, -1)).rejects.toThrow();
  const abort = new AbortController();
  abort.abort();
  await expect(load(abort.signal, performance.now() + 8000)).rejects.toThrow();
  expect(m.database).toHaveBeenCalledOnce();
});
it("returns no page session for a missing operator and rejects invalid/elapsed startup before root creation", async () => {
  const { module, d } = await start();
  await expect(
    module.bootstrapManagedResearch(d, new AbortController().signal, NaN),
  ).rejects.toThrow();
  await expect(
    module.bootstrapManagedResearch(d, new AbortController().signal, -1),
  ).rejects.toThrow();
  expect(m.database).not.toHaveBeenCalled();
  m.principal.mockResolvedValue(null);
  expect(
    await module.readManagedResearchPageSession(
      d,
      new Headers(),
      new AbortController().signal,
    ),
  ).toBeNull();
});

it.each(["generation", "equal-oids", "cleanup", "shape", "oversized"])(
  "rejects independently pinned but invalid private configuration before reader credentials: %s",
  async (mode) => {
    const { module, d } = await start();
    const value = JSON.parse(config());
    if (mode === "generation") value.generation = "read-only";
    if (mode === "equal-oids")
      value.corpusTarget.unitsOid = value.corpusTarget.datasetsOid;
    if (mode === "cleanup") value.cleanupRuntime = { invalid: true };
    if (mode === "shape") value.unexpected = true;
    const raw =
      mode === "oversized"
        ? " ".repeat(1024 * 1024 + 32769)
        : JSON.stringify(value);
    vi.stubEnv("MAGICKLI_MANAGED_PRIVATE_JSON", raw);
    await module.bootstrapManagedResearch(
      { ...d, privateConfigSha256: hash(raw) },
      new AbortController().signal,
      performance.now() + 8000,
    );
    await expect(
      options().loadPrivateOptions(
        new AbortController().signal,
        performance.now() + 8000,
      ),
    ).rejects.toThrow();
    expect(m.database).toHaveBeenCalledOnce();
  },
);
it("keeps the supported runtime check before even constructing a transport", async () => {
  const { module, d } = await start(),
    original = Object.getOwnPropertyDescriptor(process.versions, "node")!;
  Object.defineProperty(process.versions, "node", {
    ...original,
    value: "22.13.0",
  });
  try {
    await expect(
      module.bootstrapManagedResearch(
        d,
        new AbortController().signal,
        performance.now() + 8000,
      ),
    ).rejects.toThrow();
    expect(m.database).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(process.versions, "node", original);
  }
});
it("ends independent shared setup after a late canonical-settings import and closes the unused root", async () => {
  const { module, d } = await start();
  let release!: () => void;
  vi.doMock("../auth/runtime", async () => {
    await new Promise<void>((r) => {
      release = r;
    });
    return { sqlAuthOptions: m.settings };
  });
  const end = performance.now() + 8000,
    pending = module.bootstrapManagedResearch(
      d,
      new AbortController().signal,
      end,
    );
  const rejected = expect(pending).rejects.toThrow();
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  // Shared setup starts just after the caller computes its own end.
  // Advance beyond both independent eight-second bounds.
  vi.spyOn(performance, "now").mockReturnValue(performance.now() + 9000);
  release();
  await rejected;
  await vi.waitFor(() => expect(m.close).toHaveBeenCalledOnce());
  expect(m.create).not.toHaveBeenCalled();
  vi.doMock("../auth/runtime", () => ({ sqlAuthOptions: m.settings }));
});
it("a disconnected bootstrap waiter cannot poison a valid shared load for the next request", async () => {
  const { module, d } = await start();
  let release!: () => void;
  vi.doMock("../auth/runtime", async () => {
    await new Promise<void>((r) => {
      release = r;
    });
    return { sqlAuthOptions: m.settings };
  });
  const controller = new AbortController(),
    pending = module.bootstrapManagedResearch(
      d,
      controller.signal,
      performance.now() + 8000,
    ),
    rejected = expect(pending).rejects.toThrow();
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  controller.abort();
  await rejected;
  release();
  expect(
    await module.bootstrapManagedResearch(
      d,
      new AbortController().signal,
      performance.now() + 8000,
    ),
  ).toBeTypeOf("function");
  expect(m.database).toHaveBeenCalledOnce();
  vi.doMock("../auth/runtime", () => ({ sqlAuthOptions: m.settings }));
});
