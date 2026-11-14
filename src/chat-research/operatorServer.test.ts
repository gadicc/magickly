/** Actual selection and shared ingress with controlled assembly. Native configured integration is separate. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const bootstrap = vi.fn(),
  oldBootstrap = vi.fn(),
  handler = vi.fn();
let imports = 0;
beforeEach(() => {
  vi.resetModules();
  imports = 0;
  bootstrap.mockReset();
  oldBootstrap.mockReset();
  handler.mockReset();
  handler.mockResolvedValue(new Response("synthetic"));
  bootstrap.mockResolvedValue(handler);
  vi.doMock("./operatorBootstrap", () => {
    imports++;
    return { bootstrapOperatorResearch: bootstrap };
  });
  vi.doMock("./localBootstrap", () => ({
    bootstrapLocalResearch: oldBootstrap,
  }));
  for (const key of [
    "CI",
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_URL",
    "VERCEL_REGION",
    "MAGICKLI_PRIVATE_RESEARCH_LOCAL",
  ])
    vi.stubEnv(key, undefined);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:4179");
  vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_OPERATOR", "1");
  vi.stubEnv("MAGICKLI_OPERATOR_STARTUP_SHA256", "a".repeat(64));
  vi.stubEnv("MAGICKLI_OPERATOR_RUNTIME_SHA256", "b".repeat(64));
  vi.stubEnv("MAGICKLI_OPERATOR_ENDPOINT_SHA256", "c".repeat(64));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const request = (origin = "http://localhost:4179") =>
  new Request("http://localhost:4179/chat/research/api", {
    method: "POST",
    headers: {
      origin,
      host: "localhost:4179",
      "content-type": "application/json",
    },
    body: '{"question":"Synthetic?","mode":"passage"}',
  });
it("synchronously selects and snapshots the new entry; does not fall back to the old reader", async () => {
  const { handleResearchRequest } = await import("./webServer"),
    req = request(),
    pending = handleResearchRequest(req);
  req.headers.set("origin", "https://changed.example");
  expect((await pending).status).toBe(200);
  expect(bootstrap).toHaveBeenCalledOnce();
  expect(oldBootstrap).not.toHaveBeenCalled();
  expect(handler.mock.calls[0][0].headers.get("origin")).toBe(
    "http://localhost:4179",
  );
  expect(handler.mock.calls[0][1]).toBeTypeOf("number");
});
it.each(["disabled", "ambiguous", "old-pins", "hosted", "cross-origin"])(
  "refuses %s before private bootstrap import",
  async (kind) => {
    if (kind === "disabled")
      vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_OPERATOR", undefined);
    if (kind === "ambiguous")
      vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_LOCAL", "1");
    if (kind === "old-pins") {
      vi.stubEnv("MAGICKLI_OPERATOR_STARTUP_SHA256", undefined);
      vi.stubEnv("MAGICKLI_RESEARCH_STARTUP_SHA256", "d".repeat(64));
    }
    if (kind === "hosted") vi.stubEnv("VERCEL", "1");
    const { handleResearchRequest } = await import("./webServer"),
      result = await handleResearchRequest(
        request(kind === "cross-origin" ? "https://example.test" : undefined),
      );
    expect(result.status).toBe(
      kind === "disabled" ? 404 : kind === "cross-origin" ? 403 : 503,
    );
    expect(imports).toBe(0);
    expect(bootstrap).not.toHaveBeenCalled();
    expect(oldBootstrap).not.toHaveBeenCalled();
    expect(result.headers.get("cache-control")).toContain("no-store");
  },
);
it("keeps a failed new-purpose startup sticky instead of trying old-purpose configuration", async () => {
  bootstrap.mockRejectedValue(Error("synthetic private failure"));
  const { handleResearchRequest } = await import("./webServer");
  for (let i = 0; i < 2; i++) {
    const result = await handleResearchRequest(request());
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain("synthetic private");
  }
  expect(bootstrap).toHaveBeenCalledOnce();
  expect(oldBootstrap).not.toHaveBeenCalled();
});
