/** Dedicated managed transports only; no env, default app DB, connection or query on import. */
import "server-only";
import { createHash } from "node:crypto";
import { checkServerIdentity } from "node:tls";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const RESEARCH_MANAGED_DATABASE_ERROR =
  "Private managed database unavailable";
const fail: () => never = () => {
  throw Error(RESEARCH_MANAGED_DATABASE_ERROR);
};
const roles = [
  "magickli_research_runtime_v1",
  "magickli_corpus_reader_v1",
] as const;
/** Independently adopted native identity, not a caller-selected role or endpoint. */
export interface ResearchManagedDatabasePin {
  readonly database: string;
  readonly role: (typeof roles)[number];
  readonly roleOid: number;
  readonly endpointSha256: string;
}
/** Endpoint identity excludes secrets and has a separate purpose from local launch pins. */
export function researchManagedEndpointIdentity(input: {
  host: string;
  database: string;
  role: string;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        schema_version: 1,
        kind: "private-managed-neon-connection",
        host: input.host,
        port: 5432,
        database: input.database,
        role: input.role,
      }),
    )
    .digest("hex");
}
/** Strict direct Neon URL. URL channel_binding is not an assertion about this driver's SCRAM mechanism. */
export function parseResearchManagedDatabase(
  url: string,
  pin: ResearchManagedDatabasePin,
) {
  try {
    if (
      typeof url !== "string" ||
      url.length > 16384 ||
      url.trim() !== url ||
      /[\u0000-\u0020\u007f]/.test(url) ||
      !roles.includes(pin.role) ||
      !Number.isSafeInteger(pin.roleOid) ||
      pin.roleOid < 1 ||
      pin.roleOid > 4294967295 ||
      !/^[a-f0-9]{64}$/.test(pin.endpointSha256)
    )
      fail();
    const u = new URL(url),
      role = decodeURIComponent(u.username),
      password = decodeURIComponent(u.password),
      database = decodeURIComponent(u.pathname.slice(1)),
      host = u.hostname;
    if (
      !["postgres:", "postgresql:"].includes(u.protocol) ||
      !/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(host) ||
      host.includes("-pooler.") ||
      (u.port && u.port !== "5432") ||
      u.hash ||
      role !== pin.role ||
      database !== pin.database ||
      !/^[a-z][a-z0-9_]{0,62}$/.test(database) ||
      password.length !== 64 ||
      !/^[a-f0-9]{64}$/.test(password) ||
      u.searchParams.getAll("sslmode").length !== 1 ||
      u.searchParams.get("sslmode") !== "verify-full" ||
      u.searchParams.getAll("channel_binding").length !== 1 ||
      u.searchParams.get("channel_binding") !== "require" ||
      [...u.searchParams.keys()].some(
        (k) => !["sslmode", "channel_binding"].includes(k),
      )
    )
      fail();
    const endpointIdentity = researchManagedEndpointIdentity({
      host,
      database,
      role,
    });
    if (endpointIdentity !== pin.endpointSha256) fail();
    return Object.freeze({ host, database, role, password, endpointIdentity });
  } catch {
    return fail();
  }
}
/** Lazy dedicated TLS pool. Native role/OID/flag checks run inside the caller-owned auth/source fences.
 * The outer release owns real credential/endpoint custody and ACL adoption. This is
 * certificate/hostname verified TLS, not the libpq proof's channel-binding attestation.
 */
export function createResearchManagedDatabase(
  url: string,
  pin: ResearchManagedDatabasePin,
) {
  const captured = parseResearchManagedDatabase(url, pin);
  const client = postgres({
    host: captured.host,
    port: 5432,
    database: captured.database,
    username: captured.role,
    password: captured.password,
    ssl: {
      rejectUnauthorized: true,
      servername: captured.host,
      minVersion: "TLSv1.2",
      checkServerIdentity: (host, certificate) => {
        if (host !== captured.host)
          return Error(RESEARCH_MANAGED_DATABASE_ERROR);
        const error = checkServerIdentity(host, certificate);
        return error;
      },
    },
    max: captured.role === roles[0] ? 2 : 1,
    prepare: false,
    debug: false,
    onnotice: () => {},
    connect_timeout: 5,
    idle_timeout: 5,
    max_lifetime: 60,
    connection: {
      application_name:
        captured.role === roles[0]
          ? "magickli-managed-authority"
          : "magickli-managed-corpus",
      default_transaction_read_only: captured.role !== roles[0],
      statement_timeout: 8000,
      lock_timeout: 5000,
      idle_in_transaction_session_timeout: 8000,
    },
  });
  const database = drizzle(client);
  return Object.freeze({
    database,
    endpointIdentity: captured.endpointIdentity,
    close: () => client.end({ timeout: 1 }),
  });
}
