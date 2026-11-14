/** Bootstrap continuation controls use fake OS/DNS/root modules. No actual OS private root, credential or database is accessed. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const lookup = vi.fn(),
  load = vi.fn(),
  directory = vi.fn(),
  handler = vi.fn();
let homedir: string,
  git: boolean,
  stat: {
    device: bigint;
    inode: bigint;
    mode: bigint;
    mtime_ns: bigint;
    ctime_ns: bigint;
  },
  connection: {
    host: string[];
    port: number[];
    database: string;
    user: string;
    path: unknown;
  },
  db: { $client: { options: typeof connection } },
  authOptions: {
    db: typeof db;
    baseURL: string;
    secret: string;
    googleClientId: string;
    googleClientSecret: string;
  },
  imports: { db: number; auth: number };
beforeEach(() => {
  vi.resetModules();
  lookup.mockReset();
  load.mockReset();
  directory.mockReset();
  handler.mockReset();
  homedir = "/synthetic-operator";
  git = false;
  stat = {
    device: BigInt(1),
    inode: BigInt(2),
    mode: BigInt(0o700),
    mtime_ns: BigInt(3),
    ctime_ns: BigInt(4),
  };
  imports = { db: 0, auth: 0 };
  connection = {
    host: ["db.localtest.me"],
    port: [5432],
    database: "magickli_dev",
    user: "magickli_dev",
    path: false,
  };
  db = { $client: { options: connection } };
  authOptions = {
    db,
    baseURL: "http://localhost:4179",
    secret: "synthetic-secret",
    googleClientId: "synthetic-id",
    googleClientSecret: "synthetic-secret",
  };
  lookup.mockResolvedValue([
    { address: "127.0.0.1", family: 4 },
    { address: "::1", family: 6 },
  ]);
  load.mockReturnValue(handler);
  directory.mockImplementation(() => Object.freeze({ ...stat }));
  vi.doMock("node:os", () => ({ userInfo: () => ({ homedir }) }));
  vi.doMock("node:fs", () => ({ existsSync: () => git }));
  vi.doMock("node:dns/promises", () => ({ lookup }));
  vi.doMock("./privateFiles", () => ({
    requirePrivateRetentionDirectory: directory,
  }));
  vi.doMock("./localStartup", () => ({ loadResearchLocalStartup: load }));
  vi.doMock("../db/neonFull", () => {
    imports.db++;
    return { db };
  });
  vi.doMock("../auth/runtime", () => {
    imports.auth++;
    return { sqlAuthOptions: authOptions };
  });
  vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-key-not-a-real-credential");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function setup() {
  const module = await import("./localBootstrap");
  const deployment = {
    origin: authOptions.baseURL,
    startupSha256: "a".repeat(64),
    runtimeRevision: "b".repeat(64),
    authorityEndpointIdentity: module.researchLocalEndpointIdentity(connection),
  };
  return { module, deployment };
}
const signal = () => new AbortController().signal;
it("uses the actual captured app root/settings and independently pinned local endpoint after loopback DNS checks", async () => {
  const { module, deployment } = await setup(),
    result = await module.bootstrapLocalResearch(
      deployment,
      signal(),
      performance.now() + 8000,
    );
  expect(result).toBe(handler);
  expect(imports).toEqual({ db: 1, auth: 1 });
  expect(load).toHaveBeenCalledOnce();
  expect(load.mock.calls[0][0]).toMatchObject({
    root: "/synthetic-operator/.local/share/magickli/chat-corpus",
    generation: "read-only",
    independentlyAdoptedStartupSha256: deployment.startupSha256,
    runtimeRevision: deployment.runtimeRevision,
    authorityEndpointIdentity: deployment.authorityEndpointIdentity,
    apiKey: expect.any(Function),
  });
  expect(load.mock.calls[0][0].database).toBe(db);
  expect(load.mock.calls[0][0].authOptions).toBe(authOptions);
  expect(handler).not.toHaveBeenCalled();
});
it.each([
  "host",
  "port",
  "database",
  "role",
  "socket",
  "multiple-hosts",
  "multiple-ports",
])("refuses mismatched actual connection %s", (kind) => {
  // Import only the pure endpoint function through the already mocked modules.
  return setup().then(({ module }) => {
    if (kind === "host") connection.host = ["external.example"];
    if (kind === "port") connection.port = [5433];
    if (kind === "database") connection.database = "production";
    if (kind === "role") connection.user = "postgres";
    if (kind === "socket") connection.path = "/tmp/socket";
    if (kind === "multiple-hosts") connection.host.push("127.0.0.1");
    if (kind === "multiple-ports") connection.port.push(5432);
    expect(() => module.researchLocalEndpointIdentity(connection)).toThrow(
      /^Private research startup unavailable$/,
    );
    expect(load).not.toHaveBeenCalled();
  });
});
it("accepts the postgres.js undefined TCP path as the same normalized nonsecret identity", async () => {
  const { module, deployment } = await setup();
  connection.path = undefined;
  expect(module.researchLocalEndpointIdentity(connection)).toBe(
    deployment.authorityEndpointIdentity,
  );
});
it.each(["temp", "git", "shared"])(
  "refuses an unsafe fixed OS root %s before DNS/imports",
  async (kind) => {
    const { module, deployment } = await setup();
    if (kind === "temp") homedir = "/tmp/synthetic";
    if (kind === "git") git = true;
    if (kind === "shared") stat.mode = BigInt(0o750);
    await expect(
      module.bootstrapLocalResearch(
        deployment,
        signal(),
        performance.now() + 8000,
      ),
    ).rejects.toThrow(/^Private research startup unavailable$/);
    expect(lookup).not.toHaveBeenCalled();
    expect(imports).toEqual({ db: 0, auth: 0 });
    expect(load).not.toHaveBeenCalled();
  },
);
it.each([
  { addresses: [] },
  { addresses: [{ address: "192.0.2.5", family: 4 }] },
])(
  "refuses a nonloopback DNS observation %# before DB/auth imports",
  async ({ addresses }) => {
    const { module, deployment } = await setup();
    lookup.mockResolvedValue(addresses);
    await expect(
      module.bootstrapLocalResearch(
        deployment,
        signal(),
        performance.now() + 8000,
      ),
    ).rejects.toThrow(/^Private research startup unavailable$/);
    expect(imports).toEqual({ db: 0, auth: 0 });
    expect(load).not.toHaveBeenCalled();
  },
);
it("does no follow-up imports after a timer-starved late DNS fulfillment", async () => {
  const { module, deployment } = await setup(),
    now = vi.spyOn(performance, "now").mockReturnValue(0);
  lookup.mockImplementation(async () => {
    now.mockReturnValue(8001);
    return [{ address: "127.0.0.1", family: 4 }];
  });
  await expect(
    module.bootstrapLocalResearch(deployment, signal(), 8000),
  ).rejects.toThrow(/^Private research startup unavailable$/);
  expect(imports).toEqual({ db: 0, auth: 0 });
  expect(load).not.toHaveBeenCalled();
});
it("does not import follow-up modules after cancellation during DNS", async () => {
  const { module, deployment } = await setup(),
    controller = new AbortController();
  lookup.mockImplementation(async () => {
    controller.abort();
    return [{ address: "127.0.0.1", family: 4 }];
  });
  await expect(
    module.bootstrapLocalResearch(
      deployment,
      controller.signal,
      performance.now() + 8000,
    ),
  ).rejects.toThrow(/^Private research startup unavailable$/);
  expect(imports).toEqual({ db: 0, auth: 0 });
  expect(load).not.toHaveBeenCalled();
});
it.each(["git", "replacement"])(
  "rechecks the original root after awaited work: %s",
  async (kind) => {
    const { module, deployment } = await setup();
    lookup.mockImplementation(async () => {
      if (kind === "git") git = true;
      else stat.inode++;
      return [{ address: "127.0.0.1", family: 4 }];
    });
    await expect(
      module.bootstrapLocalResearch(
        deployment,
        signal(),
        performance.now() + 8000,
      ),
    ).rejects.toThrow(/^Private research startup unavailable$/);
    expect(load).not.toHaveBeenCalled();
  },
);
it.each(["git", "replacement", "deadline"])(
  "rechecks after private assembly before returning a handler: %s",
  async (kind) => {
    const { module, deployment } = await setup(),
      now = vi.spyOn(performance, "now").mockReturnValue(0);
    load.mockImplementation(() => {
      if (kind === "git") git = true;
      else if (kind === "replacement") stat.inode++;
      else now.mockReturnValue(8001);
      return handler;
    });
    await expect(
      module.bootstrapLocalResearch(deployment, signal(), 8000),
    ).rejects.toThrow(/^Private research startup unavailable$/);
    expect(load).toHaveBeenCalledOnce();
    expect(handler).not.toHaveBeenCalled();
  },
);
it.each(["endpoint", "origin"])(
  "refuses wrong captured startup dependencies %s",
  async (kind) => {
    const { module, deployment } = await setup();
    if (kind === "endpoint")
      deployment.authorityEndpointIdentity = "c".repeat(64);
    if (kind === "origin") authOptions.baseURL = "http://localhost:3004";
    await expect(
      module.bootstrapLocalResearch(
        deployment,
        signal(),
        performance.now() + 8000,
      ),
    ).rejects.toThrow(/^Private research startup unavailable$/);
    expect(load).not.toHaveBeenCalled();
  },
);
it.each([NaN, Infinity, -1])(
  "refuses invalid/already elapsed startup deadline %s without accessing the OS root",
  async (end) => {
    const { module, deployment } = await setup();
    await expect(
      module.bootstrapLocalResearch(deployment, signal(), end),
    ).rejects.toThrow(/^Private research startup unavailable$/);
    expect(directory).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  },
);

it("does not load private assembly after a timer-starved DB/auth import continuation", async () => {
  const { module, deployment } = await setup(),
    now = vi.spyOn(performance, "now").mockReturnValue(0);
  vi.doMock("../db/neonFull", () => {
    imports.db++;
    now.mockReturnValue(8001);
    return { db };
  });
  await expect(
    module.bootstrapLocalResearch(deployment, signal(), 8000),
  ).rejects.toThrow(/^Private research startup unavailable$/);
  expect(load).not.toHaveBeenCalled();
});
it("does not start another root snapshot or DNS stage after a slow initial root check", async () => {
  const { module, deployment } = await setup(),
    now = vi.spyOn(performance, "now").mockReturnValue(0);
  directory.mockImplementationOnce(() => {
    now.mockReturnValue(8001);
    return Object.freeze({ ...stat });
  });
  await expect(
    module.bootstrapLocalResearch(deployment, signal(), 8000),
  ).rejects.toThrow(/^Private research startup unavailable$/);
  expect(directory).toHaveBeenCalledOnce();
  expect(lookup).not.toHaveBeenCalled();
  expect(load).not.toHaveBeenCalled();
});

it("bootstraps without a Gateway key and resolves only when explicitly requested by ready generation", async () => {
  const { module, deployment } = await setup();
  vi.stubEnv("AI_GATEWAY_API_KEY", undefined);
  expect(
    await module.bootstrapLocalResearch(
      deployment,
      signal(),
      performance.now() + 8000,
    ),
  ).toBe(handler);
  const resolve = load.mock.calls[0][0].apiKey;
  expect(typeof resolve).toBe("function");
  expect(() => resolve()).toThrow(/^Private research startup unavailable$/);
  vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-key-later-in-server-env");
  expect(resolve()).toBe("synthetic-key-later-in-server-env");
  expect(handler).not.toHaveBeenCalled();
});
