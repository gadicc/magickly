import { isUiLocale, type UiLocale } from "./locales";

/** A single bounded, explicit action, tied to the account that made it. */
export interface PendingLocale {
  userId: string;
  locale: UiLocale;
}
export type PreferenceSyncStatus =
  | "idle"
  | "saving"
  | "failed"
  | "storage-failed";
interface Dependencies {
  read(): Promise<{ userId: string | null; locale: UiLocale | null }>;
  save(pending: PendingLocale): Promise<void>;
  pending(): PendingLocale | null;
  persist(pending: PendingLocale | null): boolean;
  apply(locale: UiLocale): void;
  status(status: PreferenceSyncStatus): void;
}

/** Serialize account writes; identity and action generations fence delayed reads/acknowledgements. */
export function createPreferenceSync(deps: Dependencies) {
  let owner: string | null | undefined;
  let verified = false;
  let generation = 0;
  let action = 0;
  let pending = deps.pending();
  let writing = false;
  let disposed = false;
  let storageFailed = false;
  const persist = () => {
    storageFailed = !deps.persist(pending);
  };
  async function drain() {
    if (writing || !verified || !owner || !pending || disposed) return;
    writing = true;
    const startingGeneration = generation;
    try {
      while (verified && pending?.userId === owner && !disposed) {
        const saving = pending;
        const version = action;
        const identity = generation;
        deps.status("saving");
        try {
          await deps.save(saving);
        } catch {
          if (identity === generation && !disposed) deps.status("failed");
          return;
        }
        if (identity !== generation || disposed) return;
        if (version === action) {
          pending = null;
          persist();
        }
      }
      deps.status(storageFailed ? "storage-failed" : "idle");
    } finally {
      writing = false;
      // A new identity may have settled while an old request was in flight.
      // It gets a fresh verification, never a queued mutation from that request.
      if (
        generation !== startingGeneration &&
        verified &&
        pending?.userId === owner &&
        !disposed
      )
        void drain();
    }
  }
  return {
    async settle(next: string | null | undefined) {
      const identity = ++generation;
      owner = next;
      verified = false;
      if (next === undefined) return; // Auth/recovery is still pending.
      if (pending && pending.userId !== next) {
        pending = null;
        persist();
      }
      deps.status(storageFailed ? "storage-failed" : "idle");
      if (!next) {
        deps.status("idle");
        return;
      }
      const version = action;
      try {
        const current = await deps.read();
        if (disposed || identity !== generation || current.userId !== next)
          return;
        verified = true;
        if (pending?.userId === next) {
          await drain();
          return;
        }
        if (version === action && isUiLocale(current.locale))
          deps.apply(current.locale);
        deps.status(storageFailed ? "storage-failed" : "idle");
      } catch {
        if (!disposed && identity === generation && pending)
          deps.status("failed");
      }
    },
    choose(locale: UiLocale) {
      if (!isUiLocale(locale) || !owner) return;
      action++;
      pending = { userId: owner, locale };
      persist();
      if (!verified) {
        deps.status("failed");
        return;
      }
      void drain();
    },
    retry() {
      return this.settle(owner);
    },
    dispose() {
      disposed = true;
      verified = false;
      generation++;
    },
  };
}
