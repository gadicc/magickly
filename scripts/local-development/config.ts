import { RUNTIME_DATABASE_URL_ENV_NAMES } from "@gadicc/loom/db/database-url";

export const LOCAL_DEVELOPMENT_DATABASE = "magickli_dev";
export const LOCAL_DEVELOPMENT_ROLE = "magickli_dev";
export const LOCAL_DEVELOPMENT_ORIGIN = "http://localhost:3004";
const DATABASE_URL_NAMES = [
  ...RUNTIME_DATABASE_URL_ENV_NAMES,
  "MIGRATION_DATABASE_URL_UNPOOLED",
  "MIGRATION_DATABASE_URL",
] as const;

/** Refuse an acceptance, deployed, or mixed database target before any write. */
export function readLocalDevelopmentConfig(
  environment: Readonly<Record<string, string | undefined>>,
) {
  if (
    environment.MAGICKLI_LOCAL_ACCEPTANCE !== undefined ||
    (environment.NODE_ENV !== undefined &&
      environment.NODE_ENV !== "development") ||
    Object.keys(environment).some(
      (key) =>
        environment[key] !== undefined &&
        (key === "VERCEL" || key.startsWith("VERCEL_")),
    ) ||
    environment.BETTER_AUTH_URL !== LOCAL_DEVELOPMENT_ORIGIN ||
    environment.FILES_STORAGE_PROVIDER !== "minio" ||
    environment.FILES_S3_ENDPOINT !== "http://127.0.0.1:9000" ||
    environment.FILES_S3_BUCKET !== "magickly-dev" ||
    environment.LOOM_LOCAL_TEST_LOGIN !== "1"
  )
    throw new Error("LOCAL_DEVELOPMENT_CONFIG_INVALID");

  const databaseUrl = environment.DATABASE_URL_UNPOOLED;
  if (!databaseUrl || environment.DATABASE_URL !== databaseUrl)
    throw new Error("LOCAL_DEVELOPMENT_TARGET_INVALID");
  const configured = DATABASE_URL_NAMES.map((name) => environment[name]).filter(
    (value): value is string => value !== undefined,
  );
  if (configured.some((value) => value !== databaseUrl))
    throw new Error("LOCAL_DEVELOPMENT_TARGET_INVALID");
  try {
    const url = new URL(databaseUrl);
    if (
      url.protocol !== "postgresql:" ||
      url.hostname !== "db.localtest.me" ||
      url.port !== "5432" ||
      decodeURIComponent(url.username) !== LOCAL_DEVELOPMENT_ROLE ||
      decodeURIComponent(url.pathname.slice(1)) !==
        LOCAL_DEVELOPMENT_DATABASE ||
      !url.password ||
      (url.search && url.search !== "?sslmode=disable") ||
      url.hash
    )
      throw new Error();
  } catch {
    throw new Error("LOCAL_DEVELOPMENT_TARGET_INVALID");
  }
  return { databaseUrl };
}
