"use client";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import React from "react";
import { HallGroups, type RitualStatus } from "@/app/gd/halls/HallGroups";
import { compareRituals } from "@/app/gd/halls/templeHalls";
import {
  type RitualHall,
  type RitualRow,
  ritualHalls,
} from "@/doc/ritualHalls";
import { getBrowserOfflineRuntime } from "@/offline/browserRuntime";
import type { OfflineAccount } from "@/offline/lease";
import type { OfflineOperation } from "@/offline/lifecycle";
import {
  type OfflineRecheckOutcome,
  recheckOfflineRitual,
} from "@/offline/ritualDownload";
import Link from "@/ui/Link";

/** A downloaded ritual, with its halls parsed from the same gated read. */
type Item = Readonly<{
  id: string;
  title: string;
  /**
   * The copy the halls were parsed from, by its manifest's identity, so a
   * re-read of the same copy keeps them without holding its content.
   */
  bundleId: string;
  manifestSha256: string;
  halls: readonly RitualHall[];
}>;

/**
 * How long the discovery waits for a listed copy to be read before the
 * list counts as settled: a copy the coordinator never opens is never read.
 */
const SETTLE_AFTER_MS = 2_000;

/** The halls a copy draws; none when its content cannot be read. */
function hallsOf(renderedJson: string): RitualHall[] {
  try {
    return ritualHalls(JSON.parse(renderedJson) as RitualRow);
  } catch {
    return [];
  }
}

/** Online events within this window are one reconnection. */
const ONLINE_SETTLE_MS = 2_000;

/**
 * Titles enter the DOM only through lifecycle-gated bundle reads. Opened online
 * with an account, the page rechecks, once and in sequence, each download not
 * granted within six hours, so a deleted or revoked ritual leaves the device
 * without being reopened. Other tabs hear only of denials, once per round.
 */
export default function OfflineRitualCatalog() {
  const [items, setItems] = React.useState<Item[]>([]);
  // The `#halls` jump happens once per visit, not each time the list refills.
  const hallsScrolled = React.useRef(false);
  // Every listed copy has been read, or given up on.
  const [settled, setSettled] = React.useState(false);
  const [status, setStatus] = React.useState<
    "loading" | "ready" | "locked" | "unavailable"
  >("loading");
  React.useEffect(() => {
    let disposed = false;
    let runtime: ReturnType<typeof getBrowserOfflineRuntime>;
    try {
      runtime = getBrowserOfflineRuntime();
    } catch {
      setStatus("unavailable");
      return;
    }
    let sequence = 0;
    let accountKey: string | null | undefined;
    const registrations = new Map<
      string,
      ReturnType<typeof runtime.coordinator.register>
    >();
    // Rituals still to recheck for the current account, in list order.
    let queue: string[] = [];
    let checking = false;
    let checkPending = false;
    // The discovery's copies not read yet.
    let unread = new Set<string>();
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const markRead = (ritualId: string) => {
      if (!unread.delete(ritualId) || unread.size > 0 || disposed) return;
      clearTimeout(settleTimer);
      setSettled(true);
    };

    const clear = () => {
      unread = new Set();
      clearTimeout(settleTimer);
      setSettled(false);
      for (const registration of registrations.values()) registration.dispose();
      registrations.clear();
      queue = [];
      checkPending = false;
      setItems([]);
    };
    const hideEntry = (ritualId: string) => {
      if (disposed) return;
      setItems((current) => current.filter((item) => item.id !== ritualId));
      setStatus("locked");
    };
    const drop = (ritualId: string) => {
      markRead(ritualId);
      hideEntry(ritualId);
      registrations.get(ritualId)?.dispose();
      registrations.delete(ritualId);
      if (registrations.size === 0 && !disposed) setStatus("ready");
    };
    const attemptChecks = () => {
      if (disposed || checking) return;
      if (checkPending) {
        checkPending = false;
        queue = [...registrations.keys()];
      }
      const state = runtime.coordinator.state;
      if (
        queue.length === 0 ||
        !state.account ||
        state.phase !== "ready" ||
        !navigator.onLine ||
        document.visibilityState !== "visible"
      )
        return;
      void runChecks(sequence);
    };
    // A macrotask lets the lifecycle's available() reads start, so the list renders first.
    const scheduleChecks = () => {
      setTimeout(attemptChecks, 0);
    };
    const requestChecks = () => {
      checkPending = true;
      scheduleChecks();
    };
    const runChecks = async (runSequence: number) => {
      checking = true;
      let denied = false;
      try {
        while (queue.length > 0) {
          const ritualId = queue[0];
          const registration = registrations.get(ritualId);
          let outcome: OfflineRecheckOutcome = "unchanged";
          if (registration)
            try {
              outcome = await recheckOfflineRitual(
                runtime,
                registration,
                ritualId,
              );
            } catch {
              // Storage failures leave the copy as it was, like any temporary answer.
            }
          if (disposed || runSequence !== sequence) return;
          // Lifecycle invalidation aborted it before a reply was accepted: retry when ready.
          if (outcome === "interrupted") return;
          queue.shift();
          if (outcome === "denied") {
            denied = true;
            drop(ritualId);
          }
        }
      } finally {
        checking = false;
        // One broadcast per round, only for denials, so other tabs close what
        // this device may no longer read and nothing else is invalidated.
        if (denied) void runtime.coordinator.changed();
        if (!disposed && (checkPending || queue.length > 0)) scheduleChecks();
      }
    };
    const load = async (
      account: OfflineAccount,
      ritualId: string,
      operation: OfflineOperation,
    ) => {
      try {
        const bundle = await runtime.repository.readBundle(account, ritualId);
        if (!bundle) {
          markRead(ritualId);
          return;
        }
        if (operation.signal.aborted) return;
        runtime.coordinator.commit(operation, () => {
          if (disposed) return;
          setItems((current) => {
            const previous = current.find((item) => item.id === ritualId);
            const { bundleId, manifestSha256 } = bundle;
            return [
              ...current.filter((item) => item.id !== ritualId),
              {
                id: ritualId,
                title: bundle.title,
                bundleId,
                manifestSha256,
                // The same copy keeps its halls, and drawn thumbnails.
                halls:
                  previous &&
                  previous.bundleId === bundleId &&
                  previous.manifestSha256 === manifestSha256
                    ? previous.halls
                    : hallsOf(bundle.renderedJson),
              },
            ].sort((a, b) => a.title.localeCompare(b.title));
          });
          setStatus("ready");
          markRead(ritualId);
        });
      } catch {
        markRead(ritualId);
        if (!disposed) setStatus("unavailable");
      } finally {
        runtime.coordinator.finish(operation);
      }
    };
    const discover = async (account: OfflineAccount) => {
      const currentSequence = ++sequence;
      clear();
      setStatus("loading");
      try {
        const ids = await runtime.repository.listDownloadedRitualIds(account);
        if (disposed || currentSequence !== sequence) return;
        if (ids.length === 0) setStatus("ready");
        // Registering hides each view at once ("startup"), so the copies
        // count as unread only from here.
        unread = new Set(ids);
        if (ids.length === 0) setSettled(true);
        else
          settleTimer = setTimeout(() => {
            if (disposed || currentSequence !== sequence) return;
            unread = new Set();
            setSettled(true);
          }, SETTLE_AFTER_MS);
        for (const ritualId of ids) {
          let registration: ReturnType<typeof runtime.coordinator.register>;
          registration = runtime.coordinator.register({
            ritualId,
            capability: "read",
            hide: () => hideEntry(ritualId),
            available: () => {
              const operation = registration.begin();
              if (operation) void load(account, ritualId, operation);
            },
          });
          registrations.set(ritualId, registration);
        }
        if (ids.length > 0) requestChecks();
      } catch {
        if (!disposed && currentSequence === sequence) setStatus("unavailable");
      }
    };

    const unsubscribe = runtime.subscribeState((state) => {
      const nextKey = state.account
        ? `${state.account.ownerId}:${state.account.epoch}`
        : null;
      if (nextKey === accountKey) {
        scheduleChecks();
        return;
      }
      accountKey = nextKey;
      sequence++;
      if (!state.account) {
        clear();
        setStatus("locked");
      } else void discover(state.account);
    });
    // Coming back online rechecks the downloads not checked recently,
    // once the connection has settled: flapping fires many online events.
    let onlineTimer: ReturnType<typeof setTimeout> | undefined;
    const online = () => {
      clearTimeout(onlineTimer);
      onlineTimer = setTimeout(() => {
        if (registrations.size > 0) requestChecks();
      }, ONLINE_SETTLE_MS);
    };
    window.addEventListener("online", online);
    void runtime.start().catch(() => {
      if (!disposed) setStatus("unavailable");
    });
    return () => {
      disposed = true;
      sequence++;
      queue = [];
      clearTimeout(settleTimer);
      clearTimeout(onlineTimer);
      window.removeEventListener("online", online);
      unsubscribe();
      for (const registration of registrations.values()) registration.dispose();
      registrations.clear();
    };
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        Downloaded rituals
      </Typography>
      {status === "loading" && (
        <CircularProgress aria-label="Loading downloaded rituals" />
      )}
      {status === "unavailable" && (
        <Alert severity="info">
          Downloaded rituals are unavailable on this device.
        </Alert>
      )}
      {status === "locked" && items.length === 0 && (
        <Alert severity="info">
          No verified offline account is active. Open a downloaded ritual once
          while signed in and online.
        </Alert>
      )}
      {status === "ready" && items.length === 0 && (
        <Alert severity="info">No unexpired ritual downloads were found.</Alert>
      )}
      {items.length > 0 && (
        <List aria-label="Downloaded rituals">
          {items.map((item) => (
            <ListItem key={item.id} disablePadding>
              <ListItemText
                primary={<Link href={`/doc/${item.id}`}>{item.title}</Link>}
              />
            </ListItem>
          ))}
        </List>
      )}
      <Button sx={{ mt: 2 }} onClick={() => window.location.reload()}>
        Retry
      </Button>
      {items.length > 0 && (
        <DeviceHalls items={items} settled={settled} scrolled={hallsScrolled} />
      )}
    </Box>
  );
}

/**
 * Halls on this device (plan 069, decision 9): the halls of every
 * downloaded ritual the list shows, grouped by ritual, grade rituals first.
 * They come from the list's own reads, so they go with its entries on
 * hide() and on an account change. Every link is a full navigation, which
 * the service worker serves from this shell offline. `/gd/halls` links
 * here as `#halls`; the section is complete only after the reads, too late
 * for the browser's own jump, so it scrolls itself into view once settled.
 */
function DeviceHalls({
  items,
  settled,
  scrolled,
}: {
  items: readonly Item[];
  /** Whether every listed copy has been read (or given up on). */
  settled: boolean;
  scrolled: React.RefObject<boolean>;
}) {
  const withHalls = React.useMemo(
    () => items.filter((item) => item.halls.length > 0).sort(compareRituals),
    [items],
  );
  const statuses = React.useMemo(
    () =>
      new Map<string, RitualStatus>(
        withHalls.map((item) => [
          item.id,
          { kind: "ready", halls: item.halls },
        ]),
      ),
    [withHalls],
  );
  const section = React.useRef<HTMLElement>(null);
  // Once every row above is in place; then the hash goes, so neither Back
  // nor a reload jumps again.
  React.useEffect(() => {
    if (!settled || scrolled.current) return;
    scrolled.current = true;
    if (window.location.hash !== "#halls") return;
    (section.current as HTMLElement).scrollIntoView();
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, "", pathname + search);
  }, [settled, scrolled]);
  return (
    <Box
      component="section"
      id="halls"
      ref={section}
      aria-labelledby="halls-heading"
      sx={{ mt: 4 }}
    >
      <Typography id="halls-heading" variant="h5" component="h2" sx={{ mb: 1 }}>
        Halls on this device
      </Typography>
      {withHalls.length === 0 ? (
        settled && (
          <Typography variant="body2">
            None of these rituals has a temple hall.
          </Typography>
        )
      ) : (
        <>
          <Typography variant="body2" sx={{ maxWidth: "40rem" }}>
            Every hall in the rituals downloaded here. Tap a hall to open it
            full screen, or a ritual’s name to read it.
          </Typography>
          <HallGroups
            rituals={withHalls}
            statuses={statuses}
            idPrefix="device-ritual"
            fullNavigation
          />
          <Typography variant="body2" color="textSecondary">
            East is at the top of every plan and North on the left.
          </Typography>
        </>
      )}
    </Box>
  );
}
