import "server-only";
import { ipAddress } from "@vercel/functions";
import { sqlAuthOptions } from "@/auth/runtime";
import { clientSubject } from "./client.ts";
import { usageDay } from "./counters.ts";
import type { ClientPolicy } from "./policies.ts";

/**
 * The request's client bucket under `policy` for the UTC day `now` falls
 * in: its address as Vercel reports it, keyed by a day's key derived from
 * the auth secret (no deployment variable of its own).
 */
export function requestClientSubject(
  request: Request,
  policy: ClientPolicy,
  now: Date,
): string {
  return clientSubject(
    sqlAuthOptions.secret,
    policy,
    ipAddress(request),
    usageDay(now).day,
  );
}
