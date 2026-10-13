import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ assertReady: vi.fn() }));
vi.mock("@/secrets", () => ({ secrets: { assertReady: mocks.assertReady } }));

const ready = (verified: boolean) => ({
  verified,
  activeKeyId: 1,
  keys: [{ id: 1, fingerprint: "0123456789abcdef" }],
});
let logged: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.resetAllMocks();
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  logged.mockRestore();
});

describe("secrets health endpoint", () => {
  it("says yes for verified keys, and nothing else about them", async () => {
    vi.stubEnv("LOOM_SECRETS_ENVIRONMENT", "production");
    mocks.assertReady.mockResolvedValue(ready(true));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ ready: true, verified: true });
    expect(logged).not.toHaveBeenCalled();
  });

  it("accepts an unrecorded key only where the environment says it is not production", async () => {
    mocks.assertReady.mockResolvedValue(ready(false));
    for (const environment of ["development", "preview"]) {
      vi.stubEnv("LOOM_SECRETS_ENVIRONMENT", environment);
      const response = await GET();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ready: true, verified: false });
    }
    vi.stubEnv("LOOM_SECRETS_ENVIRONMENT", "production");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ ready: false });
    expect(logged).toHaveBeenLastCalledWith(
      "Secrets are not ready: the keys were not verified.",
    );
  });

  it("says no when nothing names the environment, which may be production", async () => {
    vi.stubEnv("LOOM_SECRETS_ENVIRONMENT", "");
    vi.stubEnv("VERCEL_ENV", "");
    mocks.assertReady.mockResolvedValue(ready(false));
    expect((await GET()).status).toBe(503);
    mocks.assertReady.mockResolvedValue(ready(true));
    expect((await GET()).status).toBe(200);
  });

  it("says no without the reason, which goes to the log", async () => {
    vi.stubEnv("LOOM_SECRETS_ENVIRONMENT", "production");
    mocks.assertReady.mockRejectedValue(
      new Error("LOOM_SECRETS_KEY_1 is not configured."),
    );
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"ready":false}');
    expect(logged).toHaveBeenCalledWith(
      "Secrets are not ready:",
      "LOOM_SECRETS_KEY_1 is not configured.",
    );
    mocks.assertReady.mockRejectedValue("not an error");
    expect((await GET()).status).toBe(503);
    expect(logged).toHaveBeenLastCalledWith(
      "Secrets are not ready:",
      "unknown error",
    );
  });
});
