import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readPrivateResearchPreviewSession as actualRead } from "./previewSession";

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
function fixture(mode = { readonly: "on", isolation: "read committed" }) {
  const tx = {
      execute: vi.fn(async () => []),
      select: vi.fn(() => ({ from: vi.fn(async () => [mode]) })),
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
