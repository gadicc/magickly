import { FIELD_PATH_LIST_SEPARATOR } from "./fieldPath.ts";
import type { TreePathAttribution } from "./TreeOfLife.tsx";

/*
 * The Tree's labels and titles. Internal to the package: `TreeOfLife` is
 * the entry; its tests read these.
 */

/**
 * What `pathTitle` reads of a path: each attribution's letter, and the
 * Hermetic Tree's path number and trump. A magick-data path row is one.
 */
export type TitledPath = {
  [A in TreePathAttribution]?: {
    hebrewLetter?: { letter?: { name: string; he: string } };
    pathNo?: number;
    tarotTitle?: string;
  };
};

/**
 * A sphere's label as the lines it is drawn on. A list, which field paths
 * join with "; " (`stones.*.name.en`), takes a line per item, so "star ruby;
 * turquoise" breaks between the stones and not inside one; anything else
 * breaks at its first space, as the Tree always has. Blank words are
 * dropped, as they always were.
 */
export function labelLines(text: string): string[] {
  if (text.includes(FIELD_PATH_LIST_SEPARATOR))
    return text
      .split(FIELD_PATH_LIST_SEPARATOR)
      .map((item) => item.trim())
      .filter((item) => item !== "");
  const words = text.split(" ").filter((word) => word !== "");
  return words.length > 1 ? [words[0], words.slice(1).join(" ")] : words;
}

/**
 * A path's tooltip, which search engines also read: "Path 31: Shin (ש),
 * Judgement" in the Hermetic attribution, the letter alone in the others.
 */
export function pathTitle(
  path: TitledPath,
  letterAttr: TreePathAttribution,
): string {
  const attribution = path[letterAttr];
  const letter = attribution?.hebrewLetter?.letter;
  if (!letter) return "";
  const named = `${letter.name} (${letter.he})`;
  if (letterAttr !== "hermetic") return named;
  const { pathNo, tarotTitle } = attribution;
  return `Path ${pathNo}: ${named}${tarotTitle ? `, ${tarotTitle}` : ""}`;
}
