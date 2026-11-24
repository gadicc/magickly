"use client";
import React from "react";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import { SITE_NAME } from "@/seo/site";

/**
 * What Share sends for the page on screen (plan 097, decisions 3 and 7),
 * for a page whose state is not in its address: the rose and kamea sigils
 * and the geomancy reading keep typed text out of the URL (plan 027), so
 * they register the link that restores it, and Share sends that link only
 * when the reader taps it.
 */
export interface PageShare {
  /** The page's link with its current state, site-relative or absolute. */
  url: () => string;
  /** The link carries what the reader entered, and Share says so. */
  personal: boolean;
}

type Slot = { current: PageShare | null };

interface Registry {
  add(slot: Slot): () => void;
  current(): PageShare | null;
  /** Tells subscribers that the registration they read may differ now. */
  changed(): void;
  subscribe(listener: () => void): () => void;
}

interface PageShareContextValue {
  registry: Registry;
  /** The page's title, as the app bar shows it, for the share sheet. */
  title?: string;
}

const PageShareContext = React.createContext<PageShareContextValue | null>(
  null,
);

/**
 * Holds the registrations of the pages below it. Registering changes no
 * state, so a page re-rendering never re-renders the app bar; Share reads
 * the latest builder when it is tapped. Only what a share row shows
 * before the tap, whether the link is personal, is subscribed to.
 */
export function PageShareProvider({
  title,
  children,
}: {
  /** The page's title, as the app bar shows it, for the share sheet. */
  title?: string;
  children: React.ReactNode;
}) {
  const [registry] = React.useState<Registry>(() => {
    let slots: Slot[] = [];
    const listeners = new Set<() => void>();
    const changed = () => {
      for (const listener of listeners) listener();
    };
    return {
      add(slot) {
        slots = [...slots, slot];
        changed();
        return () => {
          slots = slots.filter((each) => each !== slot);
          changed();
        };
      },
      // The page mounted last wins, and one that registers nothing for
      // now (no sigil yet) leaves Share the bare page.
      current: () => slots.at(-1)?.current ?? null,
      changed,
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  });
  const value = React.useMemo(() => ({ registry, title }), [registry, title]);
  return (
    <PageShareContext.Provider value={value}>
      {children}
    </PageShareContext.Provider>
  );
}

/**
 * Registers the page's link builder while the page is mounted; `undefined`
 * for now means Share sends the address bar's page. Outside a provider it
 * does nothing.
 */
export function usePageShare(share: PageShare | undefined) {
  const registry = React.useContext(PageShareContext)?.registry;
  const slot = React.useRef<Slot>({ current: null });
  // After every render, so a tap reads the builder of the last commit; a
  // share row hears of it only when what it shows would change.
  React.useEffect(() => {
    const before = slot.current.current?.personal;
    slot.current.current = share ?? null;
    if (share?.personal !== before) registry?.changed();
  });
  React.useEffect(() => registry?.add(slot.current), [registry]);
}

/** What Share should send now: the registered page's, or null for the address bar's. */
export function useSharedPage(): () => PageShare | null {
  const registry = React.useContext(PageShareContext)?.registry;
  return React.useCallback(() => registry?.current() ?? null, [registry]);
}

const unsubscribed = () => () => {};
const unknown = () => undefined;

/**
 * Whether the registered link is personal, for a share row's hint before
 * the tap: `undefined` while nothing is registered (on the server, before
 * the page's effects, or outside a provider), so the row can fall back on
 * what it knows of the page.
 */
export function useSharedPersonal(): boolean | undefined {
  const registry = React.useContext(PageShareContext)?.registry;
  return React.useSyncExternalStore(
    registry?.subscribe ?? unsubscribed,
    registry ? () => registry.current()?.personal : unknown,
    unknown,
  );
}

const COPIED = /*i18n*/ {
  id: "Copied link to this page",
  comment:
    "Confirms that Share, where the browser has no share sheet, copied the page's link",
};
const COPIED_PERSONAL = /*i18n*/ {
  id: "Copied link to this page. It includes what you entered here.",
  comment:
    "Confirms that Share copied the link to a page made from what the reader typed (a name, a reading), and warns that the link carries it",
};
const FAILED = /*i18n*/ {
  id: "Could not copy the link to this page.",
  comment:
    "Shown when Share could neither open the browser's share sheet nor copy the page's link",
};

/** How long Share's confirmation stays, wherever it is shown. */
export const SHARE_CONFIRMATION_MS = 4000;

/** What Share says after a tap, for the caller's own snackbar. */
export interface ShareOutcome {
  severity: "success" | "error";
  message: string;
}

/**
 * Whether a rejection needs no word: the reader dismissed the sheet
 * (`AbortError`), or tapped again while it was open (`InvalidStateError`).
 */
const silent = (error: unknown) => {
  const name = (error as { name?: unknown } | null)?.name;
  return name === "AbortError" || name === "InvalidStateError";
};

async function copy(text: string) {
  if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
  await navigator.clipboard.writeText(text);
}

/**
 * Share, for the app bar's button and the export box's share row alike
 * (plan 097, decisions 3 and 7). It sends the link a page registered with
 * `usePageShare`, or else the address bar's, through the browser's share
 * sheet; without one, or when the sheet fails, it copies the link. It
 * resolves to what to say, or null when there is nothing to say (the
 * sheet took the link, or the reader dismissed it). Call it in the tap
 * and await nothing before it: the sheet or the first clipboard write
 * starts synchronously, inside the user gesture.
 */
export function useSharePage(): () => Promise<ShareOutcome | null> {
  const context = React.useContext(PageShareContext);
  const { t } = useUiLanguage();
  return React.useCallback(async () => {
    const page = context?.registry.current() ?? null;
    const url = page
      ? new URL(page.url(), window.location.href).href
      : window.location.href;
    if (navigator.share) {
      // Without a provider's title, the document's already names the
      // site ("Rose Sigils | Magick.ly"); the message takes the page's
      // part alone.
      const pageTitle = context?.title;
      const title =
        pageTitle ?? document.title.replace(` | ${SITE_NAME}`, "").trim();
      try {
        await navigator.share({
          title: pageTitle ? `${pageTitle} - magick.ly` : document.title,
          text: t(
            /*i18n*/ 'Check out "{title}" on magick.ly, the open source magick app!',
            { title },
          ),
          url,
        });
        return null;
      } catch (error) {
        if (silent(error)) return null;
        // Any other failure: copy the link instead. This runs after the
        // sheet's promise, outside the tap, so Safari and Firefox usually
        // refuse the write too; then the error below is what the reader
        // sees.
      }
    }
    try {
      await copy(url);
      return {
        severity: "success",
        message: t(page?.personal ? COPIED_PERSONAL.id : COPIED.id),
      };
    } catch {
      return { severity: "error", message: t(FAILED.id) };
    }
  }, [context, t]);
}
