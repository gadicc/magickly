import { describe, expect, it, vi } from "vitest";
import {
  canStoreForumKeys,
  decryptForumKey,
  encryptForumKey,
  forumKeyHint,
} from "./forumKeys";

vi.mock("server-only", () => ({}));

const binding = { templeId: "temple-1", origin: "https://forum.example.org" };
const env = { BETTER_AUTH_SECRET: "first-secret" };

describe("forum key protection", () => {
  it("round-trips a key and never stores it in the clear", () => {
    const stored = encryptForumKey("abc123SECRET", binding, env);
    expect(stored).toMatch(/^v1\.[0-9a-f]{8}\.[\w-]+\.[\w-]+$/);
    expect(stored).not.toContain("abc123SECRET");
    expect(decryptForumKey(stored, binding, env)).toBe("abc123SECRET");
    // A fresh IV each time: the same key encrypts differently.
    expect(encryptForumKey("abc123SECRET", binding, env)).not.toBe(stored);
  });

  it("refuses a ciphertext moved to another temple or forum address", () => {
    const stored = encryptForumKey("key", binding, env);
    expect(
      decryptForumKey(stored, { ...binding, templeId: "temple-2" }, env),
    ).toBeNull();
    expect(
      decryptForumKey(
        stored,
        { ...binding, origin: "https://elsewhere.example.net" },
        env,
      ),
    ).toBeNull();
  });

  it("refuses tampered, truncated and foreign values", () => {
    const stored = encryptForumKey("key", binding, env);
    const [v, id, iv, body] = stored.split(".");
    const flipped = `${body.slice(0, -2)}${body.endsWith("AA") ? "BB" : "AA"}`;
    for (const bad of [
      `${v}.${id}.${iv}.${flipped}`,
      `${v}.${id}.${iv}.${body.slice(0, 10)}`,
      `${v}.${id}.${iv.slice(0, 4)}.${body}`,
      `v2.${id}.${iv}.${body}`,
      `${v}.${id}.${iv}`,
      "",
      "plain-text-key",
    ])
      expect(decryptForumKey(bad, binding, env)).toBeNull();
  });

  it("keeps old keys readable while the previous auth secret is still listed", () => {
    const stored = encryptForumKey("key", binding, {
      BETTER_AUTH_SECRET: "old",
    });
    const rotated = { BETTER_AUTH_SECRETS: "2:new-secret,1:old" };
    expect(decryptForumKey(stored, binding, rotated)).toBe("key");
    // New keys use the newest secret, which a server still on the old one cannot read.
    const fresh = encryptForumKey("key", binding, rotated);
    expect(decryptForumKey(fresh, binding, rotated)).toBe("key");
    expect(
      decryptForumKey(fresh, binding, { BETTER_AUTH_SECRET: "old" }),
    ).toBeNull();
    // Once the old secret is dropped the key must be entered again.
    expect(
      decryptForumKey(stored, binding, { BETTER_AUTH_SECRETS: "2:new-secret" }),
    ).toBeNull();
  });

  it("reads the realistic rotation layout: a new list with the old secret left in place", () => {
    const stored = encryptForumKey("key", binding, {
      BETTER_AUTH_SECRET: "old",
    });
    const during = { BETTER_AUTH_SECRETS: "2:new", BETTER_AUTH_SECRET: "old" };
    expect(decryptForumKey(stored, binding, during)).toBe("key");
    // New keys are made with the newest secret and still read after the old is dropped.
    const fresh = encryptForumKey("key", binding, during);
    expect(
      decryptForumKey(fresh, binding, { BETTER_AUTH_SECRETS: "2:new" }),
    ).toBe("key");
  });

  it("falls back to the deprecated secret names, as Better Auth does", () => {
    expect(canStoreForumKeys({ AUTH_SECRET: "x" })).toBe(true);
    const stored = encryptForumKey("key", binding, { NEXTAUTH_SECRET: "n" });
    expect(decryptForumKey(stored, binding, { NEXTAUTH_SECRET: "n" })).toBe(
      "key",
    );
  });

  it("needs a secret to encrypt and says whether one exists", () => {
    expect(canStoreForumKeys({})).toBe(false);
    expect(canStoreForumKeys(env)).toBe(true);
    expect(canStoreForumKeys({ BETTER_AUTH_SECRETS: "1:x" })).toBe(true);
    expect(() => encryptForumKey("key", binding, {})).toThrow();
    expect(decryptForumKey("v1.aaaaaaaa.AAAA.AAAA", binding, {})).toBeNull();
  });

  it("shows only the last characters of a long key", () => {
    expect(forumKeyHint("0123456789abcdef")).toBe("cdef");
    expect(forumKeyHint("short")).toBe("");
  });
});
