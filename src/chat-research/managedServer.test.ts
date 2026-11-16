/** Hosted ingress with a synthetic lazy bootstrap; no actual credentials, database or source access. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  managedDeploymentEnvironment,
  managedDeploymentFixture,
} from "./managedDeployment.fixture";
import { RESEARCH_CATALOG_API_PATH } from "./paths";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  handler: vi.fn(),
  imports: 0,
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  m.imports = 0;
  vi.doMock("./managedBootstrap", () => {
    m.imports++;
    return { bootstrapManagedResearch: m.bootstrap };
  });
  m.bootstrap.mockResolvedValue(m.handler);
  m.handler.mockImplementation(async () => Response.json({ ok: true }));
  for (const [key, value] of Object.entries(managedDeploymentEnvironment()))
    vi.stubEnv(key, value);
  vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_OPERATOR", undefined);
  vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_LOCAL", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function request(extra: Record<string, string | undefined> = {}) {
  const origin = managedDeploymentFixture().origin;
  return new Request(origin + RESEARCH_CATALOG_API_PATH, {
    method: "POST",
    headers: {
      host: "research.example.test",
      origin,
      "content-type": "application/json",
      "x-forwarded-proto": "https",
      "x-forwarded-port": "443",
      ...Object.fromEntries(
        Object.entries(extra).filter(
          (pair): pair is [string, string] => pair[1] !== undefined,
        ),
      ),
    },
    body: "{}",
  });
}
it("dispatches the managed purpose through the real web selector and carries the entry deadline", async () => {
  const { handleResearchRequest } = await import("./webServer");
  expect((await handleResearchRequest(request())).status).toBe(200);
  expect(m.imports).toBe(1);
  expect(m.bootstrap).toHaveBeenCalledOnce();
  expect(m.handler.mock.calls[0][1]).toBeLessThanOrEqual(
    m.bootstrap.mock.calls[0][2],
  );
  expect(m.handler.mock.calls[0][1]).toBeGreaterThan(performance.now());
});
it.each([
  { origin: "https://evil.example" },
  { host: "evil.example" },
  { "x-forwarded-port": "80" },
])("denies origin/proxy drift before lazy bootstrap %j", async (headers) => {
  const { handleManagedResearchRequest } = await import("./managedServer");
  expect((await handleManagedResearchRequest(request(headers))).status).toBe(
    403,
  );
  expect(m.imports).toBe(0);
});
it("does not import anything private when disabled or malformed", async () => {
  vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_MANAGED", undefined);
  const { handleManagedResearchRequest } = await import("./managedServer");
  expect((await handleManagedResearchRequest(request())).status).toBe(404);
  expect(m.imports).toBe(0);
  vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_MANAGED", "1");
  vi.stubEnv("MAGICKLI_MANAGED_DEPLOYMENT_JSON", "bad");
  expect((await handleManagedResearchRequest(request())).status).toBe(503);
  expect(m.imports).toBe(0);
});
it("selects managed web hints and refuses simultaneous local activation", async () => {
  const { readResearchWebDeployment } = await import("./webDeployment");
  expect(readResearchWebDeployment(process.env)?.mode).toBe("managed");
  vi.stubEnv("MAGICKLI_PRIVATE_RESEARCH_LOCAL", "1");
  expect(() => readResearchWebDeployment(process.env)).toThrow();
});
