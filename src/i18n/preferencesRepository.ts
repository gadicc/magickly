import { eq } from "drizzle-orm";
import type { db as appDb } from "@/db/neonFull";
import { userProfile } from "@/db/schema/userProfile";
import { isUiLocale, type UiLocale } from "./locales";

/** The app-owned profile may not exist yet for a newly registered account. */
export function localePreferencesRepository(database: typeof appDb) {
  return {
    async read(userId: string): Promise<UiLocale | null> {
      const [row] = await database
        .select({ locale: userProfile.uiLocale })
        .from(userProfile)
        .where(eq(userProfile.userId, userId));
      return isUiLocale(row?.locale) ? row.locale : null;
    },
    async save(userId: string, locale: UiLocale): Promise<void> {
      await database
        .insert(userProfile)
        .values({ userId, uiLocale: locale })
        .onConflictDoUpdate({
          target: userProfile.userId,
          set: { uiLocale: locale },
        });
    },
  };
}
