"use client";

import { estimateHallAspect } from "@magick-components/gd/hall/aspect";
import type { HallNode } from "@magick-components/gd/hall/types";
import { Alert, Button, CircularProgress, Typography } from "@mui/material";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { GdHallFrame } from "@/doc/ritualBlocks/GdHallFrame";
import {
  type RitualHall,
  type RitualRow,
  ritualHalls,
} from "@/doc/ritualHalls";
import type { BrowserOfflineRuntime } from "@/offline/browserRuntime";
import type { OfflineAccount } from "@/offline/lease";
import type { OfflineOperation } from "@/offline/lifecycle";
import { fetchOfflineRituals } from "@/offline/ritualDownload";
import { createDrawQueue, type DrawQueue } from "./drawQueue";
import { type CatalogRitual, ignore } from "./templeHalls";
import styles from "./templeHalls.module.css";

const HallViewer = dynamic(
  () =>
    import("@/app/doc/[_id]/HallViewer").then((module) => module.HallViewer),
  { ssr: false },
);

type Registration = ReturnType<Runtime["coordinator"]["register"]>;
type Runtime = Pick<
  BrowserOfflineRuntime,
  "repository" | "coordinator" | "subscribeState"
>;

/**
 * Where one ritual's halls stand: being read from the device, fetched to
 * it, waiting for the member to fetch it (Save-Data, offline or an
 * interrupted round), failed, fetched but still not readable once the
 * round has settled, or read. A denied ritual leaves the tab.
 */
type RitualStatus =
  | { kind: "reading" }
  | { kind: "fetching" }
  | { kind: "waiting" }
  | { kind: "failed" }
  | { kind: "unreadable" }
  | { kind: "denied" }
  | { kind: "ready"; halls: readonly RitualHall[] };

/** How long a copy on the device may take to become readable. */
const SWEEP_AFTER_MS = 2_000;

/** Thumbnails drawn per animation frame. */
const THUMBNAILS_PER_FRAME = 2;
let thumbnailQueue: DrawQueue | undefined;
const thumbnails = () =>
  (thumbnailQueue ??= createDrawQueue({ perFrame: THUMBNAILS_PER_FRAME }));

const hallOf = (hall: RitualHall) => hall.row as unknown as HallNode;

/** Whether the browser asks to save data or is offline: fetch on request only. */
function fetchOnRequestOnly(): boolean {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return connection?.saveData === true || navigator.onLine === false;
}

/**
 * A hall's thumbnail, drawn only once it scrolls near the view, and then
 * through the shared queue, a few per frame. Until then it holds the
 * hall's estimated shape.
 */
function LazyHallThumbnail({ hall }: { hall: RitualHall }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [draw, setDraw] = React.useState(false);
  const aspect = React.useMemo(() => estimateHallAspect(hallOf(hall)), [hall]);
  React.useEffect(() => {
    const element = ref.current as HTMLDivElement;
    const cancels: (() => void)[] = [];
    const start = () => {
      cancels.push(thumbnails().enqueue(() => setDraw(true)));
    };
    const cancel = () => {
      for (const job of cancels) job();
    };
    if (typeof IntersectionObserver !== "function") {
      start();
      return cancel;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        start();
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancel();
    };
  }, []);
  return (
    <div
      ref={ref}
      className={styles.thumb}
      style={draw ? undefined : { aspectRatio: aspect }}
      data-drawn={draw || undefined}
      aria-hidden="true"
    >
      {draw && <GdHallFrame hall={hallOf(hall)} />}
    </div>
  );
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
  const router = useRouter();
  const [statuses, setStatuses] = React.useState<
    ReadonlyMap<string, RitualStatus>
  >(() => new Map());
  const [fetching, setFetching] = React.useState(false);
  const [viewer, setViewer] = React.useState<{
    ritualId: string;
    index: number | null;
  } | null>(null);
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
      setViewer((current) => (current?.ritualId === ritualId ? null : current));
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
    setViewer(null);
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
      setViewer(null);
    };
  }, [runtime, accountKey, ritualKey]);

  const shown = rituals.filter(
    (ritual) => statuses.get(ritual.id)?.kind !== "denied",
  );
  const waitingCount = shown.filter(
    (ritual) => statuses.get(ritual.id)?.kind === "waiting",
  ).length;
  const viewing = viewer ? statuses.get(viewer.ritualId) : undefined;
  const viewingHalls =
    viewing?.kind === "ready" && viewing.halls.length > 0
      ? viewing.halls
      : null;

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
        <div className={styles.groups}>
          {shown.map((ritual) => {
            const status = statuses.get(ritual.id) ?? { kind: "reading" };
            const headingId = `temple-ritual-${ritual.id}`;
            return (
              <section
                key={ritual.id}
                aria-labelledby={headingId}
                className={styles.group}
              >
                <h3>
                  <Link
                    id={headingId}
                    href={`/doc/${ritual.id}`}
                    prefetch={false}
                  >
                    {ritual.title}
                  </Link>
                  {status.kind === "ready" && (
                    <Typography
                      component="span"
                      variant="caption"
                      color="success"
                    >
                      ✓ offline
                    </Typography>
                  )}
                </h3>
                <ul className={styles.halls}>
                  {status.kind === "ready" ? (
                    status.halls.map((hall, index) => (
                      <li key={hall.ordinal}>
                        <button
                          type="button"
                          aria-describedby={headingId}
                          className={styles.card}
                          onClick={() =>
                            setViewer({ ritualId: ritual.id, index })
                          }
                        >
                          <LazyHallThumbnail hall={hall} />
                          <Typography
                            component="span"
                            variant="inherit"
                            color="primary"
                            className={styles.name}
                          >
                            {hall.name}
                          </Typography>
                          {hall.context && (
                            <span className={styles.context}>
                              {hall.context}
                            </span>
                          )}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li>
                      <div className={styles.placeholder}>
                        {status.kind === "fetching" ? (
                          <span>
                            <CircularProgress
                              size={16}
                              aria-hidden="true"
                              sx={{ display: "block", mx: "auto", mb: 1 }}
                            />
                            Fetching this ritual to this device…
                          </span>
                        ) : status.kind === "waiting" ? (
                          "Not on this device yet."
                        ) : status.kind === "failed" ? (
                          "This ritual could not be fetched."
                        ) : status.kind === "unreadable" ? (
                          <span>
                            Not available on this device.{" "}
                            <Link href={`/doc/${ritual.id}`} prefetch={false}>
                              Open the ritual
                            </Link>
                          </span>
                        ) : (
                          <CircularProgress
                            size={16}
                            aria-label={`Reading ${ritual.title}`}
                          />
                        )}
                      </div>
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <Typography variant="body2" color="textSecondary">
        East is at the top of every plan and North on the left.
      </Typography>
      {viewer && viewingHalls && (
        <HallViewer
          halls={viewingHalls}
          index={viewer.index}
          onIndexChange={(index) =>
            setViewer({ ritualId: viewer.ritualId, index })
          }
          onClose={() => setViewer({ ritualId: viewer.ritualId, index: null })}
          onGoTo={(hall) =>
            router.push(`/doc/${viewer.ritualId}#hall-${hall.ordinal}`)
          }
        />
      )}
    </>
  );
}
