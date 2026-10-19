import type { HallElement } from "@/doc/gdHallEditor/hallModel";
import { parseHallSource, printHallSource } from "@/doc/gdHallPug";
import {
  type RitualSourceDiagnostic,
  ritualSourceDiagnostic,
} from "@/doc/ritualSourceDiagnostics";

/**
 * The `/gd/hall` editor's state and history (plan 061, stage E): the hall
 * as its source, which the source panel shows (header-less Pug with IDs),
 * and the hall that source holds, which the visual editor edits. The page
 * keeps its own undo and redo: one step per visual gesture, per loaded
 * hall, and per source edit once typing pauses.
 */

/** A source and what it holds: its hall, or why it holds none. */
export interface HallEntry {
  source: string;
  /** Null while the source does not parse to a hall. */
  hall: HallElement | null;
  diagnostic: RitualSourceDiagnostic | null;
}

/** The entry for a source the author typed (or a draft, a share link). */
export function entryOfSource(source: string): HallEntry {
  try {
    return { source, hall: parseHallSource(source), diagnostic: null };
  } catch (error) {
    return {
      source,
      hall: null,
      diagnostic: ritualSourceDiagnostic(error, source),
    };
  }
}

/** The entry for a hall (a gesture's, a preset's copy): printed with IDs. */
export function entryOfHall(hall: HallElement): HallEntry {
  return {
    source: printHallSource(hall, { ids: true }),
    hall,
    diagnostic: null,
  };
}

/** How many steps undo keeps. */
export const MAX_HALL_HISTORY = 200;

export interface HallHistory {
  past: readonly HallEntry[];
  present: HallEntry;
  future: readonly HallEntry[];
  /**
   * The entry before typing began, while a source edit is not yet a step
   * of its own (it becomes one when typing pauses: `settle`).
   */
  typingFrom: HallEntry | null;
}

export type HallHistoryAction =
  /** A completed visual gesture's hall. */
  | { type: "visual"; hall: HallElement }
  /**
   * The source as typed, read once typing rests a moment (the page shows
   * the text at once, and reads it as a hall only then); a step once
   * settled.
   */
  | { type: "typed"; entry: HallEntry }
  /** Typing paused: the typed source becomes one step. */
  | { type: "settle" }
  /** A preset, a draft or a shared hall, as one step. */
  | { type: "load"; entry: HallEntry }
  | { type: "undo" }
  | { type: "redo" };

export function initialHistory(present: HallEntry): HallHistory {
  return { past: [], present, future: [], typingFrom: null };
}

const pushed = (past: readonly HallEntry[], entry: HallEntry) =>
  [...past, entry].slice(-MAX_HALL_HISTORY);

/** Typing that changed the source becomes a step of its own. */
function settled(history: HallHistory): HallHistory {
  const from = history.typingFrom;
  if (!from) return history;
  if (from.source === history.present.source)
    return { ...history, typingFrom: null };
  return {
    past: pushed(history.past, from),
    present: history.present,
    future: [],
    typingFrom: null,
  };
}

/** A new present after the settled one, as one step. */
function step(history: HallHistory, entry: HallEntry): HallHistory {
  const base = settled(history);
  if (entry.source === base.present.source && entry.hall === base.present.hall)
    return base;
  return {
    past: pushed(base.past, base.present),
    present: entry,
    future: [],
    typingFrom: null,
  };
}

export function hallHistoryReducer(
  history: HallHistory,
  action: HallHistoryAction,
): HallHistory {
  switch (action.type) {
    case "visual":
      return step(history, entryOfHall(action.hall));
    case "load":
      return step(history, action.entry);
    case "typed":
      if (action.entry.source === history.present.source) return history;
      return {
        ...history,
        present: action.entry,
        typingFrom: history.typingFrom ?? history.present,
      };
    case "settle":
      return settled(history);
    case "undo": {
      const base = settled(history);
      const previous = base.past.at(-1);
      if (!previous) return base;
      return {
        past: base.past.slice(0, -1),
        present: previous,
        future: [base.present, ...base.future],
        typingFrom: null,
      };
    }
    case "redo": {
      const base = settled(history);
      const [next, ...rest] = base.future;
      if (!next) return base;
      return {
        past: pushed(base.past, base.present),
        present: next,
        future: rest,
        typingFrom: null,
      };
    }
  }
}

/** Whether undo has a step to take (unsettled typing counts as one). */
export const canUndo = (history: HallHistory) =>
  history.past.length > 0 ||
  (!!history.typingFrom &&
    history.typingFrom.source !== history.present.source);

export const canRedo = (history: HallHistory) => history.future.length > 0;
