import type { OfflineLifecycleState } from "../offline/lifecycle";

/** Keeps an already authorized online editor usable through cache/session checks.
 * This grants no offline read access. Every server command still authorizes its actor. */
export function retainsOnlineEditorIdentity(
  state: OfflineLifecycleState,
  expected: { ownerId: string; epoch?: string },
): boolean {
  if (
    !state.account ||
    state.account.ownerId !== expected.ownerId ||
    (expected.epoch !== undefined && state.account.epoch !== expected.epoch) ||
    state.cleanupPending ||
    state.phase === "disposed"
  )
    return false;
  if (state.phase === "ready") return true;
  if (state.revalidating) return true;
  return (
    state.lockReason !== undefined &&
    ["hidden", "resume", "change", "storage", "expiry", "clock"].includes(
      state.lockReason,
    )
  );
}
