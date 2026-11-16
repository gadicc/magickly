import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  readPrivateResearchPreviewSession as actualRead,
  readPrivateResearchManagedOperatorPrincipal,
  readPrivateResearchOperatorSession,
} from "./previewSession";

// Deliberately small fake SQL/auth ports; real Drizzle mode/adapter behavior is covered in authDatabase.test.
const readPrivateResearchPreviewSession = (
  database: unknown,
  settings: Parameters<typeof actualRead>[1],
  headers: Headers,
  signal: AbortSignal,
) =>
  actualRead(
    database as Parameters<typeof actualRead>[0],
    settings,
    headers,
    signal,
  );
const m = vi.hoisted(() => ({ create: vi.fn(), read: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../auth/sqlAuth", () => ({
  createSqlAuth: m.create,
  getFreshSqlSession: m.read,
}));
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  m.create.mockReset();
  m.read.mockReset();
  m.create.mockReturnValue({});
});
const settings = {
  baseURL: "http://localhost:4180",
  secret: "synthetic-only-secret-more-than-thirty-two-characters",
  googleClientId: "synthetic",
  googleClientSecret: "synthetic",
};
function fixture(
  mode = { readonly: "on", isolation: "read committed" },
  lease: { now: number; expires: number }[] = [
    { now: Date.now(), expires: 2000000000000 },
  ],
) {
  const tx = {
      execute: vi.fn(async () => []),
      select: vi.fn((fields) =>
        fields.readonly
          ? { from: vi.fn(async () => [mode]) }
          : { from: () => ({ where: async () => lease }) },
      ),
    },
    db = {
      transaction: vi.fn(
        async (fn: (t: typeof tx) => unknown, _config?: unknown) =>
          await fn(tx),
      ),
    };
  return { tx, db };
}
it("binds auth to the readonly transaction and returns only expiry plus stable identity reset digest", async () => {
  const { db, tx } = fixture();
  m.read.mockResolvedValue({
    user: { id: "synthetic-user" },
    session: { id: "synthetic-session", expiresAt: new Date(2000000000000) },
  });
  const headers = new Headers({ cookie: "synthetic-cookie" }),
    p = await readPrivateResearchPreviewSession(
      db,
      settings,
      headers,
      new AbortController().signal,
    );
  expect(p).toMatchObject({
    expiresAt: 2000000000000,
    identity: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  expect(JSON.stringify(p)).not.toContain("synthetic");
  expect(db.transaction.mock.calls[0][1]).toEqual({
    isolationLevel: "read committed",
    accessMode: "read only",
  });
  expect(m.create.mock.calls[0][0].db).toBe(tx);
  expect(m.read.mock.calls[0][1].has("cookie")).toBe(false);
  expect(headers.get("cookie")).toBe("synthetic-cookie");
});
it.each([
  { readonly: "off", isolation: "read committed" },
  { readonly: "on", isolation: "repeatable read" },
])("refuses nonreadonly/frozen snapshots before auth %j", async (mode) => {
  const { db } = fixture(mode);
  await expect(
    readPrivateResearchPreviewSession(
      db,
      settings,
      new Headers(),
      new AbortController().signal,
    ),
  ).rejects.toThrow(/^Private reader session unavailable$/);
  expect(m.read).not.toHaveBeenCalled();
});
it("returns null for no session and refuses aborted input without opening SQL", async () => {
  const { db } = fixture();
  m.read.mockResolvedValue(null);
  expect(
    await readPrivateResearchPreviewSession(
      db,
      settings,
      new Headers(),
      new AbortController().signal,
    ),
  ).toBeNull();
  db.transaction.mockClear();
  const c = new AbortController();
  c.abort();
  await expect(
    readPrivateResearchPreviewSession(db, settings, new Headers(), c.signal),
  ).rejects.toThrow();
  expect(db.transaction).not.toHaveBeenCalled();
});
it("fails closed if the readonly adapter refuses expired-session cleanup", async () => {
  const { db } = fixture();
  m.read.mockRejectedValue(Error("Private token in adapter failure"));
  await expect(
    readPrivateResearchPreviewSession(
      db,
      settings,
      new Headers(),
      new AbortController().signal,
    ),
  ).rejects.toThrow(/^Private reader session unavailable$/);
});
it("refuses nested transaction inputs", async () => {
  const { db } = fixture();
  await expect(
    readPrivateResearchPreviewSession(
      { ...db, rollback: () => {} } as never,
      settings,
      new Headers(),
      new AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(db.transaction).not.toHaveBeenCalled();
});
it("does not accept a late native COMMIT acknowledgement", async () => {
  const { db } = fixture(),
    clock = vi.spyOn(performance, "now").mockReturnValue(0);
  m.read.mockResolvedValue(null);
  db.transaction.mockImplementationOnce(async (fn) => {
    const value = await fn(fixture().tx);
    clock.mockReturnValue(8001);
    return value;
  });
  await expect(
    readPrivateResearchPreviewSession(
      db,
      settings,
      new Headers(),
      new AbortController().signal,
    ),
  ).rejects.toThrow();
});

it("binds the operator-only shell to the actual fresh signed canonical account, never browser email or roles", async () => {
  const { db } = fixture(),
    owner = "019aa111-0000-7000-8000-000000000001",
    other = "019aa111-0000-7000-8000-000000000003";
  m.read.mockResolvedValue({
    user: {
      id: other,
      email: "synthetic-operator@example.test",
      role: "admin",
    },
    session: {
      id: "019aa111-0000-7000-8000-000000000002",
      expiresAt: new Date(2000000000000),
    },
  });
  expect(
    await readPrivateResearchOperatorSession(
      db as never,
      settings,
      new Headers(),
      new AbortController().signal,
      owner,
    ),
  ).toBeNull();
  m.read.mockResolvedValue({
    user: { id: owner },
    session: {
      id: "019aa111-0000-7000-8000-000000000002",
      expiresAt: new Date(2000000000000),
    },
  });
  const session = await readPrivateResearchOperatorSession(
    db as never,
    settings,
    new Headers(),
    new AbortController().signal,
    owner,
  );
  expect(session?.expiresAt).toBe(2000000000000);
  expect(JSON.stringify(session)).not.toContain(owner);
  expect(m.read).toHaveBeenCalledTimes(2);
});
it.each([
  "operator@example.test",
  "admin",
  "019AA111-0000-7000-8000-000000000001",
  "../operator",
])("refuses noncanonical operator binding before SQL/auth: %s", async (id) => {
  const { db } = fixture();
  await expect(
    readPrivateResearchOperatorSession(
      db as never,
      settings,
      new Headers(),
      new AbortController().signal,
      id,
    ),
  ).rejects.toThrow("Private operator session unavailable");
  expect(db.transaction).not.toHaveBeenCalled();
  expect(m.read).not.toHaveBeenCalled();
});

it("returns the canonical server-only principal without token/profile fields and preserves the original ingress deadline", async () => {
  const { db } = fixture(),
    owner = "019aa111-0000-7000-8000-000000000001",
    session = "019aa111-0000-7000-8000-000000000002";
  m.read.mockResolvedValue({
    user: { id: owner, email: "synthetic@example.test" },
    session: {
      id: session,
      token: "private-synthetic-token",
      expiresAt: new Date(2000000000000),
    },
  });
  const p = await readPrivateResearchManagedOperatorPrincipal(
    db as never,
    settings,
    new Headers(),
    new AbortController().signal,
    owner,
    performance.now() + 8000,
  );
  expect(p).toEqual({
    subject: { kind: "user", user_id: owner, session_id: session },
    expiresAt: 2000000000000,
    deadlineAt: expect.any(Number),
  });
  expect(JSON.stringify(p)).not.toMatch(/token|email|synthetic/);
});
it.each([NaN, Infinity, -1])(
  "refuses invalid/elapsed managed inherited deadlines before SQL: %s",
  async (end) => {
    const { db } = fixture();
    await expect(
      readPrivateResearchManagedOperatorPrincipal(
        db as never,
        settings,
        new Headers(),
        new AbortController().signal,
        "019aa111-0000-7000-8000-000000000001",
        end,
      ),
    ).rejects.toThrow("Private operator session unavailable");
    expect(db.transaction).not.toHaveBeenCalled();
  },
);
it("refuses malformed managed session identity without treating an auth mock as grant authority", async () => {
  const { db } = fixture(),
    owner = "019aa111-0000-7000-8000-000000000001";
  m.read.mockResolvedValue({
    user: { id: owner },
    session: {
      id: "not-a-canonical-session",
      expiresAt: new Date(2000000000000),
    },
  });
  await expect(
    readPrivateResearchManagedOperatorPrincipal(
      db as never,
      settings,
      new Headers(),
      new AbortController().signal,
      owner,
      performance.now() + 8000,
    ),
  ).rejects.toThrow("Private operator session unavailable");
});

it("rejects a natively expired session even while the app wall clock still accepts the adapter session", async () => {
  const { db } = fixture(undefined, [
      { now: 2000000000001, expires: 2000000000000 },
    ]),
    owner = "019aa111-0000-7000-8000-000000000001";
  m.read.mockResolvedValue({
    user: { id: owner },
    session: {
      id: "019aa111-0000-7000-8000-000000000002",
      token: "synthetic-token",
      expiresAt: new Date(2000000000000),
    },
  });
  await expect(
    readPrivateResearchManagedOperatorPrincipal(
      db as never,
      settings,
      new Headers(),
      new AbortController().signal,
      owner,
      performance.now() + 8000,
    ),
  ).rejects.toThrow("Private operator session unavailable");
});
it("charges COMMIT acknowledgement time against a short native session TTL", async () => {
  const clock = vi.spyOn(performance, "now").mockReturnValue(0),
    f = fixture(undefined, [{ now: 1000, expires: 1005 }]),
    owner = "019aa111-0000-7000-8000-000000000001";
  m.read.mockResolvedValue({
    user: { id: owner },
    session: {
      id: "019aa111-0000-7000-8000-000000000002",
      token: "synthetic-token",
      expiresAt: new Date(2000000000000),
    },
  });
  f.db.transaction.mockImplementationOnce(async (work) => {
    const value = await work(f.tx);
    clock.mockReturnValue(6);
    return value;
  });
  await expect(
    readPrivateResearchManagedOperatorPrincipal(
      f.db as never,
      settings,
      new Headers(),
      new AbortController().signal,
      owner,
      8000,
    ),
  ).rejects.toThrow("Private operator session unavailable");
});
it("requires the native session/token/owner fence to still find a row", async () => {
  const { db } = fixture(undefined, []),
    owner = "019aa111-0000-7000-8000-000000000001";
  m.read.mockResolvedValue({
    user: { id: owner },
    session: {
      id: "019aa111-0000-7000-8000-000000000002",
      token: "synthetic-token",
      expiresAt: new Date(2000000000000),
    },
  });
  await expect(
    readPrivateResearchManagedOperatorPrincipal(
      db as never,
      settings,
      new Headers(),
      new AbortController().signal,
      owner,
      performance.now() + 8000,
    ),
  ).rejects.toThrow("Private operator session unavailable");
});

it("ends a hung native COMMIT wait when the observed short session lease expires", async () => {
  vi.useFakeTimers();
  try {
    const f = fixture(undefined, [{ now: 1000, expires: 1005 }]),
      owner = "019aa111-0000-7000-8000-000000000001";
    m.read.mockResolvedValue({
      user: { id: owner },
      session: {
        id: "019aa111-0000-7000-8000-000000000002",
        token: "synthetic-token",
        expiresAt: new Date(2000000000000),
      },
    });
    let entered!: () => void;
    const ready = new Promise<void>((r) => {
      entered = r;
    });
    f.db.transaction.mockImplementationOnce(async (work) => {
      await work(f.tx);
      entered();
      return new Promise(() => {});
    });
    const result = readPrivateResearchManagedOperatorPrincipal(
      f.db as never,
      settings,
      new Headers(),
      new AbortController().signal,
      owner,
      performance.now() + 8000,
    ).then(
      () => "accepted",
      () => "refused",
    );
    await ready;
    await vi.advanceTimersByTimeAsync(6);
    expect(await result).toBe("refused");
  } finally {
    vi.useRealTimers();
  }
});
