import "server-only";
import dictionary from "magick-data/enochian/dictionary";
import {
  findTabletName,
  TABLET_NAME_IDS,
  type TabletNameId,
  tabletNameSpellings,
} from "magick-data/enochian/tabletNames";
import tablets, {
  type EnochianTabletID,
  TABLET_VERSIONS,
  type TabletVersionId,
  type TabletView,
  tabletVersion,
  WATCHTOWER_IDS,
} from "magick-data/enochian/tablets";
import { findWord, type Headwords } from "../keys/dictionaryKeys";
import type { NameLink, TabletNameLinks } from "./dictionaryLinks";

export type { NameLink, TabletNameLinks } from "./dictionaryLinks";

/**
 * The dictionary entries the tablets' names link to (plan 090, decision
 * 4), resolved on the server as the Keys page's `keyEntries.ts` resolves
 * its words, so the page ships a small map and never the dictionary.
 *
 * A name links where one of its spellings is a headword, tried in order:
 * the version's own spelling (both of the King's, in Dee's and Raphael's
 * versions), every other version's (`tabletNameSpellings`), then the
 * version's spelling with one square read as one of its second letters.
 * Each is looked up as the Keys look a word up (U and V either way, a
 * hyphen in a key ignored), then case and u/v folded letter by letter,
 * as the names' dictionary test counts them. The dictionary decides links
 * only; its tablet roles come from an unsourced compilation (`WE`), so a
 * link does not vouch for a name.
 */

/** A key folded for comparison: case, u for v, and hyphens left out. */
const fold = (word: string) =>
  word.toLowerCase().replaceAll("v", "u").replaceAll("-", "");

/** Each folded key, to the first key in the file that folds to it. */
function foldedIndex(source: Headwords) {
  const index = new Map<string, string>();
  for (const key of Object.keys(source)) {
    // A trailing hyphen marks an affix, which no name should resolve to.
    if (key.endsWith("-")) continue;
    const folded = fold(key);
    if (!index.has(folded)) index.set(folded, key);
  }
  return index;
}

/** A spelling's headword, or undefined. */
function headword(
  source: Headwords,
  index: ReadonlyMap<string, string>,
  spelling: string,
): string | undefined {
  if (spelling.includes("?")) return undefined;
  return findWord(source, spelling.toUpperCase()) ?? index.get(fold(spelling));
}

/**
 * The version's spelling of a name with one square read as one of its
 * second letters, each such reading once.
 */
function secondLetterSpellings(view: TabletView, id: string): string[] {
  const name = findTabletName(view, id);
  if (!name) return [];
  const found: string[] = [];
  name.squares.forEach(({ row, column }, index) => {
    const mark = view.marks.find(
      (each) => each.row === row && each.column === column,
    );
    for (const letter of mark?.alt ?? []) {
      // Dee's and Raphael's King reads one centre square of the two.
      for (const spelling of name.spellings ?? [name.spelling]) {
        if (index >= spelling.length) continue;
        const read =
          spelling.slice(0, index) + letter + spelling.slice(index + 1);
        if (!found.includes(read)) found.push(read);
      }
    }
  });
  return found;
}

/** One name's headword in one version of a tablet, if it has one. */
export function nameHeadword(
  tablet: EnochianTabletID,
  version: TabletVersionId,
  id: TabletNameId,
  source: Headwords = dictionary,
  index: ReadonlyMap<string, string> = foldedIndex(source),
): string | undefined {
  const view = tabletVersion(tablets[tablet], version);
  if (!view) return undefined;
  for (const spelling of [
    ...tabletNameSpellings(tablets[tablet], id, version),
    ...secondLetterSpellings(view, id),
  ]) {
    const found = headword(source, index, spelling);
    if (found) return found;
  }
  return undefined;
}

/**
 * Every name's headword on every tablet, the Watchtowers' and the Tablet
 * of Union's, in every version that has the name. One key where every
 * version with the name finds the same; the archangels and the Union's
 * names are the Golden Dawn's versions' alone, so one key serves them
 * where those three agree.
 */
export function tabletNameLinks(
  source: Headwords = dictionary,
): TabletNameLinks {
  const index = foldedIndex(source);
  const links: Record<string, Partial<Record<TabletNameId, NameLink>>> = {};
  for (const tablet of [...WATCHTOWER_IDS, "union"] as const) {
    const names: Partial<Record<TabletNameId, NameLink>> = {};
    for (const id of TABLET_NAME_IDS) {
      const having = TABLET_VERSIONS.filter((version) => {
        const view = tabletVersion(tablets[tablet], version);
        return view && findTabletName(view, id);
      });
      const byVersion: Partial<Record<TabletVersionId, string>> = {};
      for (const version of having) {
        const found = nameHeadword(tablet, version, id, source, index);
        if (found) byVersion[version] = found;
      }
      const keys = new Set(Object.values(byVersion));
      if (keys.size === 0) continue;
      names[id] =
        keys.size === 1 && Object.keys(byVersion).length === having.length
          ? [...keys][0]
          : byVersion;
    }
    links[tablet] = names;
  }
  return links;
}

/**
 * What the page ships: every name's headword in every version.
 * Resolved once, at import, since the dictionary does not change while
 * the process runs.
 */
export const TABLET_NAME_LINKS: TabletNameLinks = tabletNameLinks();
