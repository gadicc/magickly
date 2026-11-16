/** Inactive scheduler entry. No Next route, environment reader, token generation or schedule registration. */
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { withinResearchDeadline } from "./boundedWork";
import {
  type ResearchManagedCleanupOptions,
  runResearchManagedCleanup,
} from "./managedCleanup";
import { RESEARCH_PAGE_PATH } from "./paths";
export const RESEARCH_MANAGED_CLEANUP_PATH = RESEARCH_PAGE_PATH + "/cleanup";
/** Independently adopted server settings only. A bearer token permits this one cleanup operation, never source access, answers or provider work. */
export interface ResearchManagedCleanupHttpOptions {
  readonly origin: string;
  /** A separately generated owner secret, supplied by protected configuration; never a browser or corpus credential. */
  readonly secret: () => string;
  /** Called only after a valid token. Must bind actual reviewed runtime/role/endpoint custody; matching input fields cannot attest it. */
  readonly loadOptions: (
    signal: AbortSignal,
    deadlineAt: number,
  ) => Promise<ResearchManagedCleanupOptions>;
}
const headers = {
  "cache-control": "private, no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
  vary: "Authorization",
};
const reply = (status: number, body: Record<string, string | boolean>) =>
  Response.json(body, { status, headers });
/** One authenticated GET; config loading shares the original40s work budget, followed by the runner's independent15s settlement bound. No retries or background work. */
export function createResearchManagedCleanupHttpHandler(
  options: ResearchManagedCleanupHttpOptions,
) {
  const origin = options.origin,
    expected = new URL(origin),
    secret = options.secret,
    load = options.loadOptions;
  if (secret instanceof Promise) void secret.catch(() => {});
  if (load instanceof Promise) void load.catch(() => {});
  if (
    expected.origin !== origin ||
    expected.protocol !== "https:" ||
    typeof secret !== "function" ||
    typeof load !== "function"
  )
    throw Error("Private cleanup unavailable");
  return async (request: Request): Promise<Response> => {
    const end = performance.now() + 40000;
    try {
      const u = new URL(request.url);
      if (
        request.method !== "GET" ||
        u.origin !== origin ||
        u.pathname !== RESEARCH_MANAGED_CLEANUP_PATH ||
        u.search ||
        u.hash ||
        request.headers.get("host") !== expected.host
      )
        return reply(404, { error: "Private cleanup unavailable" });
      const offered = request.headers.get("authorization"),
        match = offered && /^Bearer ([a-f0-9]{64})$/.exec(offered);
      if (!match) return reply(404, { error: "Private cleanup unavailable" });
      const wanted: unknown = secret();
      if (wanted instanceof Promise) void wanted.catch(() => {});
      if (
        typeof wanted !== "string" ||
        !/^[a-f0-9]{64}$/.test(wanted) ||
        !timingSafeEqual(
          createHash("sha256").update(match[1]).digest(),
          createHash("sha256").update(wanted).digest(),
        )
      )
        return reply(404, { error: "Private cleanup unavailable" });
      request.signal.throwIfAborted();
      const configEnd = Math.min(end, performance.now() + 8000);
      const adopted = await withinResearchDeadline(
        request.signal,
        async (signal) => await load(signal, configEnd),
        configEnd,
      );
      const result = await runResearchManagedCleanup(
        adopted,
        request.signal,
        end,
      );
      if (result.status === "healthy" || result.status === "closed")
        return reply(200, { status: result.status });
      if (result.status === "busy") return reply(202, { status: "busy" });
      return reply(503, { error: "Private cleanup unavailable" });
    } catch {
      return reply(503, { error: "Private cleanup unavailable" });
    }
  };
}
