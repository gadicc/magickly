import { beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mock = vi.hoisted(() => ({
  session: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/auth/session", () => ({ getCurrentSqlSession: mock.session }));
vi.mock("@/db/neonFull", () => ({ db: {} }));
vi.mock("@/i18n/preferencesRepository", () => ({
  localePreferencesRepository: () => ({ read: mock.read, save: mock.save }),
}));
const current = { user: { id: "synthetic-a" }, session: { id: "session-a" } };
const request = (
  body: unknown = { userId: "synthetic-a", locale: "he" },
  origin = "https://magickly.example.test",
) =>
  new Request("https://magickly.example.test/api/ui-locale", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mock.session.mockResolvedValue(current);
  mock.read.mockResolvedValue("he");
  mock.save.mockResolvedValue(undefined);
});

it("returns only a freshly rechecked account's preference with private cache headers", async () => {
  const response = await GET();
  expect(await response.json()).toEqual({
    userId: "synthetic-a",
    locale: "he",
  });
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("vary")).toContain("Cookie");
  mock.session.mockResolvedValueOnce(current).mockResolvedValueOnce(null);
  expect((await GET()).status).toBe(409);
});
it("keeps anonymous preference reads empty", async () => {
  mock.session.mockResolvedValue(null);
  expect(await (await GET()).json()).toEqual({ userId: null, locale: null });
  expect(mock.read).not.toHaveBeenCalled();
  expect((await POST(request())).status).toBe(401);
});
it("saves only the authenticated account, rejecting stale identities and cross-site requests", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mock.save).toHaveBeenCalledWith("synthetic-a", "he");
  mock.save.mockClear();
  expect(
    (await POST(request({ userId: "synthetic-b", locale: "he" }))).status,
  ).toBe(409);
  expect(
    (await POST(request(undefined, "https://other.example.test"))).status,
  ).toBe(403);
  expect(mock.save).not.toHaveBeenCalled();
});
it("validates the bounded input and rechecks identity before writes", async () => {
  for (const body of [
    null,
    [],
    { userId: "synthetic-a", locale: "fr" },
    { userId: "synthetic-a", locale: "he", extra: true },
  ])
    expect((await POST(request(body))).status).toBe(400);
  expect(
    (await POST(request({ userId: "x".repeat(300), locale: "he" }))).status,
  ).toBe(413);
  mock.session.mockResolvedValueOnce(current).mockResolvedValueOnce(null);
  expect((await POST(request())).status).toBe(409);
  expect(mock.save).not.toHaveBeenCalled();
});
it("reports an unavailable store without exposing internals", async () => {
  mock.read.mockRejectedValue(new Error("private implementation details"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private implementation details");
});
