import * as tarotDeck from "tarot-deck";

// These bundled filenames differ from the package's display names.
const rwsImageNames = {
  2: "High_Priestess",
  5: "Hierophant",
  10: "Wheel_of_Fortune",
  12: "Hanged_Man",
};

/** Returns the local Rider-Waite image URL for a major-arcana rank. */
function RWSPath(rank) {
  const card = tarotDeck.getByRank(rank);
  const name = rwsImageNames[card.rank] ?? card.name.replace(/^The /, "");
  return (
    "/tarot/rws/RWS_Tarot_" +
    String(rank).padStart(2, "0") +
    "_" +
    name +
    ".jpg"
  );
}

// The deck names three trumps for two traditions at once, or in short. The
// pages show the Rider-Waite image, so they name each card as it is printed.
const rwsNames = {
  2: "The High Priestess",
  5: "The Hierophant",
  10: "Wheel of Fortune",
};

/** Returns a major arcanum's name as its Rider-Waite card prints it. */
function RWSName(rank) {
  const card = tarotDeck.getByRank(rank);
  return rwsNames[card.rank] ?? card.name;
}

const numerals = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/**
 * Returns a trump's number as the cards print it, in Roman numerals. The
 * Fool's is 0, which the numerals have no sign for, and the cards print so.
 */
function trumpNumeral(rank) {
  let left = tarotDeck.getByRank(rank).rank;
  if (!left) return "0";
  let out = "";
  for (const [value, numeral] of numerals)
    for (; left >= value; left -= value) out += numeral;
  return out;
}

export { RWSName, RWSPath, tarotDeck, trumpNumeral };
