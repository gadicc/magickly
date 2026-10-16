import { beforeEach, expect, it, vi } from "vitest";
import { admitChat } from "./access";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), reserve: vi.fn() }));
vi.mock("@/auth/session", () => ({ getCurrentSqlUserId: mocks.identity }));
vi.mock("./usage", () => ({ reserveDailyChatUsage: mocks.reserve }));
beforeEach(() => vi.resetAllMocks());

it.each(["server-user-id", null])(
  "uses the server identity (%s)",
  async (identity) => {
    mocks.identity.mockResolvedValue(identity);
    const admission = { allowed: true, resetAt: new Date() };
    mocks.reserve.mockResolvedValue(admission);
    expect(await admitChat()).toBe(admission);
    expect(mocks.reserve).toHaveBeenCalledWith(identity);
  },
);

it("does not treat a failed session lookup as anonymous", async () => {
  mocks.identity.mockRejectedValue(new Error("database unavailable"));
  await expect(admitChat()).rejects.toThrow("database unavailable");
  expect(mocks.reserve).not.toHaveBeenCalled();
});
