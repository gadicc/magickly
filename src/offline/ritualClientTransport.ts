"use client";

import { isUuidV7 } from "../lib/ids";
import { exactResponse } from "./exactResponse";
import {
  parseRitualPermissionRequest,
  type RitualPermissionRequestV1,
} from "./permissionContract";
import {
  RITUAL_BUNDLE_MANIFEST_LIMITS,
  type RitualBundleManifestV1,
} from "./ritualBundleManifest";
import {
  type AcceptedRitualPermissionCheck,
  parseRitualPermissionCheckResponse,
} from "./ritualCheckContract";
import {
  type AcceptedRitualDelivery,
  parseRitualDeliveryResponse,
} from "./ritualDeliveryContract";

const DELIVERY_PATH = "/api/rituals/permission";
const MAX_DELIVERY_BYTES = 17 * 1024 * 1024;
const MAX_CHECK_BYTES = 64 * 1024;
/** What a server that predates version 2 answers a v2 body with. */
const INVALID_REQUEST_BODY = '{"error":"invalid-request"}';

async function boundedText(response: Response, limit: number): Promise<string> {
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit))
    throw new Error("Response too large");
  if (!response.body) throw new Error("Missing response body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > limit) throw new Error("Response too large");
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

/** POST one permission body; `exact` holds the same-origin, uncached JSON rules. */
async function postPermission(
  body: object,
  signal: AbortSignal,
  fetcher: typeof fetch,
  routeAlias: string | null,
): Promise<{ response: Response; exact: boolean }> {
  const response = await fetcher(DELIVERY_PATH, {
    method: "POST",
    credentials: "same-origin",
    redirect: "error",
    cache: "no-store",
    signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(routeAlias ? { "X-Magickli-Ritual-Alias": routeAlias } : {}),
    },
    body: JSON.stringify(body),
  });
  const mediaType = response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  return {
    response,
    exact:
      exactResponse(response, DELIVERY_PATH) &&
      mediaType === "application/json",
  };
}

/** Fetch and validate the one permission/manifest envelope; failures do not revoke. */
export async function fetchRitualDelivery(
  request: RitualPermissionRequestV1,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
  routeAlias: string | null = null,
): Promise<AcceptedRitualDelivery | null> {
  const input = parseRitualPermissionRequest(request);
  if (!input) return null;
  try {
    const { response, exact } = await postPermission(
      input,
      signal,
      fetcher,
      routeAlias,
    );
    const body = exact
      ? JSON.parse(await boundedText(response, MAX_DELIVERY_BYTES))
      : null;
    return parseRitualDeliveryResponse(
      input,
      body,
      {
        status: response.status,
        sameOrigin: exact,
        uncached: exact,
      },
      routeAlias,
    );
  } catch {
    return parseRitualDeliveryResponse(
      input,
      null,
      {
        status: 0,
        sameOrigin: false,
        uncached: false,
      },
      routeAlias,
    );
  }
}

/**
 * Set for the page's lifetime once a server answered a v2 check with
 * `invalid-request` and the v1 retry with a reply that parsed, so later
 * checks go straight to v1 and a round of rechecks pays one request per
 * ritual.
 */
let checkUnsupported = false;

/** Test-only: forget that the server lacked version 2 checks. */
export function resetRitualCheckSupportForTests(): void {
  checkUnsupported = false;
}

/**
 * A check result. After a fallback to v1 it also carries that verified
 * delivery, so a caller that needs the manifest does not fetch it again;
 * `bundle` is still the identity alone.
 */
export interface RitualCheckResult extends AcceptedRitualPermissionCheck {
  delivery?: AcceptedRitualDelivery;
}

/**
 * A v1 delivery as a check result. Its identity was verified against the
 * manifest bytes, but `bundle` is kept only as the fallback's result.
 */
async function checkByDelivery(
  input: RitualPermissionRequestV1,
  signal: AbortSignal,
  fetcher: typeof fetch,
  routeAlias: string | null,
): Promise<RitualCheckResult | null> {
  const delivery = await fetchRitualDelivery(
    input,
    signal,
    fetcher,
    routeAlias,
  );
  if (!delivery) return null;
  return {
    routeAlias: delivery.routeAlias,
    permission: delivery.permission,
    bundle: delivery.bundle
      ? {
          bundleId: delivery.bundle.bundleId,
          manifestSha256: delivery.bundle.manifestSha256,
        }
      : null,
    delivery,
  };
}

/**
 * Fetch the permission and the current bundle's identity without its
 * manifest (a version 2 check); failures do not revoke. `request` is the v1
 * request the check stands for, which the inner permission is bound to.
 *
 * A server that predates version 2 answers exactly 400 `invalid-request`;
 * only then is the v1 request sent once, with the same request ID. Its
 * reply comes back as `delivery` beside the permission and identity. The
 * identity is never proof of manifest bytes the caller holds.
 */
export async function fetchRitualCheck(
  request: RitualPermissionRequestV1,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
  routeAlias: string | null = null,
): Promise<RitualCheckResult | null> {
  const input = parseRitualPermissionRequest(request);
  if (!input) return null;
  if (checkUnsupported)
    return checkByDelivery(input, signal, fetcher, routeAlias);
  try {
    const { response, exact } = await postPermission(
      { ...input, version: 2 },
      signal,
      fetcher,
      routeAlias,
    );
    const text = exact ? await boundedText(response, MAX_CHECK_BYTES) : null;
    if (
      response.status === 400 &&
      text === INVALID_REQUEST_BODY &&
      !signal.aborted
    ) {
      const fallback = await checkByDelivery(
        input,
        signal,
        fetcher,
        routeAlias,
      );
      // Only a parsed v1 reply proves the server lacks v2. A new server's
      // genuine 400, such as an alias mismatch, fails the retry as well.
      if (fallback && fallback.permission.kind !== "temporarily-unavailable")
        checkUnsupported = true;
      return fallback;
    }
    return parseRitualPermissionCheckResponse(
      input,
      text === null ? null : JSON.parse(text),
      {
        status: response.status,
        sameOrigin: exact,
        uncached: exact,
      },
      routeAlias,
    );
  } catch {
    return parseRitualPermissionCheckResponse(
      input,
      null,
      {
        status: 0,
        sameOrigin: false,
        uncached: false,
      },
      routeAlias,
    );
  }
}

async function sha256(blob: Blob): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function assetBlob(
  response: Response,
  bytes: number,
  mime: string,
  signal: AbortSignal,
): Promise<Blob | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (signal.aborted || size > bytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(Uint8Array.from(next.value).buffer);
    }
    return size === bytes && !signal.aborted
      ? new Blob(chunks, { type: mime })
      : null;
  } finally {
    reader.releaseLock();
  }
}

/** Fetch one exact manifest member. Original ritual URLs are never network inputs here. */
export async function fetchRitualAsset(
  ownerId: string,
  ritualId: string,
  bundleId: string,
  asset: RitualBundleManifestV1["assets"][number],
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Blob | null> {
  const canonical = (value: unknown): value is string =>
    typeof value === "string" &&
    isUuidV7(value) &&
    value === value.toLowerCase();
  if (
    !canonical(ownerId) ||
    !canonical(ritualId) ||
    !canonical(bundleId) ||
    !canonical(asset.key) ||
    !/^[a-f0-9]{64}$/.test(asset.sha256) ||
    ![
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ].includes(asset.mime) ||
    !Number.isSafeInteger(asset.bytes) ||
    asset.bytes < 1 ||
    asset.bytes >
      (asset.mime === "image/svg+xml"
        ? RITUAL_BUNDLE_MANIFEST_LIMITS.svgBytes
        : RITUAL_BUNDLE_MANIFEST_LIMITS.rasterBytes) ||
    asset.purpose !== "read"
  )
    return null;
  const path = `/api/rituals/assets/${ritualId}/${bundleId}/${asset.key}`;
  try {
    const response = await fetcher(path, {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      cache: "no-store",
      signal,
      headers: {
        Accept: asset.mime,
        "X-Magickli-Expected-Actor": ownerId,
      },
    });
    if (
      response.status !== 200 ||
      !exactResponse(response, path) ||
      response.headers.get("content-type") !== asset.mime ||
      // Fetch decodes gzip/br bodies, while Content-Length may still describe
      // their wire representation. Bound and hash the decoded bytes below.
      (response.headers.get("content-encoding") === null &&
        response.headers.get("content-length") !== String(asset.bytes)) ||
      response.headers.get("x-content-sha256") !== asset.sha256
    )
      return null;
    const blob = await assetBlob(response, asset.bytes, asset.mime, signal);
    if (
      !blob ||
      signal.aborted ||
      blob.size !== asset.bytes ||
      blob.type !== asset.mime ||
      (await sha256(blob)) !== asset.sha256
    )
      return null;
    return blob;
  } catch {
    return null;
  }
}
