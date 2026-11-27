"use client";

import { CALVARY_BARS } from "magick-data/enochian/tabletPyramids";
import {
  DEFAULT_TABLET_VERSION,
  TABLET_VERSIONS,
  type TabletVersionId,
} from "magick-data/enochian/tablets";
import * as React from "react";
import { TABLET_IDS } from "@/render/contracts/enochianTablet";

/**
 * The tablets page's choices in its URL (plan 090, decision 1, and plan
 * 095, decisions 3 and 4): `?tablet=` and `?version=`, the panel's tab
 * (`?tab=`), the Squares tab's square (`?square=row,column`), the
 * tablet drawn as pyramids (`?pyramids=1`) and their sides' symbols
 * (`?symbols=1`, standing `?upright=1`), so a view can be shared.
 *
 * Read from `window.location` rather than `useSearchParams`, which would
 * render the page in the browser only and drop it from the prerendered
 * HTML, as the dictionary's `urlState.ts` does. The server snapshot is
 * empty, so only the default view is prerendered and a shared link shows
 * its tablet, tab and square once hydrated.
 */

/** A tablet the page offers. */
export type TabletId = (typeof TABLET_IDS)[number];

/** The panel's tabs: Names (the default), Differences and Squares. */
export const PANEL_TABS = ["names", "differences", "squares"] as const;

/** One of the panel's tabs. */
export type PanelTab = (typeof PANEL_TABS)[number];

/** A square of a tablet, by row and column from 0. */
export interface TabletUrlSquare {
  row: number;
  column: number;
}

/** The page's choices that its URL holds. */
export interface TabletChoice {
  tablet: TabletId;
  version: TabletVersionId;
  /** The panel's tab, where the URL names one other than Names. */
  tab?: PanelTab;
  /**
   * The Squares tab's square, counted from 0 here and from 1 in the URL
   * (`square=7,6` is row 7, square 6). Only on the tablet's grid and in a
   * version with pyramids: Dee's and Raphael's tables carry no elements.
   */
  square?: TabletUrlSquare;
  /**
   * Every square drawn as a pyramid (`pyramids=1`). Only in a version
   * with pyramids, as `square` is: Dee's and Raphael's carry no elements.
   */
  pyramids?: boolean;
  /**
   * Each side's symbol drawn on the pyramids (`symbols=1`), standing on
   * its side's outer edge. Only with `pyramids`.
   */
  symbols?: boolean;
  /** The symbols stood upright (`upright=1`). Only with `symbols`. */
  upright?: boolean;
  /**
   * The pyramids in 3D (`3d=1`, plan 101). Only with `pyramids`. Read
   * here; the switch that writes it comes with stage 4, and until then
   * the URL keeps it as an unknown param.
   */
  threeD?: boolean;
}

/** The view a URL without choices shows: Earth, the default version. */
export const DEFAULT_CHOICE: TabletChoice = {
  tablet: "earth",
  version: DEFAULT_TABLET_VERSION,
};

const oneOf = <T extends string>(
  value: string | null,
  values: readonly T[],
): T | undefined => values.find((each) => each === value);

/** A tablet's rows and columns: a Watchtower's 13 by 12, the Union's 4 by 5. */
const gridOf = (tablet: TabletId) =>
  tablet === "union" ? { rows: 4, columns: 5 } : { rows: 13, columns: 12 };

/**
 * Whether a version has pyramids, and so squares to choose in the Squares
 * tab: the Golden Dawn's three, not Dee's or Raphael's.
 */
export const hasPyramids = (version: TabletVersionId) =>
  CALVARY_BARS[version] !== null;

/**
 * Whether a square has a place in the URL: on the tablet's grid, in a
 * version with pyramids, with the Squares tab open.
 */
function squareFits(
  { row, column }: TabletUrlSquare,
  { tablet, version, tab }: Omit<TabletChoice, "square">,
): boolean {
  const { rows, columns } = gridOf(tablet);
  return (
    tab === "squares" &&
    hasPyramids(version) &&
    Number.isInteger(row) &&
    Number.isInteger(column) &&
    row >= 0 &&
    row < rows &&
    column >= 0 &&
    column < columns
  );
}

/** A square as the URL writes it ("7,6", from 1), if it fits. */
function squareOf(
  value: string | null,
  choice: Omit<TabletChoice, "square">,
): TabletUrlSquare | undefined {
  const match = /^(\d{1,2}),(\d{1,2})$/.exec(value ?? "");
  if (!match) return undefined;
  const square = { row: Number(match[1]) - 1, column: Number(match[2]) - 1 };
  return squareFits(square, choice) ? square : undefined;
}

/**
 * The choices in a query string ("?tablet=air&version=dee"); a missing
 * or unknown tablet or version is the default's, and a missing or unknown
 * tab or square is left out, as is a square off the Squares tab, a
 * square or pyramids in Dee's or Raphael's version, symbols or 3D
 * without pyramids and upright without symbols.
 */
export function parseTabletQuery(search: string): TabletChoice {
  const params = new URLSearchParams(search);
  const tablet =
    oneOf(params.get("tablet"), TABLET_IDS) ?? DEFAULT_CHOICE.tablet;
  const version =
    oneOf(params.get("version"), TABLET_VERSIONS) ?? DEFAULT_CHOICE.version;
  const tab = oneOf(params.get("tab"), PANEL_TABS);
  const square = squareOf(params.get("square"), { tablet, version, tab });
  const pyramids = params.get("pyramids") === "1" && hasPyramids(version);
  const symbols = pyramids && params.get("symbols") === "1";
  const upright = symbols && params.get("upright") === "1";
  const threeD = pyramids && params.get("3d") === "1";
  return {
    tablet,
    version,
    ...(tab && tab !== "names" ? { tab } : {}),
    ...(square ? { square } : {}),
    ...(pyramids ? { pyramids } : {}),
    ...(symbols ? { symbols } : {}),
    ...(upright ? { upright } : {}),
    ...(threeD ? { threeD } : {}),
  };
}

/** The choices' own params, the defaults left out. */
function choiceParams(choice: TabletChoice): Record<string, string | null> {
  // Each switch is written only while it shows: symbols with pyramids,
  // upright with symbols.
  const pyramids = Boolean(choice.pyramids) && hasPyramids(choice.version);
  const symbols = pyramids && Boolean(choice.symbols);
  return {
    tablet: choice.tablet === DEFAULT_CHOICE.tablet ? null : choice.tablet,
    version: choice.version === DEFAULT_CHOICE.version ? null : choice.version,
    tab: choice.tab && choice.tab !== "names" ? choice.tab : null,
    square:
      choice.square && squareFits(choice.square, choice)
        ? `${choice.square.row + 1},${choice.square.column + 1}`
        : null,
    pyramids: pyramids ? "1" : null,
    symbols: symbols ? "1" : null,
    upright: symbols && choice.upright ? "1" : null,
  };
}

/** A square's comma as written, not as `URLSearchParams` escapes it. */
const plainComma = (search: string) =>
  search.replace(/([?&]square=\d+)%2C(\d+)/, "$1,$2");

/**
 * The query string for the choices, "" for the default view
 * ("?tablet=air&version=dee", "?version=dee", "?tab=squares&square=7,6",
 * "?tablet=fire&pyramids=1", "?pyramids=1&symbols=1&upright=1").
 */
export function tabletQuery(choice: TabletChoice): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(choiceParams(choice)))
    if (value) params.set(name, value);
  const query = params.toString();
  return query ? plainComma(`?${query}`) : "";
}

/** Fired after this module changes the URL; `popstate` covers the rest. */
const CHANGED = "tablets-url";

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(CHANGED, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(CHANGED, callback);
  };
}

/**
 * The tab a history entry was left from, which `pushChoice` records on it
 * so that Back returns to it: the URL leaves the default tab out.
 */
const tabOfEntry = (): PanelTab | undefined =>
  oneOf(
    (window.history.state as { tabletsTab?: string } | null)?.tabletsTab ??
      null,
    PANEL_TABS,
  );

/** The URL's query and the tab its history entry records, as one key. */
const getSnapshot = () => `${window.location.search}|${tabOfEntry() ?? ""}`;
const getServerSnapshot = () => "|";

/**
 * The page's choices from its URL, a way to change them that replaces the
 * URL, and one that adds a history entry. A reader trying the tablets in
 * turn gets no history entry for each; following a name's square to the
 * Squares tab does get one, so Back returns to the name. Other params and
 * the hash are kept. A square belongs to its tablet, so a change of
 * tablet lets it go unless the change names one.
 */
export function useTabletUrl(): [
  TabletChoice,
  (change: Partial<TabletChoice>) => void,
  (change: Partial<TabletChoice>, from: PanelTab) => void,
] {
  const key = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const choice = React.useMemo(() => {
    const [search = "", entryTab] = key.split("|");
    const parsed = parseTabletQuery(search);
    // An entry left from a tab its URL does not name says which.
    const tab = parsed.tab ?? oneOf(entryTab ?? null, PANEL_TABS);
    return tab ? { ...parsed, tab } : parsed;
  }, [key]);
  const write = React.useCallback(
    (change: Partial<TabletChoice>, from?: PanelTab) => {
      const url = new URL(window.location.href);
      const was = parseTabletQuery(url.search);
      const next = { ...was, ...change };
      if (next.tablet !== was.tablet && !("square" in change))
        next.square = undefined;
      for (const [name, value] of Object.entries(choiceParams(next)))
        if (value) url.searchParams.set(name, value);
        else url.searchParams.delete(name);
      const href = url.pathname + plainComma(url.search) + url.hash;
      // Our own state only: Next's patched history methods add theirs and
      // sync its router (see the dictionary's `urlState.ts`).
      if (from) {
        const here =
          window.location.pathname +
          window.location.search +
          window.location.hash;
        window.history.replaceState({ tabletsTab: from }, "", here);
        window.history.pushState(null, "", href);
      } else window.history.replaceState(null, "", href);
      window.dispatchEvent(new Event(CHANGED));
    },
    [],
  );
  const setChoice = React.useCallback(
    (change: Partial<TabletChoice>) => write(change),
    [write],
  );
  const pushChoice = React.useCallback(
    (change: Partial<TabletChoice>, from: PanelTab) => write(change, from),
    [write],
  );
  return [choice, setChoice, pushChoice];
}
