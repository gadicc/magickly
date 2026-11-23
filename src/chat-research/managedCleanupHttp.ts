/** Inactive scheduler entry. No Next route, environment reader, token generation or schedule registration. */
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { withinResearchDeadline } from "./boundedWork";
import type { ResearchManagedCleanupOptions } from "./managedCleanup";
import { RESEARCH_PAGE_PATH } from "./paths";
export const RESEARCH_MANAGED_CLEANUP_PATH = RESEARCH_PAGE_PATH + "/cleanup";
/** Independently adopted server settings only. A bearer token permits this one cleanup operation, never source access, answers or provider work. */
export interface ResearchManagedCleanupHttpOptions {
  readonly origin: string;
  /** Explicitly adopted platform cron format; omission preserves dedicated 256-bit hex tokens. */
  readonly tokenFormat?: "hex-256" | "vercel-cron";
  /** Optional exact own Production deployment origin from trusted server metadata; platform cron only. The adopted origin remains canonical. */
  readonly deploymentOrigin?: string;
  /** A protected independently adopted server secret; never a browser or corpus credential. */
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
    tokenFormat = options.tokenFormat ?? "hex-256",
    deploymentOrigin = options.deploymentOrigin,
    deployment =
      deploymentOrigin === undefined ? null : new URL(deploymentOrigin),
    load = options.loadOptions;
  if (secret instanceof Promise) void secret.catch(() => {});
  if (load instanceof Promise) void load.catch(() => {});
  if (
    expected.origin !== origin ||
    expected.protocol !== "https:" ||
    !["hex-256", "vercel-cron"].includes(tokenFormat) ||
    (deployment !== null &&
      (tokenFormat !== "vercel-cron" ||
        deployment.origin !== deploymentOrigin ||
        deployment.protocol !== "https:" ||
        !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(
          deployment.host,
        ))) ||
    typeof secret !== "function" ||
    typeof load !== "function"
  )
    throw Error("Private cleanup unavailable");
  const tokenPattern =
    tokenFormat === "vercel-cron"
      ? /^[A-Za-z0-9._~+/=-]{16,256}$/
      : /^[a-f0-9]{64}$/;
  const validToken = (value: string) =>
    value.length <= 256 && tokenPattern.exec(value)?.[0] === value;
  return async (
    request: Request,
    inheritedWorkDeadlineAt?: number,
  ): Promise<Response> => {
    const end = Math.min(
      performance.now() + 40000,
      inheritedWorkDeadlineAt ?? Infinity,
    );
    try {
      if (
        (inheritedWorkDeadlineAt !== undefined &&
          !Number.isFinite(inheritedWorkDeadlineAt)) ||
        performance.now() >= end
      )
        throw Error();
      const u = new URL(request.url),
        host = request.headers.get("host"),
        sameTarget =
          (u.origin === origin && host === expected.host) ||
          (deployment !== null &&
            u.origin === deployment.origin &&
            host === deployment.host);
      if (
        request.method !== "GET" ||
        !sameTarget ||
        u.pathname !== RESEARCH_MANAGED_CLEANUP_PATH ||
        u.search ||
        u.hash
      )
        return reply(404, { error: "Private cleanup unavailable" });
      const offered = request.headers.get("authorization"),
        match =
          offered && offered.startsWith("Bearer ") ? offered.slice(7) : null;
      if (match === null || !validToken(match))
        return reply(404, { error: "Private cleanup unavailable" });
      const wanted: unknown = secret();
      if (wanted instanceof Promise) void wanted.catch(() => {});
      if (
        typeof wanted !== "string" ||
        !validToken(wanted) ||
        !timingSafeEqual(
          createHash("sha256").update(match).digest(),
          createHash("sha256").update(wanted).digest(),
        )
      )
        return reply(404, { error: "Private cleanup unavailable" });
      request.signal.throwIfAborted();
      const configEnd = Math.min(end, performance.now() + 8000);
      const adopted = await withinResearchDeadline(
        request.signal,
        async (signal) => {
          const { runResearchManagedCleanup } = await import(
            "./managedCleanup"
          );
          signal.throwIfAborted();
          if (performance.now() >= configEnd) throw Error();
          const options = await load(signal, configEnd);
          signal.throwIfAborted();
          if (performance.now() >= configEnd) throw Error();
          return { runResearchManagedCleanup, options };
        },
        configEnd,
      );
      const result = await adopted.runResearchManagedCleanup(
        adopted.options,
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
