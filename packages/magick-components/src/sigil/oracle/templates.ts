/**
 * The oracle's templates (plan 088, the corpus's "Templates"): one small
 * text per rule and edge case, each with its plan written out by hand
 * from the rule list in plan 088 ("Plan: what each vertex says") and its
 * decisions, never from a planner's output. Where a plan turns on
 * geometry (R4's noose), the case says how far the letter lies from the
 * chord and where its foot falls, worked from the rose's anchors.
 *
 * The doubled and tripled letters are every letter, not a sample: their
 * plans need no geometry, since a vertex with a crook never takes a noose
 * (decision 4) and the ends never do, so one hand-written shape per
 * position, with the letter filled in, covers all 22.
 */

import {
  ROSE_LETTERS,
  type RoseVersionId,
} from "../../gd/roseSigilInternals.ts";
import type { SigilMark, SigilPlan, SigilVertex } from "../types.ts";

/** A text and the plan it must have on one rose, with `ROSE_SIGIL_PROFILE`. */
export interface PlanTemplate {
  id: string;
  text: string;
  version: RoseVersionId;
  plan: SigilPlan;
  /** The rule or decision it pins, and any measurement it rests on. */
  why: string;
}

function v(
  place: string,
  visit: number,
  crooks: number,
  ...marks: SigilMark[]
): SigilVertex {
  return { place, visit, crooks, marks };
}

/** A one-vertex word: both ends, and a crook per extra letter. */
function lone(place: string, crooks = 0): SigilVertex[] {
  return [
    crooks > 0
      ? v(place, 0, crooks, "start", "crook", "end")
      : v(place, 0, 0, "start", "end"),
  ];
}

/** Every letter doubled and tripled at the start, in the middle and at the end. */
function repeatTemplates(): PlanTemplate[] {
  const templates: PlanTemplate[] = [];
  for (const letter of ROSE_LETTERS.flat()) {
    // Two neighbours that are neither the letter nor each other.
    const [p, n] = ["ש", "ה", "א"].filter((other) => other !== letter);
    for (const count of [2, 3]) {
      const run = letter.repeat(count);
      const crooks = count - 1;
      const why = `R3 and decision 3: a run of ${count} is one vertex with ${crooks} crook${crooks > 1 ? "s" : ""}`;
      templates.push(
        {
          id: `repeat-start-${count}-${letter}`,
          text: run + n,
          version: "gd",
          plan: [[v(letter, 0, crooks, "start", "crook"), v(n, 0, 0, "end")]],
          why: `${why}, at the start too (cause 1 of what is wrong today)`,
        },
        {
          id: `repeat-middle-${count}-${letter}`,
          text: p + run + n,
          version: "gd",
          plan: [
            [
              v(p, 0, 0, "start"),
              v(letter, 0, crooks, "crook"),
              v(n, 0, 0, "end"),
            ],
          ],
          why: `${why}; never a noose (decision 4)`,
        },
        {
          id: `repeat-end-${count}-${letter}`,
          text: p + run,
          version: "gd",
          plan: [[v(p, 0, 0, "start"), v(letter, 0, crooks, "crook", "end")]],
          why: `${why}, at the end with its bar`,
        },
      );
    }
  }
  return templates;
}

const METATRON = [
  v("מ", 0, 0, "start"),
  v("ט", 0, 1, "crook"),
  v("ר", 0, 0, "noose"),
  v("ו", 0, 0),
  v("נ", 0, 0, "end"),
];

/**
 * A start letter passed again with a noose (the review of 18 November
 * 2026): a mother letter lies on the diameter between two outer letters
 * (ה‑א‑ל on the vertical, צ‑מ‑ט and ז‑ש‑ס on the others), so returning to
 * it between them is a straight pass, and its noose sits beside the start
 * circle. V‑P‑V‑N returns at once; V‑X‑P‑V‑N by way of a letter off the
 * line (no noose there: X and P are far off their neighbours' chords).
 */
function startRepassTemplates(): PlanTemplate[] {
  const repass = (
    id: string,
    text: string,
    [start, ...rest]: readonly string[],
  ): PlanTemplate => {
    const [pass, end] = rest.slice(-2);
    const between = rest.slice(0, -2);
    return {
      id,
      text,
      version: "gd",
      plan: [
        [
          v(start, 0, 0, "start"),
          ...between.map((place) => v(place, 0, 0)),
          v(pass, 1, 0, "noose"),
          v(end, 0, 0, "end"),
        ],
      ],
      why: `R4 at a revisit of the start letter: ${start} lies on the chord from ${between[between.length - 1]} to ${end}, so its second visit is a noose beside the start circle; loop clearance keeps the two apart`,
    };
  };
  return [
    repass("repass-vpvn-א-down", "אהאל", ["א", "ה", "א", "ל"]),
    repass("repass-vpvn-א-up", "אלאה", ["א", "ל", "א", "ה"]),
    repass("repass-vpvn-מ-out", "מצמט", ["מ", "צ", "מ", "ט"]),
    repass("repass-vpvn-מ-in", "מטמצ", ["מ", "ט", "מ", "צ"]),
    repass("repass-vpvn-ש-out", "שזשס", ["ש", "ז", "ש", "ס"]),
    repass("repass-vpvn-ש-in", "שסשז", ["ש", "ס", "ש", "ז"]),
    repass("repass-vxpvn-א-ב", "אבהאל", ["א", "ב", "ה", "א", "ל"]),
    repass("repass-vxpvn-א-ג", "אגהאל", ["א", "ג", "ה", "א", "ל"]),
    repass("repass-vxpvn-א-כ", "אכהאל", ["א", "כ", "ה", "א", "ל"]),
    repass("repass-vxpvn-מ-ר", "מרצמט", ["מ", "ר", "צ", "מ", "ט"]),
    repass("repass-vxpvn-ש-ד", "שדסשז", ["ש", "ד", "ס", "ש", "ז"]),
  ];
}

/** A-B-A-B-A: two returns to each place, each a later visit, no marks between. */
function ababaTemplate(a: string, b: string): PlanTemplate {
  return {
    id: `ababa-${a}${b}`,
    text: `${a}${b}${a}${b}${a}`,
    version: "gd",
    plan: [
      [
        v(a, 0, 0, "start"),
        v(b, 0, 0),
        v(a, 1, 0),
        v(b, 1, 0),
        v(a, 2, 0, "end"),
      ],
    ],
    why: "F1 twice over: every return beside the earlier visits; neighbours at one place, so no noose",
  };
}

/** Every template, in a stable order. */
export const PLAN_TEMPLATES: readonly PlanTemplate[] = [
  ...repeatTemplates(),

  // Revisits (rule 3, F1).
  {
    id: "aba",
    text: "אלא",
    version: "gd",
    plan: [[v("א", 0, 0, "start"), v("ל", 0, 0), v("א", 1, 0, "end")]],
    why: "F1: a return is a second visit, with no mark",
  },
  {
    id: "abab",
    text: "אלאל",
    version: "gd",
    plan: [
      [v("א", 0, 0, "start"), v("ל", 0, 0), v("א", 1, 0), v("ל", 1, 0, "end")],
    ],
    why: "Rule 3: each place counts its own visits",
  },
  {
    id: "ababa",
    text: "אלאלא",
    version: "gd",
    plan: [
      [
        v("א", 0, 0, "start"),
        v("ל", 0, 0),
        v("א", 1, 0),
        v("ל", 1, 0),
        v("א", 2, 0, "end"),
      ],
    ],
    why: "Rule 3: a third visit is visit 2",
  },
  {
    id: "visits-count-vertices",
    text: "אאלא",
    version: "gd",
    plan: [[v("א", 0, 1, "start", "crook"), v("ל", 0, 0), v("א", 1, 0, "end")]],
    why: "Rule 3 counts earlier vertices, not letters: a run is one visit",
  },
  {
    id: "crook-on-revisit",
    text: "אלאא",
    version: "gd",
    plan: [[v("א", 0, 0, "start"), v("ל", 0, 0), v("א", 1, 1, "crook", "end")]],
    why: "A repeat on a revisit: visit 1 with its crook and the bar",
  },

  // Straight passes (R4) and collinear runs.
  {
    id: "straight-pass",
    text: "האל",
    version: "gd",
    plan: [[v("ה", 0, 0, "start"), v("א", 0, 0, "noose"), v("ל", 0, 0, "end")]],
    why: "R4: Aleph lies on the He–Lamed chord (0 units off, t = 0.29)",
  },
  {
    id: "straight-pass-reversed",
    text: "לאה",
    version: "gd",
    plan: [[v("ל", 0, 0, "start"), v("א", 0, 0, "noose"), v("ה", 0, 0, "end")]],
    why: "R4 the other way along the same line",
  },
  {
    id: "collinear-run",
    text: "האדל",
    version: "gd",
    plan: [
      [
        v("ה", 0, 0, "start"),
        v("א", 0, 0, "noose"),
        v("ד", 0, 0, "noose"),
        v("ל", 0, 0, "end"),
      ],
    ],
    why: "R4 twice: He, Aleph, Daleth and Lamed all lie on x = 0, in that order",
  },
  {
    id: "collinear-run-reversed",
    text: "לדאה",
    version: "gd",
    plan: [
      [
        v("ל", 0, 0, "start"),
        v("ד", 0, 0, "noose"),
        v("א", 0, 0, "noose"),
        v("ה", 0, 0, "end"),
      ],
    ],
    why: "The collinear run the other way",
  },
  {
    id: "doubled-straight-pass",
    text: "האאל",
    version: "gd",
    plan: [[v("ה", 0, 0, "start"), v("א", 0, 1, "crook"), v("ל", 0, 0, "end")]],
    why: "Decision 4: a doubled letter on a straight pass has its crook and no noose",
  },
  {
    id: "tripled-straight-pass",
    text: "האאאל",
    version: "gd",
    plan: [[v("ה", 0, 0, "start"), v("א", 0, 2, "crook"), v("ל", 0, 0, "end")]],
    why: "Decisions 3 and 4 together",
  },
  {
    id: "doubled-resh",
    text: "טררו",
    version: "gd",
    plan: [[v("ט", 0, 0, "start"), v("ר", 0, 1, "crook"), v("ו", 0, 0, "end")]],
    why: "Decision 4 on Metatron's straight pass at Resh (0.23 units off its chord)",
  },
  {
    id: "beyond-the-end",
    text: "אהל",
    version: "gd",
    plan: [[v("א", 0, 0, "start"), v("ה", 0, 0), v("ל", 0, 0, "end")]],
    why: "R4 needs the foot between the neighbours: He is on the Aleph–Lamed line (0 off) but beyond Aleph (t = −0.4); the line goes back (F3's shape)",
  },
  {
    id: "foot-outside",
    text: "כתה",
    version: "gd",
    plan: [[v("כ", 0, 0, "start"), v("ת", 0, 0), v("ה", 0, 0, "end")]],
    why: "Tau is 0.92 units off the Kaph–He line, within tolerance, but its foot is outside (t = −1.31): no noose",
  },
  {
    id: "foot-outside-regardie1939",
    text: "כתה",
    version: "regardie1939",
    plan: [[v("כ", 0, 0, "start"), v("ת", 0, 0, "noose"), v("ה", 0, 0, "end")]],
    why: "On Regardie's 1939 rose Kaph and Tau change places: Tau is 0.40 off the chord with t = 0.57, a noose",
  },
  {
    id: "near-miss",
    text: "נשה",
    version: "gd",
    plan: [[v("נ", 0, 0, "start"), v("ש", 0, 0), v("ה", 0, 0, "end")]],
    why: "Decision 2: Shin is 1.55 units off the Nun–He chord (t = 0.34), outside the 1-unit tolerance; Binah's Nun→He passes it",
  },
  {
    id: "just-inside",
    text: "אתע",
    version: "gd",
    plan: [[v("א", 0, 0, "start"), v("ת", 0, 0, "noose"), v("ע", 0, 0, "end")]],
    why: "Tau is 0.93 units off the Aleph–Ayin chord (t = 0.69), just inside the tolerance",
  },
  {
    id: "just-inside-regardie1939",
    text: "אתע",
    version: "regardie1939",
    plan: [[v("א", 0, 0, "start"), v("ת", 0, 0), v("ע", 0, 0, "end")]],
    why: "On Regardie's 1939 rose Tau is 11.2 units off that chord",
  },
  {
    id: "rose-version-noose",
    text: "במכ",
    version: "gd",
    plan: [[v("ב", 0, 0, "start"), v("מ", 0, 0, "noose"), v("כ", 0, 0, "end")]],
    why: "Mem is 0.08 units off the Beth–Kaph chord (t = 0.21) on the gd rose",
  },
  {
    id: "rose-version-noose-regardie1939",
    text: "במכ",
    version: "regardie1939",
    plan: [[v("ב", 0, 0, "start"), v("מ", 0, 0), v("כ", 0, 0, "end")]],
    why: "On Regardie's 1939 rose Mem is 4.44 units off it",
  },

  // Lines through the centre (F4) and through letters outside the name (F2).
  {
    id: "through-centre",
    text: "ונ",
    version: "gd",
    plan: [[v("ו", 0, 0, "start"), v("נ", 0, 0, "end")]],
    why: "F4: Vau and Nun face each other across the centre; nothing marks it",
  },
  {
    id: "through-centre-noose",
    text: "זשס",
    version: "gd",
    plan: [[v("ז", 0, 0, "start"), v("ש", 0, 0, "noose"), v("ס", 0, 0, "end")]],
    why: "Zayin–Samekh runs through the centre and Shin (under 0.001 off, t = 0.71)",
  },
  {
    id: "through-centre-noose-2",
    text: "צמט",
    version: "gd",
    plan: [[v("צ", 0, 0, "start"), v("מ", 0, 0, "noose"), v("ט", 0, 0, "end")]],
    why: "Tzaddi–Teth runs through the centre and Mem (under 0.001 off, t = 0.71)",
  },
  {
    id: "through-outside-letter",
    text: "אל",
    version: "gd",
    plan: [[v("א", 0, 0, "start"), v("ל", 0, 0, "end")]],
    why: "F2: Aleph→Lamed runs through Daleth, not in the name: no mark",
  },
  {
    id: "past-outside-letter",
    text: "נה",
    version: "gd",
    plan: [[v("נ", 0, 0, "start"), v("ה", 0, 0, "end")]],
    why: "F2: Nun→He passes Shin, as in Binah",
  },

  // One-letter words, several words and whitespace (R2, decision 6).
  {
    id: "one-letter",
    text: "א",
    version: "gd",
    plan: [lone("א")],
    why: "Decision 6: a one-vertex word has the circle and the bar",
  },
  {
    id: "one-letter-doubled",
    text: "אא",
    version: "gd",
    plan: [lone("א", 1)],
    why: "A one-vertex word with a crook",
  },
  {
    id: "one-letter-tripled",
    text: "אאא",
    version: "gd",
    plan: [lone("א", 2)],
    why: "A one-vertex word with two crooks",
  },
  {
    id: "two-words",
    text: "אל בג",
    version: "gd",
    plan: [
      [v("א", 0, 0, "start"), v("ל", 0, 0, "end")],
      [v("ב", 0, 0, "start"), v("ג", 0, 0, "end")],
    ],
    why: "R2: each word is its own sigil",
  },
  {
    id: "words-reset-visits",
    text: "א א",
    version: "gd",
    plan: [lone("א"), lone("א")],
    why: "R2: words are separate, so the second is no revisit and no crook",
  },
  {
    id: "three-one-letter-words",
    text: "ה ו ה",
    version: "gd",
    plan: [lone("ה"), lone("ו"), lone("ה")],
    why: "R2 and decision 6",
  },
  {
    id: "whitespace-runs",
    text: "  אל \t\n בג  ",
    version: "gd",
    plan: [
      [v("א", 0, 0, "start"), v("ל", 0, 0, "end")],
      [v("ב", 0, 0, "start"), v("ג", 0, 0, "end")],
    ],
    why: "Rule 1: leading, trailing and runs of whitespace make no empty words",
  },
  {
    id: "whitespace-crlf",
    text: "אל\r\nבג",
    version: "gd",
    plan: [
      [v("א", 0, 0, "start"), v("ל", 0, 0, "end")],
      [v("ב", 0, 0, "start"), v("ג", 0, 0, "end")],
    ],
    why: "Rule 1: a line break separates words",
  },
  {
    id: "whitespace-unicode",
    text: "אל בג דה",
    version: "gd",
    plan: [
      [v("א", 0, 0, "start"), v("ל", 0, 0, "end")],
      [v("ב", 0, 0, "start"), v("ג", 0, 0, "end")],
      [v("ד", 0, 0, "start"), v("ה", 0, 0, "end")],
    ],
    why: "Rule 1: a no-break space and an em space are whitespace (Unicode White_Space, as JavaScript's \\s)",
  },
  {
    id: "only-whitespace",
    text: " \t\n ",
    version: "gd",
    plan: [],
    why: "Rule 1: no words",
  },
  {
    id: "empty",
    text: "",
    version: "gd",
    plan: [],
    why: "Rule 1: no words",
  },

  // Final forms (F5) and characters with no place.
  {
    id: "final-forms",
    text: "ך ם ן ף ץ",
    version: "gd",
    plan: [lone("כ"), lone("מ"), lone("נ"), lone("פ"), lone("צ")],
    why: "F5: each final form is drawn at its base letter's place",
  },
  {
    id: "final-repeats-base",
    text: "כך",
    version: "gd",
    plan: [lone("כ", 1)],
    why: "Repeats are decided on places: Kaph and final Kaph share one, so they merge with a crook",
  },
  {
    id: "final-in-word",
    text: "שלום",
    version: "gd",
    plan: [
      [v("ש", 0, 0, "start"), v("ל", 0, 0), v("ו", 0, 0), v("מ", 0, 0, "end")],
    ],
    why: "F5 at the end of a word; Lamed and Vau are far off their chords",
  },
  {
    id: "no-place-latin",
    text: "abc",
    version: "gd",
    plan: [],
    why: "Rule 1: a word left with no places is dropped",
  },
  {
    id: "no-place-mixed",
    text: "a1א! xyz ב?",
    version: "gd",
    plan: [lone("א"), lone("ב")],
    why: "Rule 1: characters with no place are dropped, and the word left empty with them",
  },
  {
    id: "no-place-pointed",
    text: "מְטַטְרוֹן",
    version: "gd",
    plan: [METATRON],
    why: "Rule 1: points are dropped, and the Teths they separated merge (rule 2)",
  },
  {
    id: "no-place-joins-run",
    text: "א-א",
    version: "gd",
    plan: [lone("א", 1)],
    why: "Rule 2 runs over places after rule 1's dropping: a hyphen is no whitespace, so the Alephs merge",
  },
  {
    id: "no-place-maqaf",
    text: "א־ל",
    version: "gd",
    plan: [[v("א", 0, 0, "start"), v("ל", 0, 0, "end")]],
    why: "A maqaf is not whitespace: one word",
  },
  {
    id: "no-place-joiners",
    text: "א‍ל‌ה",
    version: "gd",
    plan: [[v("א", 0, 0, "start"), v("ל", 0, 0), v("ה", 0, 0, "end")]],
    why: "Zero-width joiners are not whitespace and have no place; Lamed→He goes back over Aleph (F3 shape), no noose",
  },
  ...startRepassTemplates(),
  // The last stroke runs back past the first letter's crook.
  {
    id: "crook-crossed-מממדתב",
    text: "מממדתב",
    version: "gd",
    plan: [
      [
        v("מ", 0, 2, "start", "crook"),
        v("ד", 0, 0),
        v("ת", 0, 0),
        v("ב", 0, 0, "end"),
      ],
    ],
    why: "R3 at the start, and a last stroke ending beside the first letter: crook clearance",
  },
  {
    id: "crook-crossed-כככוההגג",
    text: "כככוההגג",
    version: "gd",
    plan: [
      [
        v("כ", 0, 2, "start", "crook"),
        v("ו", 0, 0),
        v("ה", 0, 1, "crook"),
        v("ג", 0, 1, "crook", "end"),
      ],
    ],
    why: "Three crooked vertices; the strokes from He to Gimel pass Kaph's crook",
  },
  {
    id: "crook-crossed-וווגוכהז",
    text: "וווגוכהז",
    version: "gd",
    plan: [
      [
        v("ו", 0, 2, "start", "crook"),
        v("ג", 0, 0),
        v("ו", 1, 0),
        v("כ", 0, 0),
        v("ה", 0, 0),
        v("ז", 0, 0, "end"),
      ],
    ],
    why: "A return to the first letter beside its two crooks, then away: crook clearance",
  },
  // Nooses in a row (second review, M1): two or more letters on one line,
  // each passed straight through, so the whole run is one unbent line.
  {
    id: "noose-run-במכק",
    text: "במכק",
    version: "gd",
    plan: [
      [
        v("ב", 0, 0, "start"),
        v("מ", 0, 0, "noose"),
        v("כ", 0, 0, "noose"),
        v("ק", 0, 0, "end"),
      ],
    ],
    why: "R4 twice in a row on the diameter Beth, Mem, Kaph, Qoph",
  },
  {
    id: "noose-run-גשפו",
    text: "גשפו",
    version: "gd",
    plan: [
      [
        v("ג", 0, 0, "start"),
        v("ש", 0, 0, "noose"),
        v("פ", 0, 0, "noose"),
        v("ו", 0, 0, "end"),
      ],
    ],
    why: "R4 twice in a row on the diameter Gimel, Shin, Peh, Vav",
  },
  {
    id: "noose-run-במכקי",
    text: "במכקי",
    version: "gd",
    plan: [
      [
        v("ב", 0, 0, "start"),
        v("מ", 0, 0, "noose"),
        v("כ", 0, 0, "noose"),
        v("ק", 0, 0),
        v("י", 0, 0, "end"),
      ],
    ],
    why: "Two nooses in a row, then a corner at Qoph, which lies beyond Kaph",
  },
  {
    id: "noose-run-ההאדלה",
    text: "ההאדלה",
    version: "gd",
    plan: [
      [
        v("ה", 0, 1, "start", "crook"),
        v("א", 0, 0, "noose"),
        v("ד", 0, 0, "noose"),
        v("ל", 0, 0),
        v("ה", 1, 0, "end"),
      ],
    ],
    why: "A crook, two nooses in a row down the vertical diameter, and a return up it to He",
  },
  {
    id: "noose-run-בבמכק",
    text: "בבמכק",
    version: "gd",
    plan: [
      [
        v("ב", 0, 1, "start", "crook"),
        v("מ", 0, 0, "noose"),
        v("כ", 0, 0, "noose"),
        v("ק", 0, 0, "end"),
      ],
    ],
    why: "A crook at the start of a run of nooses",
  },
  {
    id: "noose-run-אבמכקש",
    text: "אבמכקש",
    version: "gd",
    plan: [
      [
        v("א", 0, 0, "start"),
        v("ב", 0, 0),
        v("מ", 0, 0, "noose"),
        v("כ", 0, 0, "noose"),
        v("ק", 0, 0),
        v("ש", 0, 0, "end"),
      ],
    ],
    why: "Corners either side of a run of two nooses",
  },
  {
    id: "noose-run-לגשפוה",
    text: "לגשפוה",
    version: "gd",
    plan: [
      [
        v("ל", 0, 0, "start"),
        v("ג", 0, 0),
        v("ש", 0, 0, "noose"),
        v("פ", 0, 0, "noose"),
        v("ו", 0, 0),
        v("ה", 0, 0, "end"),
      ],
    ],
    why: "Corners either side of a run of two nooses on another diameter",
  },
  ababaTemplate("פ", "ל"),
  ababaTemplate("ה", "ו"),
  ababaTemplate("ש", "מ"),
  ababaTemplate("ט", "צ"),
];
