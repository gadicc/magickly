import { isUuidV7 } from "../lib/ids";
import {
  type PermissionTransportAcceptance,
  parseRitualPermissionRequest,
  parseRitualPermissionResponse,
  type RitualPermissionRequestV1,
  type RitualPermissionResponseV1,
} from "./permissionContract";

/**
 * Check-only permission request: the permission and the current bundle's
 * identity, never its manifest. Like v1, the body identity is an expected
 * account binding, never proof of authentication.
 */
export interface RitualPermissionCheckRequestV2 {
  version: 2;
  requestId: string;
  expectedActorId: string;
  ritualId: string;
}

/** The current bundle's identity, as a v1 delivery would name it. */
export interface RitualBundleIdentity {
  bundleId: string;
  manifestSha256: string;
}

/** Strict server envelope for a v2 check; a v1 delivery without the manifest. */
export interface RitualPermissionCheckResponseV2 {
  version: 2;
  requestId: string;
  ownerId: string;
  ritualId: string;
  routeAlias: string | null;
  /** Exactly the v1 permission object; a denial is byte-identical. */
  permission: RitualPermissionResponseV1;
  /** Present exactly when v1 would carry a bundle for the same snapshot. */
  bundle: RitualBundleIdentity | null;
}

/**
 * A validated v2 reply. The identity was never checked against manifest
 * bytes, so it must not be recorded as proof of a verified manifest.
 */
export interface AcceptedRitualPermissionCheck {
  routeAlias: string | null;
  permission: RitualPermissionResponseV1;
  bundle: RitualBundleIdentity | null;
}

const id = (value: unknown): value is string =>
  isUuidV7(value) && value === value.toLowerCase();
const hash = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function shape(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(value).length === keys.length &&
    keys.every((key) => {
      const property = Object.getOwnPropertyDescriptor(value, key);
      return !!property?.enumerable && "value" in property;
    })
  );
}

/**
 * Strict v2 request parsing with the v1 rules. Returns the v1 request it
 * implies, which is what the permission check and its inner reply bind to.
 */
export function parseRitualPermissionCheckRequest(
  value: unknown,
): RitualPermissionRequestV1 | null {
  try {
    if (
      !shape(value, ["version", "requestId", "expectedActorId", "ritualId"]) ||
      value.version !== 2 ||
      !id(value.requestId) ||
      !id(value.expectedActorId) ||
      !id(value.ritualId)
    )
      return null;
    return {
      version: 1,
      requestId: value.requestId,
      expectedActorId: value.expectedActorId,
      ritualId: value.ritualId,
    };
  } catch {
    return null;
  }
}

/**
 * Validate a same-origin, uncached v2 reply to the v1 request that the v2 body
 * was built from. Any malformed envelope, a manifest, a bundle the permission
 * cannot carry, or an inner temporary permission becomes a temporary result,
 * which neither renews nor revokes. An invalid caller request returns null.
 */
export function parseRitualPermissionCheckResponse(
  input: RitualPermissionRequestV1,
  body: unknown,
  transport: PermissionTransportAcceptance,
  requestedRouteAlias: string | null = null,
): AcceptedRitualPermissionCheck | null {
  const request = parseRitualPermissionRequest(input);
  if (!request) return null;
  const unavailable: AcceptedRitualPermissionCheck = {
    routeAlias: null,
    permission: {
      version: 1,
      requestId: request.requestId,
      ownerId: request.expectedActorId,
      ritualId: request.ritualId,
      kind: "temporarily-unavailable",
    },
    bundle: null,
  };
  try {
    if (
      transport.status !== 200 ||
      transport.sameOrigin !== true ||
      transport.uncached !== true ||
      !shape(body, [
        "version",
        "requestId",
        "ownerId",
        "ritualId",
        "routeAlias",
        "permission",
        "bundle",
      ]) ||
      body.version !== 2 ||
      body.requestId !== request.requestId ||
      body.ownerId !== request.expectedActorId ||
      body.ritualId !== request.ritualId ||
      (body.routeAlias !== null && body.routeAlias !== requestedRouteAlias)
    )
      return unavailable;
    const permission = parseRitualPermissionResponse(
      request,
      body.permission,
      transport,
    );
    if (!permission || permission.kind === "temporarily-unavailable")
      return unavailable;
    const routeAlias =
      typeof body.routeAlias === "string" ? body.routeAlias : null;
    if (body.bundle === null) return { routeAlias, permission, bundle: null };
    const bundle = body.bundle;
    if (
      permission.kind !== "granted" ||
      permission.rendered.kind !== "available" ||
      !shape(bundle, ["bundleId", "manifestSha256"]) ||
      !id(bundle.bundleId) ||
      !hash(bundle.manifestSha256)
    )
      return unavailable;
    return {
      routeAlias,
      permission,
      bundle: {
        bundleId: bundle.bundleId,
        manifestSha256: bundle.manifestSha256,
      },
    };
  } catch {
    return unavailable;
  }
}
