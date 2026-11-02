"use client";

import type { PendingPermissionCheck } from "./lease";
import type {
  OfflineLifecycleCoordinator,
  OfflineLifecycleState,
  OfflinePermissionOperation,
} from "./lifecycle";
import type {
  AcceptedBundleBinding,
  OfflineRitualRepository,
} from "./repository";
import type { AcceptedRitualPermissionCheck } from "./ritualCheckContract";
import {
  fetchRitualAsset,
  fetchRitualCheck,
  fetchRitualDelivery,
} from "./ritualClientTransport";
import type { AcceptedRitualDelivery } from "./ritualDeliveryContract";
import type { RitualBundle, StoredAsset } from "./storage";

interface PermissionRegistration {
  beginPermissionCheck(): OfflinePermissionOperation | null;
}

interface DownloadRuntime {
  repository: OfflineRitualRepository;
  coordinator: OfflineLifecycleCoordinator;
  subscribeState: (
    listener: (state: OfflineLifecycleState) => void,
  ) => () => void;
}

interface PermissionProgress {
  /** Whether this operation's permission reply has been accepted. */
  accepted: boolean;
}

function permissionRequest(pending: PendingPermissionCheck) {
  return {
    version: 1 as const,
    requestId: pending.requestId,
    expectedActorId: pending.ownerId,
    ritualId: pending.ritualId,
  };
}

/**
 * Plan 068's binding rule for a check reply and the stored copy. Returns null
 * when the reply must be treated as temporary, and otherwise the binding to
 * pass to acceptPermission, if any.
 *
 * A check's identity was never verified against manifest bytes, so it renews
 * only the copy it names, and only when the permission's rendered content is
 * that copy's. Any other identity is never recorded as a binding, because
 * installBundle trusts the checks row as proof of a verified manifest.
 */
function checkBinding(
  check: AcceptedRitualPermissionCheck,
  copy: RitualBundle | null,
): { binding?: AcceptedBundleBinding } | null {
  if (
    !check.bundle ||
    !copy ||
    copy.bundleId !== check.bundle.bundleId ||
    copy.manifestSha256 !== check.bundle.manifestSha256
  )
    return {};
  // v1 refuses such a reply when the manifest fails its descriptor check.
  // Both parsers allow a bundle only on an available grant; the first two
  // tests are defence in depth.
  if (
    check.permission.kind !== "granted" ||
    check.permission.rendered.kind !== "available" ||
    check.permission.rendered.descriptor.contentSha256 !== copy.renderedSha256
  )
    return null;
  return {
    binding: {
      bundleId: check.bundle.bundleId,
      manifestSha256: check.bundle.manifestSha256,
      ...(check.routeAlias ? { routeAlias: check.routeAlias } : {}),
    },
  };
}

/** The full v1 delivery under one permission operation, then applyDelivery. */
async function downloadOfflineRitual(
  runtime: DownloadRuntime,
  operation: OfflinePermissionOperation,
  ritualId: string,
  fetcher: typeof fetch,
  routeAlias: string | null,
  progress: PermissionProgress,
): Promise<boolean> {
  const pending = await runtime.repository.beginCheck(
    operation.account,
    ritualId,
  );
  const delivery = await fetchRitualDelivery(
    permissionRequest(pending),
    operation.signal,
    fetcher,
    routeAlias,
  );
  return await applyDelivery(
    runtime,
    operation,
    ritualId,
    fetcher,
    pending,
    delivery,
    progress,
  );
}

/**
 * Apply one verified v1 delivery for `pending`: accept the permission,
 * broadcast it, then fetch every asset and install the bundle unless the
 * stored copy already is that bundle.
 */
async function applyDelivery(
  runtime: DownloadRuntime,
  operation: OfflinePermissionOperation,
  ritualId: string,
  fetcher: typeof fetch,
  pending: PendingPermissionCheck,
  delivery: AcceptedRitualDelivery | null,
  progress: PermissionProgress,
): Promise<boolean> {
  if (!delivery || !runtime.coordinator.currentPermissionCheck(operation))
    return false;
  const binding = delivery.bundle
    ? {
        bundleId: delivery.bundle.bundleId,
        manifestSha256: delivery.bundle.manifestSha256,
        ...(delivery.routeAlias ? { routeAlias: delivery.routeAlias } : {}),
      }
    : undefined;
  const outcome = await runtime.repository.acceptPermission(
    pending,
    delivery.permission,
    binding,
  );
  if (outcome !== "accepted") return false;
  progress.accepted = true;
  await runtime.coordinator.changed();
  if (
    delivery.permission.kind !== "granted" ||
    !delivery.bundle ||
    operation.account.ownerId !== delivery.permission.ownerId
  )
    return delivery.permission.kind !== "temporarily-unavailable";

  const existing = await runtime.repository.readBundle(
    operation.account,
    ritualId,
  );
  if (
    existing?.bundleId === delivery.bundle.bundleId &&
    existing.manifestSha256 === delivery.bundle.manifestSha256
  )
    return true;

  const generation = runtime.coordinator.state.generation;
  const controller = new AbortController();
  const unsubscribe = runtime.subscribeState((state) => {
    if (
      state.generation !== generation ||
      state.account?.ownerId !== operation.account.ownerId ||
      state.account.epoch !== operation.account.epoch
    )
      controller.abort();
  });
  try {
    const manifest = delivery.bundle.manifest;
    const assets: StoredAsset[] = [];
    for (const entry of manifest.assets) {
      const blob = await fetchRitualAsset(
        operation.account.ownerId,
        ritualId,
        manifest.bundleId,
        entry,
        controller.signal,
        fetcher,
      );
      if (!blob || controller.signal.aborted) return false;
      assets.push({
        ...entry,
        ownerId: operation.account.ownerId,
        ritualId,
        bundleId: manifest.bundleId,
        blob,
      });
    }
    const bundle: RitualBundle = {
      version: 1,
      ownerId: operation.account.ownerId,
      ritualId,
      bundleId: manifest.bundleId,
      manifestSha256: delivery.bundle.manifestSha256,
      title: manifest.title,
      renderedJson: manifest.renderedJson,
      renderedSha256: manifest.descriptor.contentSha256,
      rendererFormat: "jrt-v1",
      assets: manifest.assets.map((entry) => ({ ...entry })),
      occurrences: manifest.occurrences.map((entry) => ({
        ...entry,
        path: [...entry.path],
      })),
      routeAliases: [
        ...new Set([
          ...(existing?.routeAliases ?? []),
          ...(delivery.routeAlias ? [delivery.routeAlias] : []),
        ]),
      ],
    };
    const installed = await runtime.repository.installBundle(
      pending,
      bundle,
      assets,
    );
    if (installed) await runtime.coordinator.changed();
    return installed;
  } finally {
    controller.abort();
    unsubscribe();
  }
}

/**
 * Refresh one ritual through the current account epoch. The first accepted
 * permission write is broadcast before asset I/O so denials and source-right
 * downgrades close every tab immediately.
 *
 * With a stored copy, a version 2 check comes first; the full v1 delivery
 * follows only when the server's bundle is not that copy. A server without
 * version 2 answers the check's v1 retry, and that delivery is used as is.
 */
export async function refreshOfflineRitual(
  runtime: DownloadRuntime,
  registration: PermissionRegistration,
  ritualId: string,
  options: {
    fetcher?: typeof fetch;
    routeAlias?: string;
    /**
     * Retry hint only when lifecycle invalidation aborts before a permission
     * reply is accepted: the check's, or the outdated copy's v1 delivery.
     */
    onInterrupted?: () => void;
  } = {},
): Promise<boolean> {
  const fetcher = options.fetcher ?? fetch;
  const routeAlias = options.routeAlias ?? null;
  const interrupted = () => {
    try {
      options.onInterrupted?.();
    } catch {
      // Retry scheduling cannot replace the permission operation's cleanup.
    }
  };
  const operation = registration.beginPermissionCheck();
  if (!operation) return false;
  const progress: PermissionProgress = { accepted: false };
  try {
    const copy = await runtime.repository.readBundle(
      operation.account,
      ritualId,
    );
    if (!copy)
      return await downloadOfflineRitual(
        runtime,
        operation,
        ritualId,
        fetcher,
        routeAlias,
        progress,
      );
    const pending = await runtime.repository.beginCheck(
      operation.account,
      ritualId,
    );
    const check = await fetchRitualCheck(
      permissionRequest(pending),
      operation.signal,
      fetcher,
      routeAlias,
    );
    // An old server's fallback already brought the verified manifest, so
    // today's flow runs on it under this check rather than fetching it again.
    if (check?.delivery)
      return await applyDelivery(
        runtime,
        operation,
        ritualId,
        fetcher,
        pending,
        check.delivery,
        progress,
      );
    if (!check || !runtime.coordinator.currentPermissionCheck(operation))
      return false;
    const decision = checkBinding(check, copy);
    if (!decision) return false;
    const outcome = await runtime.repository.acceptPermission(
      pending,
      check.permission,
      decision.binding,
    );
    if (outcome !== "accepted") return false;
    progress.accepted = true;
    await runtime.coordinator.changed();
    if (
      check.permission.kind !== "granted" ||
      !check.bundle ||
      operation.account.ownerId !== check.permission.ownerId
    )
      return check.permission.kind !== "temporarily-unavailable";
    if (decision.binding) return true;

    // The broadcast above aborted every permission operation, this one
    // included, so the outdated copy's delivery needs one of its own.
    const update = registration.beginPermissionCheck();
    if (
      !update ||
      update.account.ownerId !== operation.account.ownerId ||
      update.account.epoch !== operation.account.epoch
    ) {
      if (update) runtime.coordinator.finish(update);
      interrupted();
      return false;
    }
    const updated: PermissionProgress = { accepted: false };
    try {
      return await downloadOfflineRitual(
        runtime,
        update,
        ritualId,
        fetcher,
        routeAlias,
        updated,
      );
    } finally {
      if (!updated.accepted && update.signal.aborted) interrupted();
      runtime.coordinator.finish(update);
    }
  } finally {
    if (!progress.accepted && operation.signal.aborted) interrupted();
    runtime.coordinator.finish(operation);
  }
}

/**
 * What a check-only recheck did: "interrupted" means no reply was accepted
 * and it may be retried; "fresh" that a grant was accepted recently enough
 * that nothing was asked.
 */
export type OfflineRecheckOutcome =
  | "denied"
  | "granted"
  | "unchanged"
  | "fresh"
  | "interrupted";

/**
 * The Downloaded rituals list rechecks a ritual at most this often. A check
 * carries no manifest, but the server still reads and decodes each one from
 * the database, so rechecking tens of rituals on every visit would multiply
 * that load.
 */
export const OFFLINE_RECHECK_INTERVAL_MS = 6 * 60 * 60_000;

/**
 * Re-ask the server about one downloaded ritual with a version 2 check, which
 * carries no manifest, and download nothing. A validated denial locks and
 * purges the copy, a grant renews its lease (and the copy's, when the server
 * names that copy) and every temporary answer leaves the device as it was.
 * Used by the Downloaded rituals list.
 */
export async function recheckOfflineRitual(
  runtime: Pick<DownloadRuntime, "repository" | "coordinator">,
  registration: PermissionRegistration,
  ritualId: string,
  options: { fetcher?: typeof fetch; now?: () => number } = {},
): Promise<OfflineRecheckOutcome> {
  const operation = registration.beginPermissionCheck();
  if (!operation) return "interrupted";
  try {
    const last = await runtime.repository.lastGrantedAtMs(
      operation.account,
      ritualId,
    );
    const now = (options.now ?? Date.now)();
    if (
      last !== null &&
      now >= last &&
      now - last < OFFLINE_RECHECK_INTERVAL_MS
    )
      return "fresh";
    const copy = await runtime.repository.readBundle(
      operation.account,
      ritualId,
    );
    const pending = await runtime.repository.beginCheck(
      operation.account,
      ritualId,
    );
    const check = await fetchRitualCheck(
      permissionRequest(pending),
      operation.signal,
      options.fetcher ?? fetch,
    );
    if (!check || !runtime.coordinator.currentPermissionCheck(operation))
      return operation.signal.aborted ? "interrupted" : "unchanged";
    const decision = checkBinding(check, copy);
    if (!decision) return "unchanged";
    const outcome = await runtime.repository.acceptPermission(
      pending,
      check.permission,
      decision.binding,
    );
    if (outcome !== "accepted") return "unchanged";
    // Only a denial or a grant is ever accepted (lease.ts applyPermissionReply).
    // Nothing is broadcast here: the list tells other tabs once per round,
    // and only about denials, so a round of grants disturbs no open reader.
    return check.permission.kind === "denied" ? "denied" : "granted";
  } finally {
    runtime.coordinator.finish(operation);
  }
}
