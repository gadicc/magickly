"use client";
import React from "react";

/**
 * What the app bar's Share sends for the page on screen (plan 097,
 * decision 3), for a page whose state is not in its address: the rose and
 * kamea sigils and the geomancy reading keep typed text out of the URL
 * (plan 027), so they register the link that restores it, and Share sends
 * that link only when the reader taps it.
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
}

const PageShareContext = React.createContext<Registry | null>(null);

/**
 * Holds the registrations of the pages below it. Registering changes no
 * state, so a page re-rendering never re-renders the app bar; Share reads
 * the latest builder when it is tapped.
 */
export function PageShareProvider({ children }: { children: React.ReactNode }) {
  const [registry] = React.useState<Registry>(() => {
    let slots: Slot[] = [];
    return {
      add(slot) {
        slots = [...slots, slot];
        return () => {
          slots = slots.filter((each) => each !== slot);
        };
      },
      // The page mounted last wins, and one that registers nothing for
      // now (no sigil yet) leaves Share the bare page.
      current: () => slots.at(-1)?.current ?? null,
    };
  });
  return (
    <PageShareContext.Provider value={registry}>
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
  const registry = React.useContext(PageShareContext);
  const slot = React.useRef<Slot>({ current: null });
  // After every render, so a tap reads the builder of the last commit.
  React.useEffect(() => {
    slot.current.current = share ?? null;
  });
  React.useEffect(() => registry?.add(slot.current), [registry]);
}

/** What Share should send now: the registered page's, or null for the address bar's. */
export function useSharedPage(): () => PageShare | null {
  const registry = React.useContext(PageShareContext);
  return React.useCallback(() => registry?.current() ?? null, [registry]);
}
