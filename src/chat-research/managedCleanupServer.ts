/** Dormant cleanup entry; independent opt-in and bearer gate precede private configuration and credential access. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { parseBoundedResearchJson } from "./boundedJson";
import type { ResearchManagedCleanupConnection } from "./managedCleanup";
import { readResearchManagedCleanupDeployment } from "./managedCleanupDeployment";
import { createResearchManagedCleanupHttpHandler } from "./managedCleanupHttp";

const fail: () => never = () => {
  throw Error("Private cleanup unavailable");
};
const privateShape = v.strictObject({
  schema_version: v.literal(1),
  documentJson: v.string(),
});
/** Parse only the dedicated direct cleanup login, after profile/runtime validation in the runner. Never adopts the app's ordinary DB. */
export function parseResearchManagedCleanupConnection(
  url: string,
): ResearchManagedCleanupConnection {
  try {
    if (
      typeof url !== "string" ||
      url.length > 16384 ||
      /[\s\u0000-\u001f\u007f]/u.test(url)
    )
      fail();
    const u = new URL(url),
      role = decodeURIComponent(u.username),
      password = decodeURIComponent(u.password),
      database = decodeURIComponent(u.pathname.slice(1));
    if (
      !["postgres:", "postgresql:"].includes(u.protocol) ||
      u.hash ||
      (u.port && u.port !== "5432") ||
      role !== "magickli_research_cleanup_v1" ||
      password.length !== 64 ||
      !/^[a-f0-9]{64}$/.test(password) ||
      !/^[a-z][a-z0-9_]{0,62}(?![\s\S])/.test(database) ||
      u.searchParams.getAll("sslmode").length !== 1 ||
      u.searchParams.get("sslmode") !== "verify-full" ||
      u.searchParams.getAll("channel_binding").length !== 1 ||
      u.searchParams.get("channel_binding") !== "require" ||
      [...u.searchParams.keys()].some(
        (k) => !["sslmode", "channel_binding"].includes(k),
      )
    )
      fail();
    const value = { host: u.hostname, database, role, password };
    if (
      value.host.length > 255 ||
      !/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech(?![\s\S])/.test(value.host) ||
      value.host.includes("-pooler.")
    )
      fail();
    return Object.freeze(value);
  } catch {
    return fail();
  }
}
/** One argument only: framework route context must not become an operation deadline. No handler or authority cache. */
export function createManagedResearchCleanupServer(
  env: Readonly<Record<string, string | undefined>>,
) {
  return async (request: Request): Promise<Response> => {
    const end = performance.now() + 40000;
    try {
      const d = readResearchManagedCleanupDeployment(env);
      if (!d)
        return Response.json(
          { error: "Private cleanup unavailable" },
          {
            status: 404,
            headers: {
              "cache-control": "private, no-store, max-age=0",
              "x-content-type-options": "nosniff",
              "x-robots-tag": "noindex, nofollow",
            },
          },
        );
      if (Number(process.versions.node.split(".")[0]) !== 24) fail();
      const handler = createResearchManagedCleanupHttpHandler({
        origin: d.origin,
        secret: () => env.MAGICKLI_MANAGED_CLEANUP_SECRET ?? fail(),
        loadOptions: async (signal, configEnd) => {
          signal.throwIfAborted();
          if (performance.now() >= configEnd) fail();
          const raw = env.MAGICKLI_MANAGED_CLEANUP_PRIVATE_JSON;
          if (
            typeof raw !== "string" ||
            Buffer.byteLength(raw) > 32768 ||
            createHash("sha256").update(raw).digest("hex") !==
              d.privateConfigSha256
          )
            fail();
          const config = v.parse(
            privateShape,
            parseBoundedResearchJson(raw, 32768),
          );
          signal.throwIfAborted();
          if (performance.now() >= configEnd) fail();
          return {
            documentJson: config.documentJson,
            independentlyAdoptedProfileSha256: d.profileSha256,
            independentlyAdoptedConnectionSha256: d.connectionSha256,
            independentlyAdoptedRoleOid: d.roleOid,
            managedCleanupRuntime: d.runtime,
            connection: () =>
              parseResearchManagedCleanupConnection(
                env.MAGICKLI_MANAGED_CLEANUP_DATABASE_URL ?? fail(),
              ),
          };
        },
      });
      return await handler(request, end);
    } catch {
      return Response.json(
        { error: "Private cleanup unavailable" },
        {
          status: 503,
          headers: {
            "cache-control": "private, no-store, max-age=0",
            "x-content-type-options": "nosniff",
            "x-robots-tag": "noindex, nofollow",
          },
        },
      );
    }
  };
}

/** App-owned environment only; framework route context is intentionally ignored. */
export function handleManagedResearchCleanup(
  request: Request,
): Promise<Response> {
  return createManagedResearchCleanupServer(process.env)(request);
}
