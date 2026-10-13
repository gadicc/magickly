import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { temples } from "./memberships";

/**
 * App-owned forum identity, never an OAuth login or an email-based account merge.
 * Readers must match the explicit forum origin before using its external ID.
 */
export const discourseUserLinks = pgTable(
  "discourse_user_links",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    forumOrigin: text("forum_origin").notNull(),
    // Discourse owns this numeric identity; it must never become a local UUID.
    discourseUserId: bigint("discourse_user_id", { mode: "number" }).notNull(),
    // Local row bookkeeping, not a claim about when the forum account was linked.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.forumOrigin] }),
    uniqueIndex("discourse_user_links_forum_account_unique").on(
      table.forumOrigin,
      table.discourseUserId,
    ),
    check(
      "discourse_user_links_external_id_safe",
      sql`${table.discourseUserId} between 1 and 9007199254740991`,
    ),
    // The planner checks canonical URL serialization too. This SQL boundary
    // prevents paths, credentials and unbounded index keys from being stored.
    check(
      "discourse_user_links_forum_origin_shape",
      sql`octet_length(${table.forumOrigin}) <= 255 and ${table.forumOrigin} ~ '^https://[a-z0-9.-]+(:[0-9]+)?$'`,
    ),
  ],
);

/**
 * A temple's own forum: where to sync its members, and the API credential to
 * do it with. Temple administrators supply it. The key is stored sealed by
 * Loom secrets (src/secrets.ts), bound to the temple, address and API username
 * (src/temples/forumKeys.ts), and never reaches a page: only a four-character
 * hint is shown back.
 * A temple without a row syncs only for global administrators, with the
 * site-wide forum credential.
 */
export const templeForums = pgTable(
  "temple_forums",
  {
    templeId: uuid("temple_id")
      .primaryKey()
      .references(() => temples.id),
    forumOrigin: text("forum_origin").notNull(),
    // Discourse takes the acting user with the key; `system` is its default admin.
    apiUsername: text("api_username").notNull(),
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    apiKeyHint: text("api_key_hint").notNull().default(""),
    updatedById: uuid("updated_by_id").references(() => user.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("temple_forums_origin_idx").on(table.forumOrigin),
    check(
      "temple_forums_origin_shape",
      sql`octet_length(${table.forumOrigin}) <= 255 and ${table.forumOrigin} ~ '^https://[a-z0-9.-]+$'`,
    ),
    check(
      "temple_forums_username_shape",
      sql`length(${table.apiUsername}) between 1 and 60 and ${table.apiUsername} ~ '^[A-Za-z0-9._-]+$'`,
    ),
    check(
      "temple_forums_key_present",
      sql`length(${table.apiKeyEncrypted}) between 1 and 2048 and length(${table.apiKeyHint}) <= 8`,
    ),
  ],
);
