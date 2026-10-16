import { beforeEach, expect, it, vi } from "vitest";
import { POST as legacyPost } from "./api/route";
import { POST as v2Post } from "./api/v2/route";

const mocks = vi.hoisted(() => ({ admit: vi.fn(), providers: vi.fn() }));
vi.mock("./access", () => ({ admitChat: mocks.admit }));
vi.mock("./providers", () => ({ chatDependencies: mocks.providers }));
beforeEach(() => vi.resetAllMocks());

it.each([
  ["legacy", legacyPost, { role: "user", content: "Hello" }],
  ["v2", v2Post, { role: "user", parts: [{ type: "text", text: "Hello" }] }],
] as const)(
  "enforces shared admission in the %s route",
  async (_, post, message) => {
    mocks.admit.mockResolvedValue({
      allowed: false,
      resetAt: new Date("2026-10-17T00:00:00Z"),
    });
    const response = await post(
      new Request("http://localhost/chat/api", {
        method: "POST",
        body: JSON.stringify({ messages: [message] }),
      }),
    );
    expect(response.status).toBe(429);
    expect(mocks.admit).toHaveBeenCalledOnce();
    expect(mocks.providers).not.toHaveBeenCalled();
  },
);
