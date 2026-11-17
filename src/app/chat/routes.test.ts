import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as legacyPost } from "./api/route";
import { POST as v2Post } from "./api/v2/route";

const mocks = vi.hoisted(() => ({ admit: vi.fn(), providers: vi.fn() }));
vi.mock("./access", () => ({ admitChat: mocks.admit }));
vi.mock("./providers", () => ({ chatDependencies: mocks.providers }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admit.mockResolvedValue({
    allowed: false,
    resetAt: new Date("2026-10-17T00:00:00Z"),
  });
});

const routes = [
  ["legacy", legacyPost, { role: "user", content: "Hello" }],
  ["v2", v2Post, { role: "user", parts: [{ type: "text", text: "Hello" }] }],
] as const;

const post = (
  route: (request: Request) => Response | Promise<Response>,
  message: unknown,
  headers: Record<string, string>,
) =>
  route(
    new Request("http://localhost/chat/api", {
      method: "POST",
      headers,
      body: JSON.stringify({ messages: [message] }),
    }),
  );

it.each(routes)(
  "enforces shared admission in the %s route",
  async (_, route, message) => {
    const response = await post(route, message, {
      "sec-fetch-site": "same-origin",
    });
    expect(response.status).toBe(429);
    expect(mocks.admit).toHaveBeenCalledOnce();
    expect(mocks.providers).not.toHaveBeenCalled();
  },
);

describe.each(routes)("the %s route's origin guard", (_, route, message) => {
  it.each([
    ["a cross-site fetch", { "sec-fetch-site": "cross-site" }],
    ["a same-site fetch", { "sec-fetch-site": "same-site" }],
    [
      "a cross-site fetch naming this origin",
      { "sec-fetch-site": "cross-site", origin: "http://localhost" },
    ],
    ["another Origin", { origin: "https://elsewhere.example" }],
    ["no Origin and no Sec-Fetch-Site", {}],
    ["an unreadable Origin", { origin: "null", host: "localhost" }],
    [
      "an Origin matching the URL but not the Host",
      { origin: "http://localhost", host: "magick.ly" },
    ],
  ])("refuses %s before admission", async (_, headers) => {
    const response = await post(route, message, headers);
    expect(response.status).toBe(403);
    expect(mocks.admit).not.toHaveBeenCalled();
    expect(mocks.providers).not.toHaveBeenCalled();
  });

  it.each([
    ["Sec-Fetch-Site: same-origin", { "sec-fetch-site": "same-origin" }],
    ["a matching Origin", { origin: "http://localhost", host: "localhost" }],
  ])("takes %s", async (_, headers) => {
    const response = await post(route, message, headers);
    expect(response.status).toBe(429);
    expect(mocks.admit).toHaveBeenCalledOnce();
  });
});
