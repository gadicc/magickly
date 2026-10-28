/**
 * The `/gd/halls/editor` editor's draft (plan 061, stage E): the hall's source,
 * kept in this browser's localStorage under a versioned key. Nothing is
 * sent anywhere. Storage may be missing, blocked, full or hold anything
 * at all, so every access is guarded and what is read is only ever
 * parsed as hall source, never trusted.
 */

/** The draft's key; a new format takes a new version. */
export const HALL_DRAFT_KEY = "magickli:gd-hall-draft:v1";

/**
 * The longest draft kept or read, in characters: a hall of
 * `MAX_KEPT_HALL_NODES` with its IDs fits (`hallLimits.ts`), and reading
 * one stays quick.
 */
export const MAX_HALL_DRAFT = 96_000;

/** A stored draft: the hall's source (header-less Pug with IDs). */
export interface HallDraft {
  source: string;
}

/** What reading the draft found. */
export type HallDraftReading =
  | { status: "found"; draft: HallDraft }
  | { status: "none" }
  /** Unreadable: not this version's JSON shape. */
  | { status: "corrupt" }
  | { status: "oversized" }
  /** Storage cannot be read (blocked, private mode). */
  | { status: "unavailable" };

/** The page's storage, or null where reaching it throws. */
export function draftStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Reads the draft, if there is a usable one. */
export function readHallDraft(
  storage: Pick<Storage, "getItem"> | null,
): HallDraftReading {
  if (!storage) return { status: "unavailable" };
  let raw: string | null;
  try {
    raw = storage.getItem(HALL_DRAFT_KEY);
  } catch {
    return { status: "unavailable" };
  }
  if (raw === null) return { status: "none" };
  if (raw.length > MAX_HALL_DRAFT + 64) return { status: "oversized" };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { status: "corrupt" };
  }
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { v?: unknown }).v !== 1 ||
    typeof (value as { source?: unknown }).source !== "string"
  )
    return { status: "corrupt" };
  const source = (value as { source: string }).source;
  if (source.length > MAX_HALL_DRAFT) return { status: "oversized" };
  return { status: "found", draft: { source } };
}

/** Keeps `source` as the draft: whether it was kept, or why not. */
export function writeHallDraft(
  storage: Pick<Storage, "setItem"> | null,
  source: string,
): "saved" | "too-large" | "failed" {
  if (source.length > MAX_HALL_DRAFT) return "too-large";
  if (!storage) return "failed";
  try {
    storage.setItem(HALL_DRAFT_KEY, JSON.stringify({ v: 1, source }));
    return "saved";
  } catch {
    // Quota exceeded, or storage blocked.
    return "failed";
  }
}
