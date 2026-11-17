import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq, sql } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { user } from "@/db/schema/auth";
import { userProfile } from "@/db/schema/userProfile";
import { localePreferencesRepository } from "./preferencesRepository";

const harness = await createMemoryPgliteHarness({ schema });
afterAll(() => harness.client.close());
const repository = localePreferencesRepository(harness.db as never);
const a = "019a0000-0000-7000-8000-000000000101";
const b = "019a0000-0000-7000-8000-000000000102";

it("upserts only the chosen account's locale and preserves its display name", async () => {
  await harness.db.insert(user).values(
    [a, b].map((id, index) => ({
      id,
      name: "Synthetic",
      email: `example${index}@example.test`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );
  expect(await repository.read(a)).toBeNull();
  await repository.save(a, "he");
  expect(await repository.read(a)).toBe("he");
  expect(await repository.read(b)).toBeNull();
  await harness.db
    .update(userProfile)
    .set({ displayName: "Synthetic name" })
    .where(eq(userProfile.userId, a));
  await repository.save(a, "en");
  const [row] = await harness.db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, a));
  expect(row).toMatchObject({ uiLocale: "en", displayName: "Synthetic name" });
});

it("the database rejects unsupported preferences while allowing an unset value", async () => {
  await expect(
    harness.db.execute(
      sql`update user_profile set ui_locale = 'unsupported' where user_id = ${a}`,
    ),
  ).rejects.toThrow();
  await harness.db
    .update(userProfile)
    .set({ uiLocale: null })
    .where(eq(userProfile.userId, a));
  expect(await repository.read(a)).toBeNull();
});
