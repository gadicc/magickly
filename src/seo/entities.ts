import Data from "@/../data/data";
import { angelBySlug, angelSlugs } from "@/../data/kabbalah/angelSlugs";
import { rowOf } from "@/../data/rowOf";
import { tarotDeck } from "@/tarot";
import type { SeoPage } from "./pages";

/** An indexable page generated from one row of the data set. */
export interface EntityPage extends SeoPage {
  path: string;
}

const MAX_DESCRIPTION = 160;

/**
 * Joins as many correspondences as fit a search snippet, in order, so rows
 * with long names lose their least important fields rather than get cut.
 */
function correspondences(lead: string, fields: (string | false | undefined)[]) {
  let text = `${lead}.`;
  const kept: string[] = [];
  for (const field of fields) {
    if (!field) continue;
    const next = `${lead}: ${[...kept, field].join(", ")}.`;
    if (next.length > MAX_DESCRIPTION) break;
    kept.push(field);
    text = next;
  }
  return text;
}

/** `/astrology/planet/<id>`, including the Kabbalistic heavens. */
export function planetPage(id: string): EntityPage | null {
  const planet = rowOf(Data.planet, id);
  if (!planet) return null;
  const name = planet.name.en.en ?? id;
  const hebrew = planet.name.he?.he
    ? ` (Hebrew ${planet.name.he.he}, ${planet.name.he.roman})`
    : "";
  return {
    path: `/astrology/planet/${id}`,
    title: `${name}${planet.symbol ? ` ${planet.symbol}` : ""} Correspondences`,
    description: correspondences(`Correspondences of ${name}${hebrew}`, [
      planet.symbol && `symbol ${planet.symbol}`,
      planet.hebrewLetter && `letter ${planet.hebrewLetter.letter.name}`,
      planet.godName?.name.roman && `god name ${planet.godName.name.roman}`,
      planet.archangel && `archangel ${planet.archangel.name.roman}`,
      planet.intelligenceId &&
        `intelligence ${capitalize(planet.intelligenceId)}`,
      planet.spiritId && `spirit ${capitalize(planet.spiritId)}`,
    ]),
  };
}

/** `/gd/grade/<id>`; the id keeps its `=`, as the sitemap always listed it. */
export function gradePage(id: string): EntityPage | null {
  const grade = rowOf(Data.gdGrade, id);
  if (!grade) return null;
  const numbered = /=/.test(grade.id) ? ` ${grade.id}` : "";
  const place = grade.sephirah
    ? `, attributed to ${grade.sephirah.name.roman} on the Tree of Life`
    : "";
  const element = grade.element?.name.en
    ? ` and the element of ${grade.element.name.en}`
    : "";
  return {
    path: `/gd/grade/${grade.id}`,
    title: `${grade.name}${numbered} Grade`,
    description: `The ${grade.name}${numbered} grade of the Golden Dawn${place}${element}, with its correspondences.`,
  };
}

/** `/kabbalah/sephirah/<id>`, including Da'at. */
export function sephirahPage(id: string): EntityPage | null {
  const sephirah = rowOf(Data.sephirah, id);
  if (!sephirah) return null;
  const { en, he, roman } = sephirah.name;
  const position = sephirah.index
    ? `Sephirah ${sephirah.index} of the Tree of Life`
    : "a Sephirah of the Tree of Life";
  return {
    path: `/kabbalah/sephirah/${id}`,
    title: `${roman} (${en}) on the Tree of Life`,
    description: correspondences(`${roman} (${he}), "${en}", is ${position}`, [
      sephirah.godName?.name.roman && `god name ${sephirah.godName.name.roman}`,
      sephirah.archangel?.name.roman &&
        `archangel ${sephirah.archangel.name.roman}`,
      sephirah.angelicOrder?.name.roman &&
        `angelic host ${sephirah.angelicOrder.name.roman}`,
      sephirah.color && "King and Queen scale colours",
    ]),
  };
}

/** `/kabbalah/path/<from>_<to>`; two paths exist only on the Hebrew tree. */
export function pathPage(id: string): EntityPage | null {
  const path = rowOf(Data.tolPath, id);
  if (!path) return null;
  const [from, to] = path.id
    .split("_")
    .map(Number)
    .map(
      (index) =>
        Object.values(Data.sephirah).find((s) => s.index === index)?.name.roman,
    );
  const joins = `${from}–${to}`;
  const hebrewLetter = path.hebrew?.hebrewLetter?.letter.name;
  const hermetic = path.hermetic;
  if (!hermetic)
    return {
      path: `/kabbalah/path/${id}`,
      title: `Tree of Life Path ${joins}`,
      description: `The path joining ${from} and ${to} exists only on the Hebrew Tree of Life, where it carries the letter ${hebrewLetter}; the Hermetic tree omits it.`,
    };
  const pathNo = hermetic.pathNo;
  const card = tarotDeck.getByRank(Number(hermetic.tarotId));
  const hebrew = hebrewLetter ? `; Hebrew attribution: ${hebrewLetter}` : "";
  return {
    path: `/kabbalah/path/${id}`,
    title: `Tree of Life Path ${pathNo}: ${joins}`,
    description: `Path ${pathNo} of the Tree of Life joins ${from} and ${to}. Hermetic attribution: the letter ${hermetic.hebrewLetter?.letter.name} and ${card.name}${hebrew}.`,
  };
}

function capitalize(text: string) {
  return text[0].toUpperCase() + text.slice(1);
}

/** Every entity page, in data order, for the sitemap. */
export function entityPages(): EntityPage[] {
  return [
    ...Object.keys(Data.planet).map(planetPage),
    ...Object.keys(Data.gdGrade).map(gradePage),
    ...Object.keys(Data.sephirah).map(sephirahPage),
    ...Object.keys(Data.tolPath).map(pathPage),
    ...angelSlugs().map(angelPage),
  ].filter((page): page is EntityPage => page !== null);
}

/** Static params for a dynamic entity route. */
export function entityIds(
  kind: "planet" | "gdGrade" | "sephirah" | "tolPath",
): { id: string }[] {
  return Object.keys(Data[kind]).map((id) => ({ id }));
}

/**
 * `/kabbalah/angel/<name>`, one for each of the seventy-two.
 *
 * These exist because the list page hides everything a searcher wants. Its
 * accordions unmount when closed and its prose loads on the client, so
 * production serves "Vehuiah" three times and "God elevated and exalted" not
 * at all — a page about seventy-two angels with none of them in its HTML. A
 * 94 KB French chapter will not rank for them either. English here, French on
 * the book's routes, each linking to the other. See plan 033.
 */
export function angelPage(slug: string): EntityPage | null {
  const angel = angelBySlug(slug);
  if (!angel) return null;
  const name = angel.name.en;
  const hebrew = angel.name.he ? ` (${angel.name.he})` : "";
  return {
    path: `/kabbalah/angel/${slug}`,
    title: `${name}, Angel ${angel.no} of the Shem HaMephorash`,
    description: correspondences(
      `${name}${hebrew}, the ${ordinal(angel.no)} angel of the Shem HaMephorash`,
      [
        angel.attribute.en && `"${angel.attribute.en}"`,
        angel.people.en && `rules ${angel.people.en}`,
        angel.godName && `god name ${angel.godName}`,
        angel.psalm.psalm > 0 &&
          `psalm ${angel.psalm.psalm}:${angel.psalm.verse}`,
      ],
    ),
  };
}

const ORDINAL = new Intl.PluralRules("en-US", { type: "ordinal" });
const ORDINAL_SUFFIX: Record<string, string> = {
  one: "st",
  two: "nd",
  few: "rd",
  other: "th",
};

function ordinal(n: number) {
  return `${n}${ORDINAL_SUFFIX[ORDINAL.select(n)]}`;
}

/** Every genius, in Lenain's order. */
export function angelPages(): EntityPage[] {
  return angelSlugs()
    .map(angelPage)
    .filter((page): page is EntityPage => page !== null);
}
