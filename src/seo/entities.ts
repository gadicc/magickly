import { dayOf } from "magick-components/astrology/planetDays";
import { planetName } from "magick-components/astrology/planetName";
import Data from "magick-data";
import { signOf } from "magick-data/kabbalah/seventyTwoAngels/derived";
import { rowOf } from "magick-data/rowOf";
import type { SephirahRow } from "magick-data/rows";
import { angelBySlug, angelSlugs } from "@/lib/angelSlugs";
import { RWSName } from "@/tarot";
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

const AND = new Intl.ListFormat("en-GB", { type: "conjunction" });

/**
 * `/astrology/planet/<id>`, including the Kabbalistic heavens. A common name
 * leads, with the planet's own name beside its Hebrew: "the Sun (Sol, Hebrew
 * שמש, Shemesh)". Each common name so far takes "the". A row with a
 * `description` of its own (plan 078) has that instead.
 */
export function planetPage(id: string): EntityPage | null {
  const planet = rowOf(Data.planet, id);
  if (!planet) return null;
  const he = planet.name.he?.he
    ? `Hebrew ${planet.name.he.he}, ${planet.name.he.roman}`
    : "";
  const named = planet.commonName
    ? `the ${planet.commonName} (${[planet.name.en.en, he].filter(Boolean).join(", ")})`
    : `${planet.name.en.en}${he ? ` (${he})` : ""}`;
  const day = dayOf(id);
  return {
    path: `/astrology/planet/${id}`,
    title: `${planetName(planet)}${planet.symbol ? ` ${planet.symbol}` : ""} Correspondences`,
    description:
      planet.description?.en ??
      correspondences(`Correspondences of ${named}`, [
        planet.symbol && `symbol ${planet.symbol}`,
        day && `day ${day}`,
        planet.zodiacs.length > 0 &&
          `rules ${AND.format(planet.zodiacs.map((sign) => sign.name.en))}`,
        planet.hebrewLetter && `letter ${planet.hebrewLetter.letter.name}`,
        planet.godName?.name.roman && `god name ${planet.godName.name.roman}`,
        planet.archangel && `archangel ${planet.archangel.name.roman}`,
        planet.intelligenceId &&
          `intelligence ${capitalize(planet.intelligenceId)}`,
        planet.spiritId && `spirit ${capitalize(planet.spiritId)}`,
      ]),
  };
}

const ORDERS: Record<string, string> = {
  "1st": "First",
  "2nd": "Second",
  "3rd": "Third",
};

/** "Zelator 1=10", or "Portal", which has no numbers. */
function gradeName(grade: { id: string; name: string }) {
  return /=/.test(grade.id) ? `${grade.name} ${grade.id}` : grade.name;
}

/**
 * `/gd/grade/<id>`; the id keeps its `=`, as the sitemap always listed it.
 * The order and the neighbouring grades are added where they fit a
 * snippet, so the grades with least to say still say enough (plan 028's
 * follow-ups).
 */
export function gradePage(id: string): EntityPage | null {
  const grade = rowOf(Data.gdGrade, id);
  if (!grade) return null;
  const order = grade.orderId ? `'s ${ORDERS[grade.orderId]} Order` : "";
  const place = grade.sephirah
    ? `, attributed to ${grade.sephirah.name.roman} on the Tree of Life`
    : "";
  const element = grade.element?.name.en
    ? ` and the element of ${grade.element.name.en}`
    : "";
  const { prev, next } = grade;
  const neighbours =
    prev && next
      ? `, between ${gradeName(prev)} and ${gradeName(next)}`
      : next
        ? `, the grade of entry, before ${gradeName(next)}`
        : prev
          ? `, the last grade, after ${gradeName(prev)}`
          : "";
  const lead = `The ${gradeName(grade)} grade of the Golden Dawn`;
  const tail = ", with its correspondences.";
  let description = `${lead}${place}${element}${tail}`;
  for (const candidate of [
    `${lead}${order}${place}${element}${neighbours}${tail}`,
    `${lead}${order}${place}${element}${tail}`,
  ])
    if (candidate.length <= MAX_DESCRIPTION) {
      description = candidate;
      break;
    }
  return {
    path: `/gd/grade/${grade.id}`,
    title: `${gradeName(grade)} Grade`,
    description,
  };
}

/**
 * Whether a sephirah is the hidden one, Da'at (plan 036, decision 18).
 *
 * The table numbers it 11, which is its place in the file and not a number
 * the tradition gives it: the Tree counts ten, and Da'at is the one sphere
 * outside the chain they make, with neither a next nor a previous. That is
 * the criterion, so that the sephirah page's lede and its search description,
 * which both call it the hidden Sephirah, say so from the data rather than
 * from an id or an index.
 */
export function isHiddenSephirah(sephirah: Pick<SephirahRow, "next" | "prev">) {
  return !sephirah.next && !sephirah.prev;
}

/** `/kabbalah/sephirah/<id>`, including Da'at. */
export function sephirahPage(id: string): EntityPage | null {
  const sephirah = rowOf(Data.sephirah, id);
  if (!sephirah) return null;
  const { en, he, roman } = sephirah.name;
  const position = isHiddenSephirah(sephirah)
    ? "the hidden Sephirah of the Tree of Life"
    : `Sephirah ${sephirah.index} of the Tree of Life`;
  return {
    path: `/kabbalah/sephirah/${id}`,
    title: `${roman} (${en}) on the Tree of Life`,
    description: correspondences(`${roman} (${he}), "${en}", is ${position}`, [
      sephirah.godName?.name.roman && `god name ${sephirah.godName.name.roman}`,
      sephirah.archangel?.name.roman &&
        `archangel ${sephirah.archangel.name.roman}`,
      sephirah.angelicOrder?.name.roman &&
        `angelic host ${sephirah.angelicOrder.name.roman}`,
      // Da'at is drawn on the Queen scale alone.
      sephirah.color.king
        ? "King and Queen scale colours"
        : "Queen scale colour",
    ]),
  };
}

/** `/kabbalah/path/<from>_<to>`; two paths exist only on the Hebrew tree. */
export function pathPage(id: string): EntityPage | null {
  const path = rowOf(Data.treeOfLifePath, id);
  if (!path) return null;
  const from = path.from.name.roman;
  const to = path.to.name.roman;
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
  // As the Rider–Waite card the page shows prints it, not as tarot-deck has it.
  const trump = RWSName(hermetic.tarotId);
  const hebrew = hebrewLetter ? `; Hebrew attribution: ${hebrewLetter}` : "";
  // The letter with its glyph and meaning where they fit: "Shin (ש, "tooth")".
  const letter = hermetic.hebrewLetter;
  const name = letter?.letter.name;
  const describe = (lettered: string | undefined) =>
    `Path ${pathNo} of the Tree of Life joins ${from} and ${to}. Hermetic attribution: the letter ${lettered} and ${trump}${hebrew}.`;
  const description =
    [
      letter?.meaning?.en &&
        describe(`${name} (${letter.letter.he}, "${letter.meaning.en}")`),
      letter && describe(`${name} (${letter.letter.he})`),
    ].find(
      (candidate): candidate is string =>
        !!candidate && candidate.length <= MAX_DESCRIPTION,
    ) ?? describe(name);
  return {
    path: `/kabbalah/path/${id}`,
    title: `Tree of Life Path ${pathNo}: ${joins}`,
    description,
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
    ...Object.keys(Data.treeOfLifePath).map(pathPage),
    ...angelSlugs().map(angelPage),
  ].filter((page): page is EntityPage => page !== null);
}

/** Static params for a dynamic entity route. */
export function entityIds(
  kind: "planet" | "gdGrade" | "sephirah" | "treeOfLifePath",
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
  const sign = signOf(angel.no);
  // Lenain ends a few attributes with a full stop, which a quote mid-list
  // should not keep.
  const attribute = angel.attribute.en.replace(/\.$/, "");
  return {
    path: `/kabbalah/angel/${slug}`,
    title: `${name}, Angel ${angel.no} of the Shem HaMephorash`,
    description: correspondences(
      `${name}${hebrew}, the ${ordinal(angel.no)} angel of the Shem HaMephorash`,
      [
        attribute && `meaning "${attribute}"`,
        angel.people.en && `rules ${angel.people.en}`,
        angel.godName && `god name ${angel.godName}`,
        angel.psalm.psalm > 0 &&
          `psalm ${angel.psalm.psalm}:${angel.psalm.verse}`,
        `${sign.from}–${sign.to}° of ${Data.zodiac[sign.zodiacId].name.en}`,
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
