import type {
  ResolvedHall,
  ResolvedObject,
} from "@magick-components/gd/hall/layout";
import type { HallArtRegistry } from "@magick-components/gd/hall/types";
import {
  CORE_ITEM_KINDS,
  HALL_ROLES,
} from "@magick-components/gd/hall/vocabulary";
import type { JsonValue } from "../semantic";
import { coordinateValue, snapHalf } from "./hallGeometry";
import { hostAccepts, isHost } from "./hallHostRules";
import {
  ensureFloor,
  type HallElement,
  indexHall,
  insertHallNode,
  rowPathKey,
} from "./hallModel";

/**
 * The visual hall editor's palette (plan 061, decision 11): the components
 * an author can add, and where a new one goes.
 */

/** A palette group, in the order the menu lists them. */
export type HallPaletteGroup =
  | "Officers"
  | "Furniture"
  | "Banners"
  | "Items"
  | "Symbols"
  | "Text";

/** One component the palette adds. */
export interface HallPaletteEntry {
  /** Unique among the entries, such as `officer:hegemon` or `item:cup`. */
  key: string;
  group: HallPaletteGroup;
  /** What the menu shows. */
  label: string;
  tag: string;
  attrs: Readonly<Record<string, JsonValue>>;
}

/** An item kind's name for a menu: `lightning` → "Lightning". */
export const itemKindLabel = (kind: string): string =>
  kind.charAt(0).toUpperCase() +
  kind
    .slice(1)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();

/**
 * Every item kind the art draws: the package's own and the registry's
 * (`item:<kind>`, the legacy art included), sorted by name.
 */
export function hallItemKinds(art: HallArtRegistry): string[] {
  const kinds = new Set(CORE_ITEM_KINDS);
  for (const key of art.keys())
    if (key.startsWith("item:")) kinds.add(key.slice("item:".length));
  return [...kinds].sort();
}

/**
 * The palette for an art registry: every officer role (the lamens and the
 * adepts, drawn as labelled circles until their lamens exist) and a
 * marker; the altar, pillars, platform, throne and a door; the banners
 * and a Hebrew letter; every item kind; a tarot key, a tablet, the Table
 * of Shewbread, the candlestick, a kamea and a planet's seals; free text.
 */
export function hallPalette(art: HallArtRegistry): HallPaletteEntry[] {
  return [
    ...[...HALL_ROLES].map(
      ([role, name]): HallPaletteEntry => ({
        key: `officer:${role}`,
        group: "Officers",
        label: name,
        tag: "officer",
        attrs: { role },
      }),
    ),
    {
      key: "marker",
      group: "Officers",
      label: "Marker",
      tag: "marker",
      attrs: { text: "Marker" },
    },
    {
      key: "altar",
      group: "Furniture",
      label: "Altar",
      tag: "altar",
      attrs: {},
    },
    {
      key: "pillar:black",
      group: "Furniture",
      label: "Black pillar",
      tag: "pillar",
      attrs: { kind: "black" },
    },
    {
      key: "pillar:white",
      group: "Furniture",
      label: "White pillar",
      tag: "pillar",
      attrs: { kind: "white" },
    },
    {
      key: "platform",
      group: "Furniture",
      label: "Platform",
      tag: "platform",
      attrs: {},
    },
    {
      key: "throne",
      group: "Furniture",
      label: "Throne",
      tag: "throne",
      attrs: {},
    },
    {
      key: "door",
      group: "Furniture",
      label: "Door (West wall)",
      tag: "door",
      attrs: { side: "west", x: 8, width: 2 },
    },
    {
      key: "banner:east",
      group: "Banners",
      label: "Banner of the East",
      tag: "banner",
      attrs: { kind: "east" },
    },
    {
      key: "banner:west",
      group: "Banners",
      label: "Banner of the West",
      tag: "banner",
      attrs: { kind: "west" },
    },
    {
      key: "hebrewLetter",
      group: "Banners",
      label: "Hebrew letter",
      tag: "hebrewLetter",
      attrs: { letter: "aleph" },
    },
    ...hallItemKinds(art).map(
      (kind): HallPaletteEntry => ({
        key: `item:${kind}`,
        group: "Items",
        label: itemKindLabel(kind),
        tag: "item",
        attrs: { kind },
      }),
    ),
    {
      key: "tarotKey",
      group: "Symbols",
      label: "Tarot key",
      tag: "tarotKey",
      attrs: { n: 0 },
    },
    {
      key: "tablet",
      group: "Symbols",
      label: "Enochian tablet",
      tag: "tablet",
      attrs: { element: "earth" },
    },
    {
      key: "shewbread",
      group: "Symbols",
      label: "Table of Shewbread",
      tag: "shewbread",
      attrs: {},
    },
    {
      key: "candlestick",
      group: "Symbols",
      label: "Seven-branched candlestick",
      tag: "candlestick",
      attrs: {},
    },
    {
      key: "kamea",
      group: "Symbols",
      label: "Kamea",
      tag: "kamea",
      attrs: { planet: "saturn" },
    },
    {
      key: "seal",
      group: "Symbols",
      label: "Planetary seals",
      tag: "seal",
      attrs: { planet: "saturn" },
    },
    {
      key: "label",
      group: "Text",
      label: "Label",
      tag: "label",
      attrs: { text: "Label" },
    },
  ];
}

/**
 * Whether a new `tag` goes into a selected host `hostTag` rather than on
 * the floor beside it: whatever the host takes (`hostAccepts`, the rule a
 * drag and the panel's "Stands on" follow), so what the palette puts on a
 * host can be moved off and back. Labels are the one exception, as
 * documented with the hosts: a `label` under a host labels that host, so
 * a new label with a host selected goes into it, while a free label never
 * joins a host by a drag.
 */
export function goesOnHost(tag: string, hostTag: string): boolean {
  if (tag === "label") return isHost(hostTag);
  return hostAccepts(hostTag, tag);
}

/** How far from an occupied spot a new object is put, in squares. */
const STEP = 1;

/** How close to another object's box a new object may stand, in squares. */
const CLEARANCE = 0.5;

/**
 * The first spot from `start`, a square at a time towards the South, that
 * lies outside every object's box widened by `CLEARANCE`, so a new object
 * does not hide under the altar or an officer; `start` itself after eight
 * tries.
 */
function freeSpot(
  objects: readonly ResolvedObject[],
  start: { x: number; y: number },
): { x: number; y: number } {
  const taken = (spot: { x: number; y: number }) =>
    objects.some(
      (object) =>
        Math.abs(object.cx - spot.x) < object.width / 2 + CLEARANCE &&
        Math.abs(object.cy - spot.y) < object.height / 2 + CLEARANCE,
    );
  for (let tries = 0; tries < 8; tries++) {
    const spot = { x: snapHalf(start.x + tries * STEP), y: snapHalf(start.y) };
    if (!taken(spot)) return spot;
  }
  return { x: snapHalf(start.x), y: snapHalf(start.y) };
}

/** The new element, and the hall with it added. */
export interface HallInsertion {
  hall: HallElement;
  id: string;
}

/**
 * Adds a palette entry's component to the hall with a fresh ID.
 *
 * - With a host selected that the component goes on (`goesOnHost`), it
 *   goes into the host, at the host's centre (no `x` or `y`).
 * - A door goes into the floor at its own place in the West wall.
 * - Anything else goes into the floor (one is made, before the caption,
 *   when the hall has none) beside the selection, a square past its
 *   South edge, or at the floor's centre when nothing is selected, moved
 *   South a square at a time until it is clear of the other objects, on
 *   half squares.
 */
export function insertFromPalette(
  hall: HallElement,
  resolved: ResolvedHall,
  entry: HallPaletteEntry,
  selectedId: string | undefined,
  createId: () => string,
): HallInsertion {
  const selected = selectedId
    ? indexHall(hall).byId.get(selectedId)
    : undefined;
  const node: HallElement = {
    kind: "element",
    id: createId(),
    tag: entry.tag,
    attrs: { ...entry.attrs },
    children: [],
  };
  if (selected && goesOnHost(entry.tag, selected.node.tag))
    return { hall: insertHallNode(hall, selected.node.id, node), id: node.id };
  const { hall: next, floor } = ensureFloor(hall, createId);
  if (entry.tag !== "door") {
    const object =
      selected &&
      resolved.objects.find(
        (candidate) =>
          rowPathKey(candidate.path) === rowPathKey(selected.rowPath),
      );
    const start = object
      ? { x: object.cx + object.width / 2 + STEP, y: object.cy }
      : { x: 8, y: 8 };
    const spot = freeSpot(resolved.objects, start);
    node.attrs.x = coordinateValue(spot.x);
    node.attrs.y = coordinateValue(spot.y);
  }
  return { hall: insertHallNode(next, floor.id, node), id: node.id };
}
