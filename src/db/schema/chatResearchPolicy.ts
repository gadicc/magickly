import { sql } from "drizzle-orm";
import { bigint, check, pgTable, text } from "drizzle-orm/pg-core";

/** Inactive current policy snapshots. No row is provisioned; publication requires a separate governed writer. */
export const chatResearchSourcePolicies = pgTable(
  "chat_research_source_policies",
  {
    corpusVersion: text("corpus_version").primaryKey(),
    revision: bigint("revision", { mode: "number" }).notNull().default(1),
    state: text("state")
      .$type<"draft" | "published" | "revoked">()
      .notNull()
      .default("draft"),
    policyJson: text("policy_json").notNull(),
    policySha256: text("policy_sha256").notNull(),
  },
  (t) => [
    check(
      "chat_research_source_policy_identity",
      sql`length(${t.corpusVersion})=64 and ${t.corpusVersion} ~ '^[0-9a-f]{64}$' and length(${t.policySha256})=64 and ${t.policySha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "chat_research_source_policy_revision",
      sql`${t.revision} between 1 and 9007199254740991`,
    ),
    check(
      "chat_research_source_policy_state",
      sql`${t.state} in ('draft','published','revoked')`,
    ),
    check(
      "chat_research_source_policy_bytes",
      sql`pg_catalog.octet_length(${t.policyJson}) between 1 and 8388608`,
    ),
    check(
      "chat_research_source_policy_digest",
      sql`${t.policySha256}=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(${t.policyJson},'UTF8')),'hex')`,
    ),
  ],
);
