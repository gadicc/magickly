/**
 * The seventy-two triads of the Shem HaMephorash, derived from Exodus
 * 14:19–21, the three verses of seventy-two letters each.
 *
 * The first triad takes the first letter of verse 19, the last letter of
 * verse 20 and the first letter of verse 21; each later triad steps one letter
 * on in verses 19 and 21 and one letter back in verse 20. Each of the
 * seventy-two genii is named from its triad with יה or אל added, so the triad
 * is a check on a name read from a page: it is how the reissue's misprints of
 * the 37th, 68th and 69th were confirmed, and it shows where Lenain's own
 * spelling departs from the verse.
 *
 * The verses are the consonantal Masoretic text of Exodus 14:19–21, vowels
 * and cantillation removed. It is public domain, and its letters are the same
 * in any Masoretic edition (the Leningrad Codex, for one). They were checked
 * letter for letter against Sefaria's "Miqra according to the Masorah" on 18
 * November 2026:
 * https://www.sefaria.org/Exodus.14.19-21?ven=Miqra_according_to_the_Masorah&lang=he
 *
 * Not exported from the package: the edition's checks use it, and nothing
 * else does yet.
 */

/** Exodus 14:19, 20 and 21, consonants and spaces only. */
export const EXODUS_14_19_21 = [
  "ויסע מלאך האלהים ההלך לפני מחנה ישראל וילך מאחריהם ויסע עמוד הענן מפניהם ויעמד מאחריהם",
  "ויבא בין מחנה מצרים ובין מחנה ישראל ויהי הענן והחשך ויאר את הלילה ולא קרב זה אל זה כל הלילה",
  "ויט משה את ידו על הים ויולך יהוה את הים ברוח קדים עזה כל הלילה וישם את הים לחרבה ויבקעו המים",
] as const;

const FINAL_FORMS: Record<string, string> = {
  ך: "כ",
  ם: "מ",
  ן: "נ",
  ף: "פ",
  ץ: "צ",
};

/**
 * Hebrew letters with each final form replaced by its ordinary one, so that a
 * triad and a name can be compared letter for letter. Everything that is not
 * a letter, spaces and marks included, is dropped.
 */
export function normaliseFinals(hebrew: string): string {
  return [...hebrew]
    .filter((c) => /[א-ת]/.test(c))
    .map((c) => FINAL_FORMS[c] ?? c)
    .join("");
}

/** Each verse as its seventy-two letters, final forms normalised. */
export function verseLetters(): string[][] {
  return EXODUS_14_19_21.map((verse) => [...normaliseFinals(verse)]);
}

/**
 * The triad of the nth genius, 1 to 72, final forms normalised: verse 19's
 * nth letter, verse 20's nth from the end, and verse 21's nth.
 */
export function triadOf(no: number): string {
  if (!Number.isInteger(no) || no < 1 || no > 72)
    throw new RangeError(`Not one of the 72: ${no}`);
  const [v19, v20, v21] = verseLetters();
  const n = no - 1;
  return v19[n] + v20[71 - n] + v21[n];
}
