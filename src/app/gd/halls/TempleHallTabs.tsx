"use client";

import { Alert, Box, Tab, Tabs, Typography } from "@mui/material";
import dynamic from "next/dynamic";
import React from "react";
import { useSession } from "@/auth/client";
import {
  type BrowserOfflineRuntime,
  getBrowserOfflineRuntime,
} from "@/offline/browserRuntime";
import type { OfflineAccount } from "@/offline/lease";
import { recheckOmittedDownloads } from "./recheckOmitted";
import {
  type CatalogRitual,
  chooseTab,
  hashTemple,
  ignore,
  parseCatalog,
  type RememberedTab,
  templeHash,
  templeNames,
  templeRituals,
  templeTabs,
} from "./templeHalls";

/** Loaded only for a signed-in member with a temple tab open. */
const TempleHallsPanel = dynamic(() => import("./TempleHallsPanel"), {
  ssr: false,
});

/** The Standard tab's value: no temple slug contains a NUL. */
const STANDARD = "\0standard";

/**
 * What the catalog said: its rituals; "offline" when it could not be
 * reached (no network, or no reply); "unavailable" when the server could not
 * list them (503) or the reply was unreadable. Only "ready" is acted on.
 */
type Catalog =
  | { kind: "ready"; rituals: readonly CatalogRitual[] }
  | { kind: "offline" }
  | { kind: "unavailable" }
  | { kind: "signed-out" };

async function fetchCatalog(signal: AbortSignal): Promise<Catalog> {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return { kind: "offline" };
  let response: Response;
  try {
    response = await fetch("/api/rituals/catalog", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch {
    return { kind: "offline" };
  }
  if (response.status === 401) return { kind: "signed-out" };
  if (response.status !== 200) return { kind: "unavailable" };
  try {
    const rituals = parseCatalog(await response.json());
    return rituals ? { kind: "ready", rituals } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Remove a `#temple=…` from the address, if there is one. */
function clearTempleHash() {
  if (hashTemple(window.location.hash) !== null) writeHash(null);
}

/** Replace the hash without a history entry, keeping the router's state. */
function writeHash(slug: string | null) {
  const { pathname, search } = window.location;
  window.history.replaceState(
    window.history.state,
    "",
    slug === null
      ? `${pathname}${search}`
      : `${pathname}${search}${templeHash(slug)}`,
  );
}

/**
 * The temple tabs of `/gd/halls` (plan 069, decision 7, mock-ups E–F).
 * `children`, the page's static content, is the Standard tab and is all
 * the server renders. Only once the client session says signed in does the
 * island activate the offline account, ask for the catalog and show a tab
 * per temple with halls; signed out it calls no endpoint at all.
 *
 * The catalog's rituals, the halls and the remembered tab stay in memory
 * and are dropped when the offline account changes or the page closes;
 * the remembered tab itself lives in the offline database, per account.
 */
export default function TempleHallTabs({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = useSession();
  const userId = session.isPending ? null : (session.data?.user.id ?? null);
  const baseId = React.useId();
  const [runtime, setRuntime] = React.useState<BrowserOfflineRuntime | null>(
    null,
  );
  const [account, setAccount] = React.useState<OfflineAccount | null>(null);
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  // undefined until the open tab is chosen; null is Standard.
  const [tab, setTab] = React.useState<string | null | undefined>(undefined);
  const [known, setKnown] = React.useState<readonly string[]>([]);

  // The open temple's tab is told when its fetch round ends.
  const busyRef = React.useRef<(busy: boolean) => void>(ignore);
  // Signing out on this page takes the temple out of the address.
  const signedInBefore = React.useRef(false);
  React.useEffect(() => {
    if (userId) signedInBefore.current = true;
    else if (signedInBefore.current && !session.isPending) {
      signedInBefore.current = false;
      clearTempleHash();
    }
  }, [userId, session.isPending]);

  React.useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let controller = new AbortController();
    let current: BrowserOfflineRuntime | null = null;
    try {
      current = getBrowserOfflineRuntime();
    } catch {
      current = null;
    }
    const offlineRuntime = current;
    let accountKey: string | null | undefined;
    let activeAccount: OfflineAccount | null = null;
    let started = false;
    let knownTemples: readonly string[] = [];
    let lastKind: Catalog["kind"] | null = null;
    // The omitted-download recheck waits for the open tab's fetch round:
    // its registrations refresh the coordinator, which hides every view.
    let recheck: (() => void) | null = null;
    let panelBusy = false;
    const startRecheck = () => {
      if (panelBusy || !recheck) return;
      const run = recheck;
      recheck = null;
      run();
    };
    busyRef.current = (busy) => {
      panelBusy = busy;
      // After the commit: a tab closing is told before the next one opens.
      if (!busy) setTimeout(() => !disposed && startRecheck(), 0);
    };

    const reset = () => {
      controller.abort();
      controller = new AbortController();
      knownTemples = [];
      lastKind = null;
      recheck = null;
      panelBusy = false;
      setCatalog(null);
      setTab(undefined);
      setKnown([]);
    };
    const show = (next: Catalog, temples: readonly string[]) => {
      knownTemples = temples;
      lastKind = next.kind;
      setKnown(temples);
      setCatalog(next);
    };
    /** Read the catalog, then choose the tab and recheck omitted downloads. */
    const load = async () => {
      const { signal } = controller;
      const next = await fetchCatalog(signal);
      if (disposed || signal.aborted) return;
      const forAccount = activeAccount;
      let remembered: RememberedTab = null;
      if (offlineRuntime && forAccount)
        try {
          remembered = await offlineRuntime.repository.readHallsTab(forAccount);
        } catch {
          remembered = null;
        }
      if (disposed || signal.aborted) return;
      const hash = hashTemple(window.location.hash);
      if (next.kind === "ready") {
        const temples = templeTabs(next.rituals);
        const choice = chooseTab({ temples, hash, remembered });
        if (choice.forget && offlineRuntime && forAccount)
          void offlineRuntime.repository
            .clearHallsTab(forAccount)
            .catch(ignore);
        show(next, temples);
        // A temple tab's panel reports when its round is done.
        panelBusy = choice.tab !== null && !!forAccount;
        setTab(choice.tab);
        if (choice.tab !== hash) writeHash(choice.tab);
        if (offlineRuntime && forAccount && navigator.onLine !== false) {
          recheck = () =>
            void recheckOmittedDownloads(
              offlineRuntime,
              forAccount,
              new Set(next.rituals.map((ritual) => ritual.id)),
              signal,
            ).catch(ignore);
          startRecheck();
        }
      } else if (next.kind === "offline" || next.kind === "unavailable") {
        // No catalog: the temples this device knows of, with no halls.
        const rememberedSlug =
          remembered && "slug" in remembered ? remembered.slug : null;
        const temples = [
          ...new Set([hash, rememberedSlug].filter((slug) => slug !== null)),
        ];
        show(next, temples);
        setTab(hash !== null ? hash : (temples[0] ?? null));
      } else {
        show(next, []);
        setTab(null);
      }
    };

    const unsubscribe = offlineRuntime
      ? offlineRuntime.subscribeState((state) => {
          // Another owner's device account is no account for this session.
          const own = state.account?.ownerId === userId ? state.account : null;
          const nextKey = own ? `${own.ownerId}:${own.epoch}` : null;
          if (nextKey === accountKey) return;
          const previous = accountKey;
          accountKey = nextKey;
          activeAccount = own ? { ...own } : null;
          setAccount(activeAccount);
          if (previous === undefined) return;
          // Another account's (or no account's) catalog and halls go at once;
          // an account that appears later reloads them, remembered tab and
          // recheck included.
          reset();
          if (!nextKey) clearTempleHash();
          else if (started) void load();
        })
      : () => {};
    setRuntime(offlineRuntime);

    // Back online after the catalog could not be reached: ask again.
    const online = () => {
      if (started && lastKind === "offline") {
        reset();
        void load();
      }
    };
    window.addEventListener("online", online);
    // A link on the page to another temple's tab opens it.
    const hashChange = () => {
      const slug = hashTemple(window.location.hash);
      if (slug !== null && knownTemples.includes(slug)) setTab(slug);
    };
    window.addEventListener("hashchange", hashChange);

    void (async () => {
      if (offlineRuntime)
        try {
          await offlineRuntime.start();
          if (disposed) return;
          await offlineRuntime.refreshVerifiedAccount();
        } catch {
          // The tabs still show; their halls say the device cannot read them.
        }
      if (disposed) return;
      started = true;
      await load();
    })();

    return () => {
      disposed = true;
      controller.abort();
      unsubscribe();
      window.removeEventListener("online", online);
      window.removeEventListener("hashchange", hashChange);
      setRuntime(null);
      setAccount(null);
      setCatalog(null);
      setTab(undefined);
      setKnown([]);
    };
  }, [userId]);

  const showTabs =
    !!userId &&
    catalog !== null &&
    catalog.kind !== "signed-out" &&
    tab !== undefined &&
    known.length > 0;
  const names = React.useMemo(
    () =>
      catalog?.kind === "ready"
        ? templeNames(catalog.rituals)
        : new Map<string, string>(),
    [catalog],
  );
  const labelOf = (slug: string) => names.get(slug) ?? slug;
  const open = showTabs && tab !== undefined && tab !== null ? tab : null;
  const tabIndex = open === null ? 0 : known.indexOf(open) + 1;

  const pick = (_event: React.SyntheticEvent, value: string) => {
    const slug = value === STANDARD ? null : value;
    setTab(slug);
    writeHash(slug);
    // Standard has no round to wait for.
    if (slug === null) busyRef.current(false);
    if (runtime && account)
      void runtime.repository
        .writeHallsTab(account, slug === null ? { standard: true } : { slug })
        .catch(ignore);
  };

  return (
    <>
      {showTabs && (
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
          <Tabs
            value={open ?? STANDARD}
            onChange={pick}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Halls by temple"
          >
            <Tab
              label="Standard"
              value={STANDARD}
              id={`${baseId}-tab-0`}
              aria-controls={`${baseId}-panel-0`}
            />
            {known.map((slug, index) => (
              <Tab
                key={slug}
                label={labelOf(slug)}
                value={slug}
                id={`${baseId}-tab-${index + 1}`}
                aria-controls={`${baseId}-panel-${index + 1}`}
              />
            ))}
          </Tabs>
        </Box>
      )}
      {/* The same element on the server and the client, so the static
          content is hydrated, never remounted. */}
      <div
        {...(showTabs
          ? {
              role: "tabpanel",
              id: `${baseId}-panel-0`,
              "aria-labelledby": `${baseId}-tab-0`,
              hidden: open !== null,
            }
          : {})}
      >
        {children}
      </div>
      {showTabs && open !== null && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${tabIndex}`}
          aria-labelledby={`${baseId}-tab-${tabIndex}`}
        >
          <TemplePanelContent
            slug={open}
            label={labelOf(open)}
            onBusy={(busy) => busyRef.current(busy)}
            catalog={catalog}
            runtime={runtime}
            account={account}
          />
        </div>
      )}
    </>
  );
}

function TemplePanelContent({
  slug,
  label,
  onBusy,
  catalog,
  runtime,
  account,
}: {
  slug: string;
  label: string;
  onBusy: (busy: boolean) => void;
  catalog: Catalog;
  runtime: BrowserOfflineRuntime | null;
  account: OfflineAccount | null;
}) {
  const rituals = React.useMemo(
    () =>
      catalog.kind === "ready" ? templeRituals(catalog.rituals, slug) : [],
    [catalog, slug],
  );
  if (catalog.kind === "offline")
    return (
      <Alert severity="info">
        Offline: see{" "}
        {/* A full navigation: the service worker serves this page's shell
            offline, which an in-app link cannot reach. */}
        <a href="/offline/ritual#halls">Halls on this device</a>.
      </Alert>
    );
  if (catalog.kind !== "ready")
    return (
      <Alert severity="info">
        {label}’s halls cannot be listed just now. Try again later.
      </Alert>
    );
  if (!runtime || !account)
    return (
      <>
        <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
          {label}’s halls
        </Typography>
        <Alert severity="info">
          This device cannot hold {label}’s rituals just now. Open one of them
          while signed in and online, then come back.
        </Alert>
      </>
    );
  return (
    <TempleHallsPanel
      label={label}
      rituals={rituals}
      runtime={runtime}
      account={account}
      onBusy={onBusy}
    />
  );
}
