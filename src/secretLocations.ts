import "server-only";

import {
  defineSecretLocations,
  type SecretLocation,
} from "@gadicc/loom/secrets/maintenance";
import { and, asc, eq, gt } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { templeForums } from "./db/schema/discourse";
import { templeForumApiKey } from "./secrets";
import { forumKeyBinding } from "./temples/forumKeys";

/** What the maintenance operations need of the database. */
export type SecretLocationsDatabase = Pick<
  PgDatabase<PgQueryResultHKT>,
  "select" | "update"
>;

/**
 * `temple_forums.api_key_encrypted`. The binding comes from the same function
 * the forum service reads with, so a clean verify means the app can read the
 * row too. Takes the purpose so tests can supply one with a synthetic key.
 */
export function templeForumKeyLocation(
  purpose: SecretLocation<SecretLocationsDatabase>["purpose"],
): SecretLocation<SecretLocationsDatabase> {
  return {
    name: "temple_forums.api_key_encrypted",
    purpose,
    async read(db, cursor, limit) {
      const rows = await db
        .select({
          templeId: templeForums.templeId,
          origin: templeForums.forumOrigin,
          apiUsername: templeForums.apiUsername,
          sealed: templeForums.apiKeyEncrypted,
        })
        .from(templeForums)
        .where(cursor === null ? undefined : gt(templeForums.templeId, cursor))
        .orderBy(asc(templeForums.templeId))
        .limit(limit);
      return rows.map((row) => ({
        id: row.templeId,
        sealed: row.sealed,
        binding: forumKeyBinding(row),
      }));
    },
    // Only if the row still holds what was read: a key an administrator
    // replaced in the meantime, or a username they changed, wins.
    async write(db, id, expected, next) {
      const updated = await db
        .update(templeForums)
        .set({ apiKeyEncrypted: next })
        .where(
          and(
            eq(templeForums.templeId, id),
            eq(templeForums.apiKeyEncrypted, expected),
          ),
        )
        .returning({ id: templeForums.templeId });
      return updated.length === 1;
    },
  };
}

// Every column that holds a sealed string must be declared here. The
// maintenance operations (report, verify, reseal) only reach declared
// locations, so an undeclared column is never re-encrypted and keeps its old
// key in use without anyone noticing.
export const secretLocations = defineSecretLocations([
  templeForumKeyLocation(templeForumApiKey),
]);
