import type { Routing } from "./prompt.ts";

/**
 * What the reading asks of Vercel AI Gateway and how it reads the gateway's
 * account of a call (plan 081, S1 and S5). Shared with the experiment's
 * transport (`scripts/enochian-translate-eval/transport.ts`), which step 2B
 * ran through.
 */

/** What a reply's gateway metadata says of its routing. */
export interface ReportedRouting {
  /** `providerMetadata.gateway.routing.finalProvider`: who answered. */
  provider?: string;
  /** `providerMetadata.gateway.enabledZeroDataRetention`. */
  zeroDataRetention?: boolean;
}

/** A field of `providerMetadata.gateway`. */
export function gatewayField(metadata: unknown, field: string): unknown {
  return (metadata as { gateway?: Record<string, unknown> } | undefined)
    ?.gateway?.[field];
}

/**
 * The routing a reply's metadata reports (Vercel's AI Gateway docs, "Zero
 * Data Retention" and "Provider filtering and ordering"):
 * `gateway.routing.finalProvider` names the provider that served the call,
 * and `gateway.enabledZeroDataRetention` is true when zero retention was
 * enforced. A field the metadata lacks is left out, never guessed.
 */
export function reportedRouting(metadata: unknown): ReportedRouting {
  const routing = gatewayField(metadata, "routing") as
    | { finalProvider?: unknown }
    | undefined;
  const zdr = gatewayField(metadata, "enabledZeroDataRetention");
  return {
    ...(typeof routing?.finalProvider === "string"
      ? { provider: routing.finalProvider }
      : {}),
    ...(typeof zdr === "boolean" ? { zeroDataRetention: zdr } : {}),
  };
}

/**
 * How a reply's routing falls short of what its request asked: zero
 * retention asked and not reported as enforced, or a provider other than
 * the ones allowed (or none named). Empty when it is as asked, or when
 * nothing was asked.
 */
export function routingProblems(
  asked: Routing | undefined,
  reported: ReportedRouting | undefined,
): string[] {
  const out: string[] = [];
  if (asked?.zeroDataRetention && reported?.zeroDataRetention !== true)
    out.push(
      `zero data retention asked, but the gateway reported enabledZeroDataRetention ${JSON.stringify(reported?.zeroDataRetention ?? null)}`,
    );
  if (asked?.only && !asked.only.includes(reported?.provider ?? ""))
    out.push(
      `only ${asked.only.join(", ")} allowed, but the gateway reported finalProvider ${JSON.stringify(reported?.provider ?? null)}`,
    );
  return out;
}

/**
 * The gateway's options for a sync call: caching, as every call asks, and
 * the request's routing options, if it has any.
 */
export function gatewayOptions(request: { routing?: Routing }) {
  return {
    caching: "auto" as const,
    ...(request.routing?.only ? { only: [...request.routing.only] } : {}),
    ...(request.routing?.zeroDataRetention !== undefined
      ? { zeroDataRetention: request.routing.zeroDataRetention }
      : {}),
  };
}
