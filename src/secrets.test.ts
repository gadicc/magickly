import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { secrets, templeForumApiKey } from "./secrets";
import { forumKeyBinding } from "./temples/forumKeys";

vi.mock("server-only", () => ({}));

// An obviously synthetic key: thirty-two bytes of 0x01, in base64.
const SYNTHETIC_KEY = Buffer.alloc(32, 1).toString("base64");
const row = {
  templeId: "temple-1",
  origin: "https://forum.example.org",
  apiUsername: "u".repeat(60),
};
let warned: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warned = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("LOOM_SECRETS_ENVIRONMENT", "development");
  vi.stubEnv("LOOM_SECRETS_ACTIVE_KEY", "1");
  vi.stubEnv("LOOM_SECRETS_KEY_1", SYNTHETIC_KEY);
});
afterEach(() => {
  vi.unstubAllEnvs();
  warned.mockRestore();
});

describe("application secrets", () => {
  it("keeps purpose names, which stored values depend on", () => {
    expect(templeForumApiKey.name).toBe("temple-forum.api-key");
  });

  it("seals with the key the environment names, and is ready when it is there", async () => {
    expect(await secrets.assertReady()).toMatchObject({
      verified: false,
      activeKeyId: 1,
    });
    const sealed = await templeForumApiKey.seal("abc123", forumKeyBinding(row));
    expect(sealed).toMatch(/^ls1\.1\./);
    expect(await templeForumApiKey.tryOpen(sealed, forumKeyBinding(row))).toBe(
      "abc123",
    );
    expect(warned).not.toHaveBeenCalled();
  });

  it("fits the longest key the form accepts within its own limit and the column's", async () => {
    const longest = "k".repeat(512);
    const sealed = await templeForumApiKey.seal(longest, forumKeyBinding(row));
    // temple_forums_key_present allows 2048 characters, as does the purpose.
    expect(sealed.length).toBeLessThan(1024);
    expect(await templeForumApiKey.tryOpen(sealed, forumKeyBinding(row))).toBe(
      longest,
    );
    expect(
      await templeForumApiKey.tryOpen(`${sealed}${"A".repeat(2048)}`, {
        ...forumKeyBinding(row),
      }),
    ).toBeNull();
  });

  it("is not ready without the key the pointer names", async () => {
    vi.stubEnv("LOOM_SECRETS_ACTIVE_KEY", "2");
    await expect(secrets.assertReady()).rejects.toThrow(
      "Key version 2 is not configured",
    );
    await expect(
      templeForumApiKey.seal("abc123", forumKeyBinding(row)),
    ).rejects.toThrow(/key version 2 is not configured/i);
  });

  it("leaves a trace on the server when a stored value does not open", async () => {
    const sealed = await templeForumApiKey.seal("abc123", forumKeyBinding(row));
    expect(
      await templeForumApiKey.tryOpen(
        sealed,
        forumKeyBinding({ ...row, apiUsername: "intruder" }),
      ),
    ).toBeNull();
    // The purpose, key version and reason: never the value or what it is bound to.
    expect(warned.mock.calls).toEqual([
      [expect.any(String), "temple-forum.api-key", 1, "authentication"],
    ]);
    expect(JSON.stringify(warned.mock.calls)).not.toMatch(
      /abc123|ls1\.|temple-1|forum\.example|intruder/,
    );
  });
});
