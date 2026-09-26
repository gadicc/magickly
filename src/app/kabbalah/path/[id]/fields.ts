import type { EntityFields } from "@/components/entity/fields";

/** The path page's row, as [Path.tsx](./Path.tsx) lays it out. */
export const fields: EntityFields = {
  table: "tolPath",
  shown: [
    // The path the Tree lights; the pair it spells is read through the links.
    "id",
    // The pair, in the heading and in the lede, each linked.
    "from",
    "to",
    // The Hermetic tree's: the heading's number, the letter with its planet,
    // and the trump, whose rank the image and the name are found by.
    "hermetic.pathNo",
    "hermetic.hebrewLetter",
    "hermetic.tarotId",
    // The Hebrew tree's letter.
    "hebrew.hebrewLetter",
    // The arrows and the nav, named by their headings.
    "next",
    "prev",
  ],
  omitted: [
    // Ids of what the page shows through their links.
    "fromId",
    "toId",
    "hermetic.hebrewLetterId",
    "hebrew.hebrewLetterId",
    "nextId",
    "prevId",
  ],
};
