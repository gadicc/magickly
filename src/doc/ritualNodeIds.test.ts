import { describe, expect, it } from "vitest";
import { createUuidV7 } from "../lib/ids";
import { createRitualNodeId, isRitualNodeId } from "./ritualNodeIds";

describe("ritual node identities", () => {
  it("generates exactly 16 alphanumeric characters", () => {
    const id = createRitualNodeId();
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
    expect(isRitualNodeId(id)).toBe(true);
  });

  it("accepts both cases and canonical existing UUIDv7s", () => {
    expect(isRitualNodeId("Ab3k9Qp7Zx2Mn5Rs")).toBe(true);
    expect(isRitualNodeId("ab3k9qp7zx2mn5rs")).toBe(true);
    const uuid = createUuidV7();
    expect(isRitualNodeId(uuid)).toBe(true);
    expect(isRitualNodeId(uuid.toUpperCase())).toBe(false);
  });

  it.each([
    null,
    123,
    "Ab3k9Qp7Zx2Mn5R",
    "Ab3k9Qp7Zx2Mn5Rss",
    "Ab3k9Qp7Zx2Mn5R-",
    "Ab3k9Qp7Zx2Mn5R_",
    "Ab3k9Qp7Zx2Mn5Rs\n",
    "Ab3k9Qp7Zx2Mn5Ré",
    "01995000-0000-4000-8000-000000000005",
  ])("rejects unsupported identity %j", (id) => {
    expect(isRitualNodeId(id)).toBe(false);
  });
});
