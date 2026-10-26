import { defaultHallArt } from "./art";
import { TRUMPS } from "./art/tarotKey";
import { hebrewLetter } from "./hebrewLetters";
import {
  FLOOR_SIZE,
  type ResolvedHall,
  type ResolvedObject,
  resolveHall,
} from "./layout";
import { PLANET_NAMES, type Planet } from "./planets";
import type { HallArtRegistry, HallNode } from "./types";
import {
  BOARD_NAMES,
  type BoardKind,
  CARD_TITLES,
  type CardKind,
  roleName,
} from "./vocabulary";

/**
 * A hall in words (plan 062): who stands where, what is on each altar and
 * what else the hall holds, for alt text and a page's description. Parts,
 * not prose, so each caller words them. Generated from the layout, so it
 * says only what the drawing shows; nothing is taken from a book.
 */
export interface HallDescription {
  /** The officers, in the hall's order. */
  officers: HallStation[];
  /** Each altar and the items on it, the black altar first. */
  altars: { name: string; where: string; items: string[] }[];
  /** Everything else drawn, in the hall's order. */
  furniture: HallStation[];
}

/** Something drawn and where it stands. */
export interface HallStation {
  name: string;
  where: string;
}

const MAX_DESCRIBED = 200;

/** An item's name: "red lamp", "Flaming Sword", "cup". */
function itemName(node: HallNode): string {
  const kind = String(node.kind ?? "item");
  if (kind === "lamp" || kind === "lantern") {
    const light =
      typeof node.light === "string"
        ? node.light
        : kind === "lamp"
          ? "red"
          : "yellow";
    return `${light} ${kind}`;
  }
  if (kind === "lightning") return "Flaming Sword";
  if (kind === "pantacle") return "Pantacle";
  return kind.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

const TABLET_NAMES: Record<string, string> = {
  earth: "Earth tablet",
  air: "Air tablet",
  water: "Water tablet",
  fire: "Fire tablet",
  union: "Tablet of Union",
};

/**
 * A planet as a sentence names it: "the Moon" and "the Sun" (the hall's
 * own labels say Luna and Sol, as the Order's diagrams do), the others by
 * name.
 */
function planetInWords(planet: unknown): string {
  if (planet === "moon") return "the Moon";
  if (planet === "sun") return "the Sun";
  return PLANET_NAMES.get(planet as Planet) ?? "a planet";
}

/**
 * What a node is called, or `undefined` for what is not described on its
 * own: rows, the floor and dais, doors, the caption and free labels.
 */
export function hallObjectName(node: HallNode): string | undefined {
  switch (node.type) {
    case "officer":
      return roleName(String(node.role ?? "officer"));
    case "altar":
      return node.kind === "white" ? "white altar" : "altar";
    case "pillar":
      return node.kind === "white" ? "white pillar" : "black pillar";
    case "banner":
      return node.kind === "west"
        ? "Banner of the West"
        : node.kind === "east"
          ? "Banner of the East"
          : "banner";
    case "item":
      return itemName(node);
    case "tablet":
      return TABLET_NAMES[String(node.element)] ?? "Enochian tablet";
    case "hebrewLetter": {
      // The node's own spelling (the Golden Dawn's, "Tau", in the presets)
      // with the letter itself: "Tau (ת)".
      const written = String(node.letter ?? "");
      const letter = hebrewLetter(written);
      if (!letter) return "Hebrew letter";
      return /^[א-ת]$/.test(written)
        ? `the letter ${letter}`
        : `${written.charAt(0).toUpperCase()}${written.slice(1)} (${letter})`;
    }
    case "tarotKey": {
      const trump = TRUMPS.get(Number(node.n));
      return trump ? `${trump.title} (${trump.numeral})` : "tarot key";
    }
    case "card":
      return CARD_TITLES.get(node.kind as CardKind) ?? "card";
    case "board":
      return BOARD_NAMES.get(node.kind as BoardKind) ?? "board";
    case "shewbread":
      return "Table of Shewbread";
    case "candlestick":
      return "Seven-Branched Candlestick";
    case "kamea":
      return `kamea of ${planetInWords(node.planet)}`;
    case "seal":
      return `seals of ${planetInWords(node.planet)}`;
    case "marker":
      return typeof node.text === "string" && node.text.trim()
        ? node.text.trim()
        : "marker";
    case "throne":
      return "throne";
    case "platform":
      return "platform";
    case "veil":
      return "veil";
    case "gong":
    case "brazier":
    case "candle":
      return node.type;
    default:
      return undefined;
  }
}

/** Where an object stands, in words, from its centre on the floor. */
export function hallStation(
  object: ResolvedObject,
  hall: ResolvedHall,
  altar?: ResolvedObject,
): string {
  const { cx, cy } = object;
  const { outer } = hall;
  if (cy < outer.y0) return "beyond the East wall";
  if (cy > outer.y1) return "beyond the West wall";
  if (cx < outer.x0) return "beyond the North wall";
  if (cx > outer.x1) return "beyond the South wall";
  if (cy < 0) return "on the dais";
  if (cx <= 1) return "by the North wall";
  if (cx >= FLOOR_SIZE - 1) return "by the South wall";
  if (cy >= FLOOR_SIZE - 1) return "by the West wall";
  if (altar && altar !== object) {
    const dx = cx - altar.cx;
    const dy = cy - altar.cy;
    if (Math.hypot(dx, dy) <= 3.5) {
      if (Math.abs(dx) <= 1)
        return dy < 0 ? "East of the altar" : "West of the altar";
      if (Math.abs(dy) <= 1)
        return dx < 0 ? "North of the altar" : "South of the altar";
    }
  }
  const third = FLOOR_SIZE / 3;
  const ns = cx < third ? "North" : cx > 2 * third ? "South" : "";
  const ew = cy < third ? "East" : cy > 2 * third ? "West" : "";
  if (!ns && !ew) return "in the centre";
  return `in the ${ns && ew ? `${ns}-${ew}` : ns || ew}`;
}

const isWithin = (inner: readonly number[], outer: readonly number[]) =>
  inner.length > outer.length && outer.every((step, i) => inner[i] === step);

/**
 * A hall described (see `HallDescription`). Objects standing on an altar
 * are its items; those on other hosts (an officer on a platform) are
 * described where they stand. At most 200 objects are described.
 */
export function describeHall(
  hall: HallNode,
  art: HallArtRegistry = defaultHallArt,
): HallDescription {
  const resolved = resolveHall(hall, { art });
  const objects = resolved.objects.slice(0, MAX_DESCRIBED);
  const altarObjects = objects
    .filter((object) => object.node.type === "altar")
    .sort(
      (a, b) =>
        Number(a.node.kind === "white") - Number(b.node.kind === "white"),
    );
  const main = altarObjects.find((object) => object.node.kind !== "white");
  const onAltar = (object: ResolvedObject) =>
    altarObjects.find((altar) => isWithin(object.path, altar.path));
  const officers: HallStation[] = [];
  const furniture: HallStation[] = [];
  for (const object of objects) {
    const name = hallObjectName(object.node);
    if (name === undefined || object.node.type === "altar") continue;
    if (onAltar(object)) continue;
    const station = { name, where: hallStation(object, resolved, main) };
    (object.node.type === "officer" ? officers : furniture).push(station);
  }
  return {
    officers,
    altars: altarObjects.map((altar) => ({
      name: hallObjectName(altar.node) as string,
      where: hallStation(altar, resolved),
      items: objects
        .filter((object) => isWithin(object.path, altar.path))
        .flatMap((object) => hallObjectName(object.node) ?? []),
    })),
    furniture,
  };
}
