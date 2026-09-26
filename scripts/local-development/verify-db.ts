import { lookup } from "node:dns/promises";
import postgres from "postgres";
import {
  LOCAL_DEVELOPMENT_DATABASE,
  LOCAL_DEVELOPMENT_ROLE,
  readLocalDevelopmentConfig,
} from "./config";

/** Check the authenticated target, including owner and role privileges. */
export async function verifyLocalDevelopmentDatabase(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const { databaseUrl } = readLocalDevelopmentConfig(environment);
  const addresses = await lookup("db.localtest.me", { all: true }).catch(
    () => [],
  );
  if (
    !addresses.length ||
    addresses.some(
      ({ address }) => address !== "127.0.0.1" && address !== "::1",
    )
  )
    throw new Error("LOCAL_DEVELOPMENT_TARGET_MISMATCH");
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const [identity] = await sql<
      {
        database: string;
        role: string;
        owner: string;
        superuser: boolean;
        canCreateDb: boolean;
        canCreateRole: boolean;
      }[]
    >`select current_database() as database, current_user as role,
      (select pg_get_userbyid(datdba) from pg_database where datname = current_database()) as owner,
      (select rolsuper from pg_roles where rolname = current_user) as superuser,
      (select rolcreatedb from pg_roles where rolname = current_user) as "canCreateDb",
      (select rolcreaterole from pg_roles where rolname = current_user) as "canCreateRole"`;
    if (
      identity?.database !== LOCAL_DEVELOPMENT_DATABASE ||
      identity.role !== LOCAL_DEVELOPMENT_ROLE ||
      identity.owner !== LOCAL_DEVELOPMENT_ROLE ||
      identity.superuser ||
      identity.canCreateDb ||
      identity.canCreateRole
    )
      throw new Error("LOCAL_DEVELOPMENT_TARGET_MISMATCH");
  } finally {
    await sql.end({ timeout: 1 });
  }
}

if (process.argv[1]?.endsWith("/verify-db.ts")) {
  verifyLocalDevelopmentDatabase(process.env)
    .then(() => console.log("LOCAL_DEVELOPMENT_DATABASE_VERIFIED"))
    .catch(() => {
      console.error("LOCAL_DEVELOPMENT_DATABASE_VERIFICATION_FAILED");
      process.exitCode = 1;
    });
}
