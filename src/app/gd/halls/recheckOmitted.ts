"use client";

import type { BrowserOfflineRuntime } from "@/offline/browserRuntime";
import type { OfflineAccount } from "@/offline/lease";
import type { OfflineLifecycleState } from "@/offline/lifecycle";
import {
  OFFLINE_FETCH_ATTEMPTS,
  OFFLINE_RECHECK_INTERVAL_MS,
  type OfflineRecheckOutcome,
  recheckOfflineRitual,
} from "@/offline/ritualDownload";

type Runtime = Pick<
  BrowserOfflineRuntime,
  "repository" | "coordinator" | "subscribeState"
>;

const sameAccount = (
  state: Pick<OfflineLifecycleState, "account">,
  account: OfflineAccount,
) =>
  state.account?.ownerId === account.ownerId &&
  state.account.epoch === account.epoch;

/** True once ready under `account`; false if aborted or the account changes. */
export function whenReady(
  runtime: Pick<Runtime, "subscribeState">,
  account: OfflineAccount,
  signal: AbortSignal,
): Promise<boolean> {
  return new Promise((resolve) => {
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
      if (
        signal.aborted ||
        state.phase === "disposed" ||
        !sameAccount(state, account)
      )
        finish(false);
      else if (state.phase === "ready") finish(true);
    });
    if (done) unsubscribe();
  });
}

/**
 * Removal (plan 069, decision 8): every ritual downloaded for `account`
 * that the catalog no longer lists is rechecked with
 * `recheckOfflineRitual`, which purges one the server now denies. A ritual
 * granted within OFFLINE_RECHECK_INTERVAL_MS is skipped by its metadata
 * alone, with no registration: every registration refreshes the
 * coordinator, and a new capability hides every view on the page. The
 * rest are registered in one synchronous batch, so their refreshes
 * coalesce, checked one at a time, and disposed together at the end.
 * Other tabs hear of denials once, after the round, as the Downloaded
 * rituals list does. Call it only with a catalog the server answered.
 */
export async function recheckOmittedDownloads(
  runtime: Runtime,
  account: OfflineAccount,
  listed: ReadonlySet<string>,
  signal: AbortSignal,
  now: () => number = Date.now,
): Promise<string[]> {
  const omitted = (
    await runtime.repository.listDownloadedRitualIds(account)
  ).filter((ritualId) => !listed.has(ritualId));
  const due: string[] = [];
  for (const ritualId of omitted) {
    if (signal.aborted) return [];
    const last = await runtime.repository.lastGrantedAtMs(account, ritualId);
    const at = now();
    if (last !== null && at >= last && at - last < OFFLINE_RECHECK_INTERVAL_MS)
      continue;
    due.push(ritualId);
  }
  if (
    due.length === 0 ||
    signal.aborted ||
    !sameAccount(runtime.coordinator.state, account)
  )
    return [];
  const registrations = due.map(
    (ritualId) =>
      [
        ritualId,
        runtime.coordinator.register({
          ritualId,
          capability: "read",
          hide: () => {},
          available: () => {},
        }),
      ] as const,
  );
  const denied: string[] = [];
  try {
    for (const [ritualId, registration] of registrations)
      for (let attempt = 0; attempt < OFFLINE_FETCH_ATTEMPTS; attempt++) {
        if (!(await whenReady(runtime, account, signal))) return denied;
        let outcome: OfflineRecheckOutcome = "unchanged";
        try {
          outcome = await recheckOfflineRitual(
            runtime,
            registration,
            ritualId,
            { now },
          );
        } catch {
          // Storage failures leave the copy as it was.
        }
        if (outcome === "denied") denied.push(ritualId);
        if (outcome !== "interrupted") break;
      }
    return denied;
  } finally {
    for (const [, registration] of registrations) registration.dispose();
    // One broadcast per round, only for denials.
    if (denied.length > 0) await runtime.coordinator.changed();
  }
}
