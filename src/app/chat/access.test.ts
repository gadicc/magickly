import { beforeEach, expect, it, vi } from "vitest";
import { admitChat } from "./access";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  reserve: vi.fn(),
  client: vi.fn((..._args: unknown[]) => "chat-client:mac"),
}));
vi.mock("@/auth/session", () => ({ getCurrentSqlUserId: mocks.identity }));
vi.mock("@/limits/request", () => ({ requestClientSubject: mocks.client }));
vi.mock("./usage", () => ({ reserveDailyChatUsage: mocks.reserve }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.client.mockReturnValue("chat-client:mac");
});
const request = new Request("https://magick.ly/chat/api/v2", {
  method: "POST",
});

it.each(["server-user-id", null])(
  "uses the server identity (%s)",
  async (identity) => {
    mocks.identity.mockResolvedValue(identity);
    const admission = { allowed: true, resetAt: new Date() };
    mocks.reserve.mockResolvedValue(admission);
    expect(await admitChat(request)).toBe(admission);
    const [who] = mocks.reserve.mock.calls[0];
    expect(who.userId).toBe(identity);
  },
);

it("keys a signed-out reader by the request's client bucket", async () => {
  mocks.identity.mockResolvedValue(null);
  mocks.reserve.mockResolvedValue({ allowed: true, resetAt: new Date() });
  await admitChat(request);
  const [who] = mocks.reserve.mock.calls[0];
  expect(who.client()).toBe("chat-client:mac");
  expect(mocks.client.mock.calls[0][0]).toBe(request);
  expect(mocks.client.mock.calls[0][1]).toMatchObject({
    prefix: "chat-client",
  });
});

it("does not treat a failed session lookup as anonymous", async () => {
  mocks.identity.mockRejectedValue(new Error("database unavailable"));
  await expect(admitChat(request)).rejects.toThrow("database unavailable");
  expect(mocks.reserve).not.toHaveBeenCalled();
});
