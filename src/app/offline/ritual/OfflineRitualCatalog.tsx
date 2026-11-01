"use client";

import Link from "@magick-components/Link";
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
import { getBrowserOfflineRuntime } from "@/offline/browserRuntime";
import type { OfflineAccount } from "@/offline/lease";
import type { OfflineOperation } from "@/offline/lifecycle";
import {
  type OfflineRecheckOutcome,
  recheckOfflineRitual,
} from "@/offline/ritualDownload";

type Item = Readonly<{ id: string; title: string }>;

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

    const clear = () => {
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
        if (!bundle || operation.signal.aborted) return;
        runtime.coordinator.commit(operation, () => {
          if (disposed) return;
          setItems((current) =>
            [
              ...current.filter((item) => item.id !== ritualId),
              {
                id: ritualId,
                title: bundle.title,
              },
            ].sort((a, b) => a.title.localeCompare(b.title)),
          );
          setStatus("ready");
        });
      } catch {
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
    </Box>
  );
}
