import type { ReactNode } from "react";

/** A script's language and direction, for marking a run of it. */
export interface Script {
  lang: string;
  dir: "rtl" | "ltr";
}

/**
 * The scripts a note or a table cell may hold besides the Latin alphabet:
 * Lenain's Hebrew, and the names on Kircher's plate of the names of God by
 * nation (Syriac, Arabic, Armenian, Greek). A Greek run takes in the Latin
 * capitals the engraver mixed into it (ΔƐΟS, with an open E and a Latin S).
 * No font is loaded for any but Hebrew; the others fall back to the
 * system's.
 */
const SCRIPTS: [RegExp, Script][] = [
  [/[֐-׿יִ-ﭏ]+/, { lang: "he", dir: "rtl" }],
  [/[܀-ݏ]+/, { lang: "syr", dir: "rtl" }],
  [/[؀-ۿ]+/, { lang: "ar", dir: "rtl" }],
  [/[԰-֏]+/, { lang: "hy", dir: "ltr" }],
  [/[Ͱ-Ͽἀ-῿Ɛ][Ͱ-Ͽἀ-῿ƐA-Z]*/, { lang: "grc", dir: "ltr" }],
];

/** The script a run is in, if it is in one of `SCRIPTS`. */
export function scriptOf(text: string): Script | undefined {
  return SCRIPTS.find(([pattern]) => pattern.test(text))?.[1];
}

/**
 * A text cut at its runs of Hebrew and the other scripts above, each run
 * handed to `mark` to be set in its own language and direction, the rest
 * left as it is. Shared by the reading edition, the angels' pages and the
 * first table, so that a name inside an editorial note is marked the same
 * way wherever the note is shown.
 */
export function scriptRuns(
  text: string,
  keyPrefix: string,
  mark: (run: string, key: string, script: Script) => ReactNode,
): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let index = 0;
  while (rest) {
    let first: { at: number; run: string; script: Script } | undefined;
    for (const [pattern, script] of SCRIPTS) {
      const found = rest.match(pattern);
      if (found?.index !== undefined && (!first || found.index < first.at))
        first = { at: found.index, run: found[0], script };
    }
    if (!first) {
      out.push(rest);
      break;
    }
    if (first.at > 0) out.push(rest.slice(0, first.at));
    out.push(
      mark(
        first.run,
        `${keyPrefix}-${first.script.lang}-${index}`,
        first.script,
      ),
    );
    rest = rest.slice(first.at + first.run.length);
    index++;
  }
  return out;
}
