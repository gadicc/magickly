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
  /** Defer a fresh download's grant broadcasts (see refreshOfflineRitual). */
  deferGrant?: boolean;
  /** A grant was accepted or installed without its broadcast. */
  broadcastOwed?: boolean;
  /** This operation broadcast a change (coordinator.changed()). */
  broadcast?: boolean;
  /** What happened, when the reply was accepted or nothing was needed. */
  outcome?: Exclude<OfflineFetchOutcome, "interrupted">;
  /**
   * The repository ignored the reply: another tab's check on this ritual
   * superseded this one. Reported as "interrupted", never "unavailable".
   */
  superseded?: boolean;
}

/**
 * One ritual's result in a bulk fetch: "current" means the device already
 * held the server's bundle, "unavailable" that nothing was accepted or no
 * bundle could be installed, "interrupted" that lifecycle invalidation
 * aborted it, or another tab's check on the ritual superseded it, before a
 * reply was accepted, so it may be retried.
 */
export type OfflineFetchOutcome =
  | "downloaded"
  | "current"
  | "denied"
  | "unavailable"
  | "interrupted";

/** What refreshOfflineRitual reports back when asked to. */
export interface OfflineFetchReport {
  outcome: OfflineFetchOutcome | null;
  /** Set when a deferred grant broadcast is owed: call coordinator.changed(). */
  broadcastOwed: boolean;
  /** Set when this call broadcast a change, which tells every earlier one too. */
  broadcast: boolean;
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
  const observed = progress.deferGrant ? { priorLocalState: true } : undefined;
  const binding = delivery.bundle
    ? {
        bundleId: delivery.bundle.bundleId,
        manifestSha256: delivery.bundle.manifestSha256,
        ...(delivery.routeAlias ? { routeAlias: delivery.routeAlias } : {}),
      }
    : undefined;
  const outcome = observed
    ? await runtime.repository.acceptPermission(
        pending,
        delivery.permission,
        binding,
        undefined,
        observed,
      )
    : await runtime.repository.acceptPermission(
        pending,
        delivery.permission,
        binding,
      );
  if (outcome !== "accepted") {
    progress.superseded = outcome === "ignored";
    return false;
  }
  progress.accepted = true;
  // Deferred only for a grant to a ritual this device held nothing for.
  const deferred =
    observed !== undefined &&
    !observed.priorLocalState &&
    delivery.permission.kind === "granted";
  if (deferred) progress.broadcastOwed = true;
  else {
    await runtime.coordinator.changed();
    progress.broadcast = true;
  }
  if (
    delivery.permission.kind !== "granted" ||
    !delivery.bundle ||
    operation.account.ownerId !== delivery.permission.ownerId
  ) {
    progress.outcome =
      delivery.permission.kind === "denied" ? "denied" : "unavailable";
    return delivery.permission.kind !== "temporarily-unavailable";
  }

  const existing = await runtime.repository.readBundle(
    operation.account,
    ritualId,
  );
  if (
    existing?.bundleId === delivery.bundle.bundleId &&
    existing.manifestSha256 === delivery.bundle.manifestSha256
  ) {
    progress.outcome = "current";
    return true;
  }

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
    if (installed) {
      progress.outcome = "downloaded";
      if (deferred) progress.broadcastOwed = true;
      else {
        await runtime.coordinator.changed();
        progress.broadcast = true;
      }
    }
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
 * With `grantBroadcast: "defer"` (the halls index's bulk fetch, plan 069),
 * a grant is not broadcast, at acceptance or after install, when the device
 * held nothing for the ritual (no authorization, copy or source snapshot,
 * readable or not) both before this call's first read and when the reply is
 * accepted (acceptPermission observes it in its own transaction): nothing on
 * any tab can be downgraded by it. The report's `broadcastOwed` is set instead and the
 * caller broadcasts once after its round. Every denial, and every grant to a
 * ritual the device held anything for, is still broadcast at once.
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
    /** "immediate" (the default) or "defer"; see above. */
    grantBroadcast?: "immediate" | "defer";
    /** Filled in with the outcome and whether a broadcast is owed. */
    report?: OfflineFetchReport;
  } = {},
): Promise<boolean> {
  const fetcher = options.fetcher ?? fetch;
  const routeAlias = options.routeAlias ?? null;
  let wasInterrupted = false;
  const interrupted = () => {
    wasInterrupted = true;
    try {
      options.onInterrupted?.();
    } catch {
      // Retry scheduling cannot replace the permission operation's cleanup.
    }
  };
  const operation = registration.beginPermissionCheck();
  if (!operation) return false;
  const progress: PermissionProgress = { accepted: false };
  let updated: PermissionProgress | null = null;
  try {
    const held =
      options.grantBroadcast === "defer" &&
      (await runtime.repository.holdsLocalState(operation.account, ritualId));
    const copy = await runtime.repository.readBundle(
      operation.account,
      ritualId,
    );
    progress.deferGrant = !copy && !held && options.grantBroadcast === "defer";
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
    if (outcome !== "accepted") {
      progress.superseded = outcome === "ignored";
      return false;
    }
    progress.accepted = true;
    await runtime.coordinator.changed();
    progress.broadcast = true;
    if (
      check.permission.kind !== "granted" ||
      !check.bundle ||
      operation.account.ownerId !== check.permission.ownerId
    ) {
      progress.outcome =
        check.permission.kind === "denied" ? "denied" : "unavailable";
      return check.permission.kind !== "temporarily-unavailable";
    }
    if (decision.binding) {
      progress.outcome = "current";
      return true;
    }

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
    updated = { accepted: false };
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
    if (options.report) {
      // A check another tab superseded may be retried, like an interrupted one.
      options.report.outcome =
        wasInterrupted || progress.superseded || updated?.superseded
          ? "interrupted"
          : (updated?.outcome ?? progress.outcome ?? "unavailable");
      options.report.broadcastOwed = !!progress.broadcastOwed;
      options.report.broadcast = !!(progress.broadcast || updated?.broadcast);
    }
  }
}

/** Attempts per ritual in a bulk fetch, as lifecycle start-up interrupts the first. */
export const OFFLINE_FETCH_ATTEMPTS = 3;

/**
 * A bulk fetch tells other tabs about its deferred grants at most this often,
 * so the first cards fill first (plan 069 decision 8), and once at the end.
 */
export const OFFLINE_FETCH_BROADCAST_INTERVAL_MS = 2_000;

type PinnedAccount = NonNullable<OfflineLifecycleState["account"]>;
const sameAccount = (
  state: Pick<OfflineLifecycleState, "account">,
  pinned: PinnedAccount,
) =>
  state.account?.ownerId === pinned.ownerId &&
  state.account.epoch === pinned.epoch;

/**
 * Resolves true once the coordinator is ready under the pinned account, and
 * false if aborted, disposed or the account changes first.
 */
function whenReady(
  runtime: Pick<DownloadRuntime, "subscribeState">,
  signal: AbortSignal,
  pinned: PinnedAccount,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    let done = false;
    let unsubscribe: (() => void) | null = null;
    const finish = (value: boolean) => {
      if (done) return;
      done = true;
      signal.removeEventListener("abort", aborted);
      unsubscribe?.();
      resolve(value);
    };
    const aborted = () => finish(false);
    signal.addEventListener("abort", aborted);
    unsubscribe = runtime.subscribeState((state) => {
      if (state.phase === "disposed" || !sameAccount(state, pinned))
        finish(false);
      else if (state.phase === "ready") finish(true);
    });
    if (done) unsubscribe();
  });
}

/**
 * Fetch rituals one at a time, in order, each through its own registration
 * (the halls index's temple tab, plan 069 decision 8). A ritual interrupted
 * by lifecycle invalidation before its reply was accepted is retried once
 * the coordinator is ready again, up to OFFLINE_FETCH_ATTEMPTS times.
 * `signal` stops the round between rituals; the ritual in progress finishes.
 * Each outcome is reported as it arrives.
 *
 * The round is pinned to the account and epoch it started under: once they
 * change, no permission check starts and every ritual left is reported
 * "interrupted".
 *
 * Grants of fresh downloads are not broadcast per ritual (refreshOfflineRitual's
 * "defer"), so other tabs' readers are not hidden once per ritual. Owed grants
 * are told with one broadcast once OFFLINE_FETCH_BROADCAST_INTERVAL_MS has
 * passed since the round's last broadcast, and at the end; any broadcast sent
 * meanwhile (a denial, a grant to a ritual the device held anything for)
 * settles what was owed before it.
 */
export async function fetchOfflineRituals(
  runtime: DownloadRuntime,
  rituals: readonly {
    ritualId: string;
    registration: PermissionRegistration;
  }[],
  options: {
    signal: AbortSignal;
    fetcher?: typeof fetch;
    onOutcome?: (ritualId: string, outcome: OfflineFetchOutcome) => void;
    now?: () => number;
  },
): Promise<void> {
  const now = options.now ?? Date.now;
  const report = (ritualId: string, outcome: OfflineFetchOutcome) => {
    try {
      options.onOutcome?.(ritualId, outcome);
    } catch {
      // A view's callback cannot stop the round or its broadcast.
    }
  };
  const pinned = runtime.coordinator.state.account;
  if (!pinned) {
    if (!options.signal.aborted)
      for (const { ritualId } of rituals) report(ritualId, "interrupted");
    return;
  }
  let owed = false;
  let lastBroadcastAt = now();
  const broadcast = async () => {
    owed = false;
    await runtime.coordinator.changed();
    lastBroadcastAt = now();
  };
  try {
    for (const [index, { ritualId, registration }] of rituals.entries()) {
      if (options.signal.aborted) return;
      let outcome: OfflineFetchOutcome = "interrupted";
      let accountChanged = false;
      for (let attempt = 0; attempt < OFFLINE_FETCH_ATTEMPTS; attempt++) {
        if (
          attempt > 0 &&
          !(await whenReady(runtime, options.signal, pinned))
        ) {
          accountChanged = !sameAccount(runtime.coordinator.state, pinned);
          break;
        }
        // Checked synchronously before beginPermissionCheck runs.
        if (!sameAccount(runtime.coordinator.state, pinned)) {
          accountChanged = true;
          break;
        }
        const attemptReport: OfflineFetchReport = {
          outcome: null,
          broadcastOwed: false,
          broadcast: false,
        };
        try {
          await refreshOfflineRitual(runtime, registration, ritualId, {
            ...(options.fetcher ? { fetcher: options.fetcher } : {}),
            grantBroadcast: "defer",
            report: attemptReport,
          });
        } catch {
          // Account changes and storage failures leave this ritual unfetched.
          attemptReport.outcome ??= "unavailable";
        }
        if (attemptReport.broadcast) {
          owed = false;
          lastBroadcastAt = now();
        }
        if (attemptReport.broadcastOwed) owed = true;
        // No report means no permission operation could start: not ready yet.
        outcome = attemptReport.outcome ?? "interrupted";
        if (outcome !== "interrupted") break;
      }
      report(ritualId, outcome);
      if (accountChanged) {
        for (const rest of rituals.slice(index + 1))
          report(rest.ritualId, "interrupted");
        return;
      }
      if (
        owed &&
        now() - lastBroadcastAt >= OFFLINE_FETCH_BROADCAST_INTERVAL_MS
      )
        await broadcast();
    }
  } finally {
    if (owed) await broadcast();
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
