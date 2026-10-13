import { createSecrets, staticKeyring } from "@gadicc/loom/secrets";
import { describe, expect, it, vi } from "vitest";
import { forumKeyBinding, forumKeyHint } from "./forumKeys";

vi.mock("server-only", () => ({}));

const row = {
  templeId: "temple-1",
  origin: "https://forum.example.org",
  apiUsername: "system",
};
// An obviously synthetic key: thirty-two copies of one byte.
const forumKey = createSecrets({
  keys: staticKeyring({ 1: new Uint8Array(32).fill(1) }),
}).purpose("temple-forum.api-key");

describe("forum key protection", () => {
  it("binds a key to its temple, address and username and nothing else", () => {
    expect(
      forumKeyBinding({ ...row, apiKeyHint: "cdef" } as typeof row),
    ).toEqual({
      temple: "temple-1",
      origin: "https://forum.example.org",
      username: "system",
    });
  });

  it("round-trips a key and never stores it in the clear", async () => {
    const stored = await forumKey.seal("abc123SECRET", forumKeyBinding(row));
    expect(stored).toMatch(/^ls1\.1\.[\w-]+\.[\w-]+$/);
    expect(stored).not.toContain("abc123SECRET");
    expect(await forumKey.tryOpen(stored, forumKeyBinding(row))).toBe(
      "abc123SECRET",
    );
    // A fresh nonce each time: the same key seals differently.
    expect(await forumKey.seal("abc123SECRET", forumKeyBinding(row))).not.toBe(
      stored,
    );
  });

  it("refuses a sealed key moved to another temple, address or username", async () => {
    const stored = await forumKey.seal("key", forumKeyBinding(row));
    for (const change of [
      { templeId: "temple-2" },
      { origin: "https://elsewhere.example.net" },
      { apiUsername: "someone-else" },
    ])
      expect(
        await forumKey.tryOpen(stored, forumKeyBinding({ ...row, ...change })),
      ).toBeNull();
  });

  it("shows only the last characters of a long key", () => {
    expect(forumKeyHint("0123456789abcdef")).toBe("cdef");
    expect(forumKeyHint("short")).toBe("");
  });
});
