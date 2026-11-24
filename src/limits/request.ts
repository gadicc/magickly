import "server-only";
import { requireBetterAuthSecret } from "@gadicc/loom/next/auth";
import { ipAddress } from "@vercel/functions";
import { clientSubject } from "./client.ts";
import { usageDay } from "./counters.ts";
import type { ClientPolicy } from "./policies.ts";

/**
 * The request's client bucket under `policy` for the UTC day `now` falls
 * in: its address as Vercel reports it, keyed by a day's key derived from
 * the auth secret (no deployment variable of its own). Only the secret is
 * read, not the rest of the auth configuration, so a route that counts
 * clients doesn't fail when another auth setting is missing.
 */
let secret: string | undefined;

export function requestClientSubject(
  request: Request,
  policy: ClientPolicy,
  now: Date,
): string {
  return clientSubject(
    // The same secret `sqlAuthOptions` reads, so the reading's buckets
    // are unchanged; read once, as its deprecation warning is.
    (secret ??= requireBetterAuthSecret()),
    policy,
    ipAddress(request),
    usageDay(now).day,
  );
}
