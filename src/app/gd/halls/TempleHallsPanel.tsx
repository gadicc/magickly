"use client";

import { Alert, Button, Typography } from "@mui/material";
import React from "react";
import {
  type RitualHall,
  type RitualRow,
  ritualHalls,
} from "@/doc/ritualHalls";
import type { BrowserOfflineRuntime } from "@/offline/browserRuntime";
import type { OfflineAccount } from "@/offline/lease";
import type { OfflineOperation } from "@/offline/lifecycle";
import { fetchOfflineRituals } from "@/offline/ritualDownload";
import { HallGroups, type RitualStatus } from "./HallGroups";
import { type CatalogRitual, ignore } from "./templeHalls";
import styles from "./templeHalls.module.css";

type Registration = ReturnType<Runtime["coordinator"]["register"]>;
type Runtime = Pick<
  BrowserOfflineRuntime,
  "repository" | "coordinator" | "subscribeState"
>;

/** How long a copy on the device may take to become readable. */
const SWEEP_AFTER_MS = 2_000;

/** Whether the browser asks to save data or is offline: fetch on request only. */
function fetchOnRequestOnly(): boolean {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return connection?.saveData === true || navigator.onLine === false;
}

/**
 * One temple's tab (plan 069, decision 8, mock-ups E–F): its rituals'
 * halls grouped by ritual, read from this device's copies. Each ritual has
 * one registration with the offline coordinator; its halls are read inside
 * an operation, parsed in memory and dropped when the coordinator hides the
 * view, when the account changes and when the tab closes. Rituals not on the
 * device are fetched, all of them, in the tab's order, unless the browser
 * asks to save data or is offline; closing the tab stops the round.
 */
export default function TempleHallsPanel({
  label,
  rituals,
  runtime,
  account,
  onBusy,
}: {
  label: string;
  /** The temple's rituals with halls, in the tab's order. */
  rituals: readonly CatalogRitual[];
  runtime: Runtime;
  account: OfflineAccount;
  /** Told when a fetch round starts and ends, and false on unmount. */
  onBusy?: (busy: boolean) => void;
}) {
  const [statuses, setStatuses] = React.useState<
    ReadonlyMap<string, RitualStatus>
  >(() => new Map());
  const [fetching, setFetching] = React.useState(false);
  const fetchRef = React.useRef<() => void>(ignore);
  const busyRef = React.useRef(onBusy);
  busyRef.current = onBusy;
  const ritualKey = rituals.map((ritual) => ritual.id).join(",");
  const accountKey = `${account.ownerId}:${account.epoch}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the rituals' ids and the account, not the objects' identities.
  React.useEffect(() => {
    const ids = ritualKey.split(",").filter(Boolean);
    let disposed = false;
    const controller = new AbortController();
    const registrations = new Map<
      string,
      ReturnType<typeof runtime.coordinator.register>
    >();
    const update = (ritualId: string, next: RitualStatus) => {
      if (disposed) return;
      setStatuses((current) => {
        const map = new Map(current);
        map.set(ritualId, next);
        return map;
      });
    };
    // A hidden view's halls go; a ritual being fetched stays "fetching".
    const hide = (ritualId: string) => {
      ready.delete(ritualId);
      if (disposed) return;
      setStatuses((current) => {
        const status = current.get(ritualId);
        if (status?.kind !== "ready") return current;
        const map = new Map(current);
        map.set(ritualId, { kind: "reading" });
        return map;
      });
    };
    const load = async (
      ritualId: string,
      operation: OfflineOperation,
      final = false,
    ) => {
      try {
        const bundle = await runtime.repository.readBundle(account, ritualId);
        if (!bundle) {
          // Only a current operation may say so: commit() refuses others.
          if (final)
            runtime.coordinator.commit(operation, () =>
              update(ritualId, { kind: "unreadable" }),
            );
          return;
        }
        let halls: RitualHall[];
        try {
          halls = ritualHalls(JSON.parse(bundle.renderedJson) as RitualRow);
        } catch {
          halls = [];
        }
        runtime.coordinator.commit(operation, () => {
          ready.add(ritualId);
          update(ritualId, { kind: "ready", halls });
        });
      } catch {
        // A failed read leaves the ritual as it was.
      } finally {
        runtime.coordinator.finish(operation);
      }
    };
    const read = (ritualId: string) => {
      const operation = registrations.get(ritualId)?.begin();
      if (operation) void load(ritualId, operation);
    };
    const busy = (value: boolean) => {
      try {
        busyRef.current?.(value);
      } catch {
        // The island's bookkeeping cannot break the tab.
      }
    };
    // Rituals whose halls are shown, kept in step with hide().
    const ready = new Set<string>();
    /**
     * Rituals that should be readable by now: read each once more, and show
     * one the coordinator still will not open as not available here. Only
     * while the coordinator is ready and the page visible; otherwise they
     * are left as they are, for its next refresh.
     */
    const sweep = (ritualIds: readonly string[]) => {
      for (const ritualId of ritualIds) {
        if (
          disposed ||
          runtime.coordinator.state.phase !== "ready" ||
          document.visibilityState === "hidden"
        )
          return;
        if (ready.has(ritualId)) continue;
        const operation = registrations.get(ritualId)?.begin();
        if (operation) void load(ritualId, operation, true);
        else update(ritualId, { kind: "unreadable" });
      }
    };
    let waiting: string[] = [];
    const round = async (missing: string[]) => {
      waiting = [];
      setFetching(true);
      busy(true);
      for (const ritualId of missing) update(ritualId, { kind: "fetching" });
      // Fetched or already current: readable once the round has flushed.
      const settled: string[] = [];
      const reported = new Set<string>();
      try {
        await fetchOfflineRituals(
          runtime,
          missing.map((ritualId) => ({
            ritualId,
            registration: registrations.get(ritualId) as Registration,
          })),
          {
            signal: controller.signal,
            onOutcome: (ritualId, outcome) => {
              reported.add(ritualId);
              if (disposed) return;
              if (outcome === "denied") update(ritualId, { kind: "denied" });
              else if (outcome === "unavailable")
                update(ritualId, { kind: "failed" });
              else if (outcome === "interrupted") {
                waiting.push(ritualId);
                update(ritualId, { kind: "waiting" });
              }
              // A fresh grant is told to the coordinator at the round's next
              // flush, which makes the view available; until then the read
              // may not begin.
              else {
                settled.push(ritualId);
                read(ritualId);
              }
            },
          },
        );
        // The round's last flush has made every grant known: a copy still
        // unreadable now will not become readable by waiting.
        sweep(settled);
      } catch {
        // A round that ended abnormally leaves its unreported rituals to the
        // member's button, rather than fetching for ever.
        for (const ritualId of missing)
          if (!reported.has(ritualId)) {
            waiting.push(ritualId);
            update(ritualId, { kind: "waiting" });
          }
      } finally {
        if (!disposed) {
          setFetching(false);
          busy(false);
        }
      }
    };
    fetchRef.current = () => void round([...waiting]);

    setStatuses(
      new Map(ids.map((ritualId) => [ritualId, { kind: "reading" }])),
    );
    for (const ritualId of ids) {
      const registration = runtime.coordinator.register({
        ritualId,
        capability: "read",
        hide: () => hide(ritualId),
        available: () => read(ritualId),
      });
      registrations.set(ritualId, registration);
    }
    let sweepTimer: ReturnType<typeof setTimeout> | undefined;
    busy(true);
    void (async () => {
      try {
        const downloaded = new Set(
          await runtime.repository.listDownloadedRitualIds(account),
        );
        if (disposed) return;
        // A listed copy the coordinator never opens (incomplete assets, an
        // invalid grant…) would read for ever: look again once the
        // registrations' refresh has had time to make the others available.
        const onDevice = ids.filter((ritualId) => downloaded.has(ritualId));
        if (onDevice.length > 0)
          sweepTimer = setTimeout(() => sweep(onDevice), SWEEP_AFTER_MS);
        const missing = ids.filter((ritualId) => !downloaded.has(ritualId));
        if (missing.length === 0) return;
        if (fetchOnRequestOnly()) {
          waiting = missing;
          for (const ritualId of missing) update(ritualId, { kind: "waiting" });
          return;
        }
        await round(missing);
      } catch {
        // Storage failures leave the rituals reading.
      } finally {
        if (!disposed) busy(false);
      }
    })();
    return () => {
      disposed = true;
      clearTimeout(sweepTimer);
      busy(false);
      controller.abort();
      fetchRef.current = ignore;
      for (const registration of registrations.values()) registration.dispose();
      registrations.clear();
      // Halls are held for this account and tab only.
      setStatuses(new Map());
    };
  }, [runtime, accountKey, ritualKey]);

  const shown = rituals.filter(
    (ritual) => statuses.get(ritual.id)?.kind !== "denied",
  );
  const waitingCount = shown.filter(
    (ritual) => statuses.get(ritual.id)?.kind === "waiting",
  ).length;

  return (
    <>
      <div className={styles.intro}>
        <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
          {label}’s halls
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Every hall in the {label} rituals you can read. Tap a hall to open it
          full screen, or a ritual’s name to read it.
        </Typography>
      </div>
      {waitingCount > 0 && !fetching && (
        <Button variant="outlined" onClick={() => fetchRef.current()}>
          {waitingCount === 1
            ? "Fetch 1 ritual"
            : `Fetch ${waitingCount} rituals`}
        </Button>
      )}
      {shown.length === 0 ? (
        <Alert severity="info" sx={{ my: 2 }}>
          No rituals with halls are left in this temple for you.
        </Alert>
      ) : (
        <HallGroups
          rituals={shown}
          statuses={statuses}
          idPrefix="temple-ritual"
          offlineBadge
        />
      )}
      <Typography variant="body2" color="textSecondary">
        East is at the top of every plan and North on the left.
      </Typography>
    </>
  );
}
