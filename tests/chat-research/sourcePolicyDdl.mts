/** Exact policy migration + versioned minimal synthetic auth fixture, not a production auth migration. */
import { createHash } from "node:crypto";

const authDdl = `CREATE TABLE auth_user(id uuid PRIMARY KEY,name text NOT NULL,email text UNIQUE NOT NULL,email_verified boolean NOT NULL DEFAULT false,image text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX auth_email_case ON auth_user(lower(email));
CREATE TABLE auth_session(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,token text UNIQUE NOT NULL,expires_at timestamptz NOT NULL,ip_address text,user_agent text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE auth_account(id uuid PRIMARY KEY,provider_id text NOT NULL,account_id text NOT NULL,user_id uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,access_token text,refresh_token text,id_token text,access_token_expires_at timestamptz,refresh_token_expires_at timestamptz,scope text,password text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(provider_id,account_id));
CREATE TABLE auth_verification(id uuid PRIMARY KEY,identifier text NOT NULL,value text NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());`;
/** Relocate only the reviewed policy migration. Real-source setup keeps using the existing public identity tables; it must not create synthetic auth tables. No SQL is executed. */
export function sourcePolicyMigrationDdl(
  bytes: string,
  namespace: string,
): string {
  if (
    /^corpus_policy_[0-9a-f]{24}$/.exec(namespace)?.[0] !== namespace ||
    createHash("sha256").update(bytes).digest("hex") !==
      "b8a647a781605cfcd823a3e10be7f767e37edc846f1fc69f351c3aa78e67763a"
  )
    throw Error("LOCAL_SOURCE_POLICY_DDL_REFUSED");
  for (const [name, count] of [
    ["chat_research_source_policies", 3],
    ["chat_research_source_policy_change", 4],
  ] as const) {
    const original = `"public"."${name}"`;
    if (bytes.split(original).length !== count + 1)
      throw Error("LOCAL_SOURCE_POLICY_DDL_REFUSED");
    bytes = bytes.replaceAll(original, `"${namespace}"."${name}"`);
  }
  return bytes;
}
/** Exact policy migration plus synthetic auth fixture, retained for isolated rehearsal callers only. */
export function sourcePolicyRehearsalDdl(
  bytes: string,
  namespace: string,
): string {
  return authDdl + "\n" + sourcePolicyMigrationDdl(bytes, namespace);
}
