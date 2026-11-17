/** Pure SQL construction bounds; role privileges and lock lifetime are proved on native PostgreSQL. */
import { sql } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import { researchRelationShareLock } from "./sqlRelationLock";

vi.mock("server-only", () => ({}));
it("refuses an empty or excessive relation set", () => {
  expect(() => researchRelationShareLock([])).toThrow(
    "Private relation lock unavailable",
  );
  expect(() =>
    researchRelationShareLock(
      Array.from({ length: 17 }, () => [sql`trusted_relation`, "id"] as const),
    ),
  ).toThrow("Private relation lock unavailable");
});
