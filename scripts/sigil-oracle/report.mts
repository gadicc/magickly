/**
 * `pnpm sigils:oracle`: plan 088's accuracy report ("Measuring
 * accuracy"). It runs the oracle over the corpus against the engine and
 * writes, to `--out <dir>` (default `output/sigil-oracle/`, git-ignored):
 *
 * - `report.json` and `report.md`: per rule, how many cases it applies to
 *   and how many pass; per oracle check (O1 plans, O2 invariants, O3
 *   read-back, the 1-ulp check), the same; per name of the 72, which
 *   checks fail; and every failing case, as a known failure (expected:
 *   `engineKnownFailures.ts`, which the engine suite holds it to) or a
 *   regression, with the known failures that now pass;
 * - the corpus is the engine suite's: hand fixtures, templates, the 72
 *   names, every pair and triple, the seeded random corpus and the
 *   domain's edge words, every A-B-A-B-A word, the kamea stubs; and,
 *   apart from it, a seeded random set of 13- to 32-letter words beyond
 *   the tested domain, reported on its own;
 * - contact sheets, each as SVG and PNG (`@resvg/resvg-wasm`, with the
 *   repository's own Noto fonts): `names` (the 72 on the Golden Dawn's
 *   rose), `hardest-triples` (the three-letter texts placement moved
 *   most) and `r4` (every vertex of the 72 names, the templates and the
 *   triples whose anchor lies 0.5–3 units off the chord between its
 *   neighbours' anchors, its foot between them, drawn as placed at the
 *   current noose tolerance, labelled with that distance and sorted by
 *   it: the sheet decision 2 is judged on).
 *
 * With `SIGIL_ORACLE_EXTERNAL=<dir>` it also runs O4: it reads
 * `<dir>/annotation-reconciled.json` (Vaughan's figures, annotated; never
 * in the repository) and compares our plan of each figure's spelling,
 * letter by letter, with his marks, writing `o4-comparison.json` and
 * `o4-comparison.md` into that directory and nowhere else: not into
 * `--out`, and not into the repository.
 *
 * `--tiny` runs a handful of cases of each kind, for the smoke test.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import type { KameaPlanetId } from "magick-data/astrology/kameas";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RoseSigilImage from "../../packages/magick-components/src/gd/RoseSigilImage.tsx";
import type { RoseVersionId } from "../../packages/magick-components/src/gd/roseSigilInternals.ts";
import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "../../packages/magick-components/src/gd/roseSigilLayout.ts";
import {
  sigilFrame,
  sigilPathData,
  sigilViewBox,
} from "../../packages/magick-components/src/sigil/ink.ts";
import {
  kameaUnroundedAnchor,
  roseUnroundedAnchor,
} from "../../packages/magick-components/src/sigil/oracle/anchors.ts";
import {
  ababaTexts,
  BEYOND_DOMAIN_CORPUS,
  DOMAIN_EDGE_TEXTS,
  randomRoseTexts,
  roseTexts,
  SEVENTY_TWO_NAMES,
} from "../../packages/magick-components/src/sigil/oracle/corpus.ts";
import { ENGINE_KNOWN_FAILURES } from "../../packages/magick-components/src/sigil/oracle/engineKnownFailures.ts";
import {
  HAND_FIXTURES,
  KAMEA_FIXTURES,
} from "../../packages/magick-components/src/sigil/oracle/fixtures.ts";
import {
  checkInvariants,
  checkStability,
  type InvariantCheck,
  type InvariantFailure,
} from "../../packages/magick-components/src/sigil/oracle/invariants.ts";
import {
  KAMEA_STUB_PROFILE,
  planetKameaLayout,
} from "../../packages/magick-components/src/sigil/oracle/kameaLayout.ts";
import { firstDifference } from "../../packages/magick-components/src/sigil/oracle/o1.ts";
import {
  checkReadBack,
  type ReadBackFailure,
} from "../../packages/magick-components/src/sigil/oracle/readBack.ts";
import {
  referencePlan,
  referenceWords,
} from "../../packages/magick-components/src/sigil/oracle/referencePlan.ts";
import { PLAN_TEMPLATES } from "../../packages/magick-components/src/sigil/oracle/templates.ts";
import { placeSigil } from "../../packages/magick-components/src/sigil/placeSigil.ts";
import {
  planSigil,
  sigilWords,
} from "../../packages/magick-components/src/sigil/planSigil.ts";
import {
  SigilImage,
  sigilFigure,
} from "../../packages/magick-components/src/sigil/SigilImage.tsx";
import type {
  PlacedWord,
  Point,
  SigilLayout,
  SigilPlan,
} from "../../packages/magick-components/src/sigil/types.ts";
import { svgCoordinate } from "../../packages/magick-components/src/svgCoordinate.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const VERSIONS: readonly RoseVersionId[] = ["gd", "regardie1939"];

/** Which corpus a case comes from. */
type Corpus =
  | "fixtures"
  | "templates"
  | "names"
  | "pairs"
  | "triples"
  | "random"
  | "domain-edge"
  | "ababa"
  | "kamea"
  | "beyond";

/** One text to judge, with the plan it must have. */
interface Case {
  corpus: Corpus;
  id: string;
  text: string;
  version: RoseVersionId;
  expected: SigilPlan;
  /** A kamea stub's square and numbers; `version` is then unused. */
  kamea?: { planet: KameaPlanetId; numbers: readonly number[] };
}

/** What the oracle says of a case. */
interface Verdict {
  case: Case;
  /** O1: how the engine's plan differs from the expected one, or null. */
  o1: string | null;
  o2: InvariantFailure[];
  o3: ReadBackFailure[];
  /** The 1-ulp check, for the cases it runs on (names and fixtures). */
  stable?: boolean;
  /** The engine's placed words. */
  placed: PlacedWord[];
}

/** A rule of plan 088, the O2 checks that judge it and when it applies. */
interface Rule {
  id: string;
  title: string;
  checks: readonly InvariantCheck[];
  applies(plan: SigilPlan): boolean;
}

const RULES: readonly Rule[] = [
  {
    id: "R1",
    title: "start circle at the first letter",
    checks: ["start-circle"],
    applies: () => true,
  },
  {
    id: "R2",
    title: "several words, several sigils",
    checks: ["words", "figure"],
    applies: (plan) => plan.length > 1,
  },
  {
    id: "R3",
    title: "a crook per repeated letter, clear of other ink",
    checks: ["crook", "crook-clearance"],
    applies: (plan) => plan.some((w) => w.some((v) => v.crooks > 0)),
  },
  {
    id: "R4",
    title: "a noose on a straight pass, clear of the other loops",
    checks: ["noose", "loop-clearance"],
    applies: (plan) =>
      plan.some((w) => w.some((v) => v.marks.includes("noose"))),
  },
  {
    id: "R5",
    title: "a bar at the last letter, clear of other ink",
    checks: ["bar", "bar-clearance"],
    applies: () => true,
  },
  {
    id: "R6",
    title: "every vertex within its place's slack, inside the rose",
    checks: ["slack", "outer-ring"],
    applies: () => true,
  },
  {
    id: "F1/F3",
    title: "a revisit beside the first visit, strokes apart",
    checks: ["overlap", "clearance"],
    applies: (plan) => plan.some((w) => w.some((v) => v.visit > 0)),
  },
  {
    id: "Ink",
    title: "every piece of ink a known mark",
    checks: ["shape"],
    applies: () => true,
  },
  {
    id: "Domain",
    title: "inside the figure grammar's domain",
    checks: ["domain"],
    applies: () => true,
  },
];

const draw = (text: string, layout: SigilLayout<string>) =>
  renderToStaticMarkup(
    createElement(SigilImage, { text, layout, profile: ROSE_SIGIL_PROFILE }),
  );

const reference = (text: string, version: RoseVersionId) =>
  referencePlan(
    referenceWords(text),
    roseSigilLayout(version),
    ROSE_SIGIL_PROFILE,
  );

/** The corpus: hand fixtures, templates, the 72 names, every pair and triple. */
function corpus(tiny: boolean): Case[] {
  const take = <T,>(items: readonly T[], n: number) =>
    tiny ? items.slice(0, n) : items;
  const cases: Case[] = [];
  for (const f of take(HAND_FIXTURES, 2))
    cases.push({
      corpus: "fixtures",
      id: f.id,
      text: f.text,
      version: "gd",
      expected: f.plan,
    });
  for (const t of take(PLAN_TEMPLATES, 4))
    cases.push({
      corpus: "templates",
      id: t.id,
      text: t.text,
      version: t.version,
      expected: t.plan,
    });
  for (const f of take(KAMEA_FIXTURES, 1))
    cases.push({
      corpus: "kamea",
      id: f.id,
      text: f.numbers.join(","),
      version: "gd",
      expected: f.plan,
      kamea: { planet: f.planet, numbers: f.numbers },
    });
  const random = randomRoseTexts();
  for (const version of VERSIONS) {
    for (const [corpusName, texts] of [
      ["random", random],
      ["domain-edge", DOMAIN_EDGE_TEXTS],
      ["ababa", ababaTexts(version)],
    ] as const)
      for (const text of take(texts, 3))
        cases.push({
          corpus: corpusName,
          id: text,
          text,
          version,
          expected: reference(text, version),
        });
    for (const n of take(SEVENTY_TWO_NAMES, 3))
      cases.push({
        corpus: "names",
        id: n.id,
        text: n.text,
        version,
        expected: reference(n.text, version),
      });
    for (const [corpusName, length] of [
      ["pairs", 2],
      ["triples", 3],
    ] as const)
      for (const text of take([...roseTexts(length, version)], 5))
        cases.push({
          corpus: corpusName,
          id: text,
          text,
          version,
          expected: reference(text, version),
        });
  }
  return cases;
}

/** Words beyond the tested domain: 13 to 32 letters, on both roses. */
function beyondCorpus(tiny: boolean): Case[] {
  const texts = randomRoseTexts(
    tiny
      ? { ...BEYOND_DOMAIN_CORPUS, perLength: 1, maxLength: 14 }
      : BEYOND_DOMAIN_CORPUS,
  );
  return VERSIONS.flatMap((version) =>
    texts.map((text) => ({
      corpus: "beyond" as const,
      id: text,
      text,
      version,
      expected: reference(text, version),
    })),
  );
}

/** A kamea stub drawn by the engine, as the engine suite draws it. */
async function judgeKamea(c: Case, stability: boolean): Promise<Verdict> {
  const { planet, numbers } = c.kamea ?? { planet: "saturn", numbers: [] };
  const layout = planetKameaLayout(planet);
  const drawNumbers = (text: string, l: SigilLayout<number>) => {
    const plan = planSigil(
      [text.split(",").map(Number)],
      l,
      KAMEA_STUB_PROFILE,
    );
    const d = sigilPathData(
      placeSigil(plan, l, KAMEA_STUB_PROFILE),
      l,
      KAMEA_STUB_PROFILE,
    );
    const viewBox = sigilViewBox(sigilFrame(l), plan.length).join(" ");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path stroke="red" stroke-width="${l.unit}" fill="none" d="${d}"/></svg>`;
  };
  const plan = planSigil([[...numbers]], layout, KAMEA_STUB_PROFILE);
  const svg = drawNumbers(c.text, layout);
  const verdict: Verdict = {
    case: c,
    o1: firstDifference(c.expected, plan),
    o2: checkInvariants(svg, c.expected, layout),
    o3: checkReadBack(svg, c.expected, layout).failures,
    placed: placeSigil(plan, layout, KAMEA_STUB_PROFILE),
  };
  if (stability)
    verdict.stable = (
      await checkStability(drawNumbers, c.text, layout, {
        unrounded: kameaUnroundedAnchor(Math.sqrt(layout.places.length)),
        quantise: svgCoordinate,
      })
    ).stable;
  return verdict;
}

async function judge(c: Case, stability: boolean): Promise<Verdict> {
  if (c.kamea) return judgeKamea(c, stability);
  const layout = roseSigilLayout(c.version);
  const plan = planSigil(sigilWords(c.text), layout, ROSE_SIGIL_PROFILE);
  const svg = draw(c.text, layout);
  const verdict: Verdict = {
    case: c,
    o1: firstDifference(c.expected, plan),
    o2: checkInvariants(svg, c.expected, layout),
    o3: checkReadBack(svg, c.expected, layout).failures,
    placed: sigilFigure(c.text, layout, ROSE_SIGIL_PROFILE).placed,
  };
  // Nudged before the layout rounds its anchors, as the engine suite does.
  if (stability)
    verdict.stable = (
      await checkStability(draw, c.text, layout, {
        unrounded: roseUnroundedAnchor(c.version),
        quantise: svgCoordinate,
      })
    ).stable;
  return verdict;
}

/** The key `engineKnownFailures.ts` gives a case. */
const knownKey = (c: Case) =>
  c.kamea ? `kamea ${c.id}` : `${c.version} ${c.text}`;

/**
 * The checks a case is known to fail, if any. Regardie's rose moves only
 * Kaph and Tau, so a word with neither is the gd rose's figure, which the
 * engine suite draws once.
 */
function knownFailure(c: Case): string | undefined {
  return (
    ENGINE_KNOWN_FAILURES[knownKey(c)] ??
    (!c.kamea && c.version !== "gd" && !/[כת]/u.test(c.text)
      ? ENGINE_KNOWN_FAILURES[`gd ${c.text}`]
      : undefined)
  );
}

/** The checks a verdict fails, named as `engineKnownFailures.ts` names them. */
function checksFailed(v: Verdict): string {
  const checks: string[] = [...new Set(v.o2.map((f) => f.check))].sort();
  if (v.o3.length) checks.push("O3");
  return checks.join(" ");
}

/** A verdict's failures, one short line each. */
function failures(v: Verdict): string[] {
  return [
    ...(v.o1 ? [`O1: ${v.o1}`] : []),
    ...v.o2.map(
      (f) => `O2 ${f.check}${f.place ? ` at ${f.place}` : ""}: ${f.message}`,
    ),
    ...v.o3.map((f) => `O3: ${f.message}`),
    ...(v.stable === false ? ["1-ulp: the drawing changes"] : []),
  ];
}

interface Tally {
  applies: number;
  passes: number;
}

function tallies(verdicts: readonly Verdict[]) {
  const rules: Record<string, Tally & { title: string }> = {};
  for (const rule of RULES) {
    const applicable = verdicts.filter((v) => rule.applies(v.case.expected));
    const passing = applicable.filter(
      (v) =>
        !v.o2.some((f) => rule.checks.includes(f.check)) &&
        (rule.id !== "R2" ||
          !v.o3.some((f) => /word\(s\) drawn/.test(f.message))),
    );
    rules[rule.id] = {
      title: rule.title,
      applies: applicable.length,
      passes: passing.length,
    };
  }
  const stable = verdicts.filter((v) => v.stable !== undefined);
  const oracle: Record<string, Tally> = {
    "O1 plans": {
      applies: verdicts.length,
      passes: verdicts.filter((v) => !v.o1).length,
    },
    "O2 invariants": {
      applies: verdicts.length,
      passes: verdicts.filter((v) => v.o2.length === 0).length,
    },
    "O3 read-back": {
      applies: verdicts.length,
      passes: verdicts.filter((v) => v.o3.length === 0).length,
    },
    "O2 1-ulp": {
      applies: stable.length,
      passes: stable.filter((v) => v.stable).length,
    },
    All: {
      applies: verdicts.length,
      passes: verdicts.filter((v) => failures(v).length === 0).length,
    },
  };
  const byCorpus: Record<string, Tally> = {};
  for (const v of verdicts) {
    const key = v.case.kamea
      ? v.case.corpus
      : `${v.case.corpus} (${v.case.version})`;
    byCorpus[key] ??= { applies: 0, passes: 0 };
    byCorpus[key].applies++;
    if (failures(v).length === 0) byCorpus[key].passes++;
  }
  return { rules, oracle, byCorpus };
}

// ---------------------------------------------------------------- sheets

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};
const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ESCAPES[c]);

/**
 * A label in display order: resvg lays text out left to right with no
 * bidi, which drew ללהאל as לאהלל. Hebrew runs (with the spaces between
 * their words) are reversed and the text is drawn with a left-to-right
 * override, so resvg and browsers both show it as a reader would.
 */
const displayOrder = (text: string) =>
  text.replace(/[\u0590-\u05ff]+(?:\s+[\u0590-\u05ff]+)*/g, (run) =>
    [...run].reverse().join(""),
  );
const LTR_OVERRIDE = 'direction="ltr" unicode-bidi="bidi-override"';

interface Cell {
  /** A complete `<svg …>` drawing; it is placed in its cell by its own viewBox. */
  svg: string;
  labels: string[];
  /** Outlined in red: the case fails a check. */
  failing?: boolean;
}

/** Cells in a grid, each drawing square with its labels under it. */
function sheet(
  title: string,
  cells: readonly Cell[],
  columns = 12,
  size = 180,
): string {
  const labelHeight = 16;
  const pitchX = size + 12;
  const pitchY = size + 3 * labelHeight + 12;
  const rows = Math.max(1, Math.ceil(cells.length / columns));
  const width = columns * pitchX + 12;
  const height = rows * pitchY + 48;
  const body = cells
    .map((cell, i) => {
      const x = 12 + (i % columns) * pitchX;
      const y = 40 + Math.floor(i / columns) * pitchY;
      const drawing = cell.svg.replace(
        /^<svg /,
        `<svg x="${x}" y="${y}" width="${size}" height="${size}" `,
      );
      const frame = `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="none" stroke="${cell.failing ? "#d00" : "#ccc"}" stroke-width="${cell.failing ? 3 : 1}"/>`;
      const labels = cell.labels
        .map(
          (label, k) =>
            `<text x="${x + size / 2}" y="${y + size + (k + 1) * labelHeight}" text-anchor="middle" font-size="13" ${LTR_OVERRIDE}>${escape(displayOrder(label))}</text>`,
        )
        .join("");
      return drawing + frame + labels;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<rect width="100%" height="100%" fill="#fff"/>
<text x="12" y="26" font-size="18" ${LTR_OVERRIDE}>${escape(displayOrder(title))}</text>
${body}
</svg>
`;
}

/** The figure of `text` on its rose, the rose behind it. */
const roseFigure = (text: string, version: RoseVersionId) =>
  renderToStaticMarkup(createElement(RoseSigilImage, { text, version }));

/**
 * A window `size` units square about `centre` in word `index` of `text`'s
 * figure, with the chord from `from` to `to` dashed and the anchor marked.
 */
function vertexWindow(
  text: string,
  version: RoseVersionId,
  index: number,
  centre: Point,
  from: Point,
  to: Point,
  size = 24,
): string {
  const layout = roseSigilLayout(version);
  const svg = renderToStaticMarkup(
    createElement(SigilImage, {
      text,
      layout,
      profile: ROSE_SIGIL_PROFILE,
      backdrop: (offset: Point, i: number) =>
        i === index
          ? createElement(
              "g",
              { key: i, transform: `translate(${offset.x} ${offset.y})` },
              createElement("line", {
                x1: from.x,
                y1: from.y,
                x2: to.x,
                y2: to.y,
                stroke: "#888",
                strokeWidth: 0.15,
                strokeDasharray: "0.6 0.4",
              }),
              createElement("circle", {
                cx: centre.x,
                cy: centre.y,
                r: 0.35,
                fill: "#06c",
              }),
            )
          : null,
    }),
  );
  const pitch = 100;
  const x = centre.x - index * pitch - size / 2;
  const y = centre.y - size / 2;
  return svg.replace(/viewBox="[^"]*"/, `viewBox="${x} ${y} ${size} ${size}"`);
}

/** How far `v` lies from the chord `p`–`n`, when its foot falls strictly between them. */
function offChord(p: Point, v: Point, n: Point): number | null {
  const dx = n.x - p.x;
  const dy = n.y - p.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return null;
  const t = ((v.x - p.x) * dx + (v.y - p.y) * dy) / l2;
  if (!(t > 0 && t < 1)) return null;
  return Math.abs(dx * (v.y - p.y) - dy * (v.x - p.x)) / Math.sqrt(l2);
}

/** Every vertex of `cases` 0.5–3 units off its neighbours' chord, nearest first. */
function nearChordVertices(cases: readonly Case[]) {
  const found: {
    case: Case;
    word: number;
    vertex: number;
    distance: number;
    anchors: [Point, Point, Point];
    noose: boolean;
  }[] = [];
  for (const c of cases) {
    const layout = roseSigilLayout(c.version);
    const plan = planSigil(sigilWords(c.text), layout, ROSE_SIGIL_PROFILE);
    plan.forEach((word, w) => {
      for (let i = 1; i < word.length - 1; i++) {
        const [p, v, n] = [word[i - 1], word[i], word[i + 1]];
        if (v.crooks > 0 || p.place === n.place) continue;
        const anchors: [Point, Point, Point] = [
          layout.anchor(p.place),
          layout.anchor(v.place),
          layout.anchor(n.place),
        ];
        const d = offChord(...anchors);
        if (d !== null && d >= 0.5 && d <= 3)
          found.push({
            case: c,
            word: w,
            vertex: i,
            distance: d,
            anchors,
            noose: v.marks.includes("noose"),
          });
      }
    });
  }
  return found.sort(
    (a, b) => a.distance - b.distance || a.case.text.localeCompare(b.case.text),
  );
}

/** How far placement moved a figure's vertices from their anchors, in all. */
function moved(v: Verdict): number {
  const layout = roseSigilLayout(v.case.version);
  let total = 0;
  for (const word of v.placed)
    for (const vertex of word) {
      const a = layout.anchor(vertex.place);
      total += Math.hypot(vertex.point.x - a.x, vertex.point.y - a.y);
    }
  return total;
}

let resvgReady: Promise<void> | undefined;
let fonts: Uint8Array[] | undefined;

/** `svg` as a PNG, drawn by resvg with the repository's Noto fonts. */
async function png(svg: string): Promise<Uint8Array> {
  resvgReady ??= initWasm(
    readFileSync(join(REPO, "node_modules/@resvg/resvg-wasm/index_bg.wasm")),
  );
  await resvgReady;
  fonts ??= ["NotoSans-Regular.ttf", "NotoSansHebrew-Regular.ttf"].map((file) =>
    readFileSync(join(REPO, "public/fonts", file)),
  );
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: fonts,
      defaultFontFamily: "Noto Sans",
      loadSystemFonts: false,
    },
  });
  try {
    return resvg.render().asPng();
  } finally {
    resvg.free();
  }
}

// ---------------------------------------------------------------- O4

/** One letter of one of Vaughan's figures, as the annotation records it. */
interface ExternalLetter {
  letter: string;
  circle: boolean;
  bar: boolean;
  beads: number;
  lobesToNext: number;
  besideEarlierVisit: boolean | null;
}

interface ExternalFigure {
  n: number;
  /** The PDF's page that holds the figure. */
  page: number;
  spelling: string;
  notes?: string;
  letters: ExternalLetter[];
}

const MARK_FIELDS = [
  "circle",
  "bar",
  "beads",
  "lobesToNext",
  "besideEarlierVisit",
] as const;
type MarkField = (typeof MARK_FIELDS)[number];
type LetterMarks = Record<MarkField, number | boolean>;

/**
 * Our plan of `spelling` as his annotation counts marks, letter by
 * letter: a vertex covers its letter and one more per crook; a crook is
 * two lobes between each pair of its letters, a noose one bead, a
 * revisit's first letter drawn beside the earlier visit.
 */
function ourLetters(spelling: string): LetterMarks[] {
  const plan = planSigil(
    sigilWords(spelling),
    roseSigilLayout("gd"),
    ROSE_SIGIL_PROFILE,
  );
  const letters: LetterMarks[] = [];
  for (const word of plan)
    for (const v of word)
      for (let k = 0; k <= v.crooks; k++)
        letters.push({
          circle: k === 0 && v.marks.includes("start"),
          bar: k === v.crooks && v.marks.includes("end"),
          beads: v.marks.includes("noose") ? 1 : 0,
          lobesToNext: k < v.crooks ? 2 : 0,
          besideEarlierVisit: k === 0 && v.visit > 0,
        });
  return letters;
}

/** O4: our plans against Vaughan's marks, written into `dir` alone. */
function runO4(dir: string) {
  const annotation = JSON.parse(
    readFileSync(join(dir, "annotation-reconciled.json"), "utf8"),
  ) as { figures: ExternalFigure[] };
  const figures = annotation.figures.map((figure) => {
    const ours = ourLetters(figure.spelling);
    const differences: string[] = [];
    if (ours.length !== figure.letters.length)
      differences.push(
        `${ours.length} letters planned, ${figure.letters.length} annotated`,
      );
    figure.letters.forEach((his, i) => {
      const mine = ours[i];
      if (!mine) return;
      for (const field of MARK_FIELDS) {
        const a = mine[field];
        const b =
          field === "besideEarlierVisit" ? his[field] === true : his[field];
        if (a !== b)
          differences.push(
            `letter ${i + 1} (${his.letter}) ${field}: ours ${a}, his ${b}`,
          );
      }
    });
    return {
      n: figure.n,
      spelling: figure.spelling,
      agrees: differences.length === 0,
      differences,
    };
  });
  const agree = figures.filter((f) => f.agrees).length;
  const summary = {
    tolerance: ROSE_SIGIL_PROFILE.nooseTolerance,
    figures: figures.length,
    agree,
  };
  writeFileSync(
    join(dir, "o4-comparison.json"),
    `${JSON.stringify({ summary, figures }, null, 2)}\n`,
  );
  writeFileSync(
    join(dir, "o4-comparison.md"),
    [
      "# O4: our plans against Vaughan's marks",
      "",
      `At a noose tolerance of ${summary.tolerance} unit(s), ${agree} of ${figures.length} figures agree.`,
      "",
      ...figures
        .filter((f) => !f.agrees)
        .map((f) => `- #${f.n} ${f.spelling}: ${f.differences.join("; ")}`),
      "",
    ].join("\n"),
  );
  // After O4's own files, so a figure the sheet cannot draw costs only
  // the sheet.
  sideBySide(dir, annotation.figures, figures);
  return summary;
}

/** Whether `inner` is `outer` or lies inside it. */
function within(inner: string, outer: string): boolean {
  const path = relative(resolve(outer), resolve(inner));
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

/**
 * Throws unless the external directory lies outside the repository and
 * apart from `out`: it receives crops of a book in copyright, which must
 * never be one `git add` away from a commit (AGENTS.md, Outside sources).
 */
export function checkExternalDirectory(external: string, out: string): void {
  if (within(external, REPO))
    throw new Error(
      `SIGIL_ORACLE_EXTERNAL must lie outside the repository: ${external}`,
    );
  if (within(external, out) || within(out, external))
    throw new Error(
      `SIGIL_ORACLE_EXTERNAL and --out must not overlap: ${external}, ${out}`,
    );
}

/**
 * S3's side-by-side sheet, `side-by-side.html` in `dir`: each of
 * Vaughan's figures, cropped from the PDF in `dir` by `pdftoppm` into
 * `dir/side-by-side/`, beside our figure of his spelling on the
 * Golden Dawn's rose, with O4's differences and the annotators' notes.
 * His spellings that differ from the site's are marked. Everything is
 * written into `dir`; without a PDF or `pdftoppm` the page has ours alone.
 */
function sideBySide(
  dir: string,
  his: readonly ExternalFigure[],
  compared: readonly { n: number; agrees: boolean; differences: string[] }[],
) {
  const pdfs = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf"));
  // One book: with two, which one was cropped would be a guess.
  if (pdfs.length > 1)
    throw new Error(`More than one PDF in ${dir}: ${pdfs.join(", ")}`);
  const pdf = pdfs[0];
  const images = join(dir, "side-by-side");
  mkdirSync(images, { recursive: true });
  const site = new Map(SEVENTY_TWO_NAMES.map((c) => [c.number, c.text]));
  const crop = (page: number): string | undefined => {
    // A page goes into a file name and to pdftoppm: a whole number only.
    if (!Number.isInteger(page) || page < 1)
      throw new Error(`Not a page number: ${JSON.stringify(page)}`);
    if (!pdf) return undefined;
    const name = `vaughan-${String(page).padStart(2, "0")}`;
    try {
      // 100 dpi; the box holds the figure with its title on every page.
      execFileSync("pdftoppm", [
        ...["-png", "-r", "100", "-singlefile"],
        ...["-x", "40", "-y", "150", "-W", "720", "-H", "750"],
        ...["-f", String(page), "-l", String(page)],
        join(dir, pdf),
        join(images, name),
      ]);
      return `side-by-side/${name}.png`;
    } catch {
      return undefined;
    }
  };
  const rows = his.map((figure) => {
    const verdict = compared.find((c) => c.n === figure.n);
    const siteSpelling = site.get(figure.n);
    const image = crop(figure.page);
    const ours = roseFigure(figure.spelling, "gd").replace(
      /^<svg /,
      '<svg width="360" height="360" ',
    );
    const notes = [
      siteSpelling && siteSpelling !== figure.spelling
        ? `<p class="spelling">His spelling; the site's is <span lang="he">${escape(siteSpelling)}</span>.</p>`
        : "",
      verdict?.agrees
        ? '<p class="agree">Marks agree (O4).</p>'
        : `<ul class="differ">${(verdict?.differences ?? []).map((d) => `<li>${escape(d)}</li>`).join("")}</ul>`,
      figure.notes ? `<p class="notes">${escape(figure.notes)}</p>` : "",
    ].join("");
    return `<section id="n${figure.n}" class="${verdict?.agrees ? "" : "disagree"}">
<h2>#${figure.n} <span lang="he">${escape(figure.spelling)}</span></h2>
<div class="pair">
<figure>${image ? `<img src="${image}" width="360" alt="Vaughan #${figure.n}">` : "<p>No crop: no PDF or pdftoppm.</p>"}<figcaption>Vaughan, page ${figure.page}</figcaption></figure>
<figure>${ours}<figcaption>Ours (gd rose, his spelling)</figcaption></figure>
<div class="verdict">${notes}</div>
</div>
</section>`;
  });
  const disagreeing = compared.filter((c) => !c.agrees);
  writeFileSync(
    join(dir, "side-by-side.html"),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Rose sigils: Vaughan beside ours</title>
<style>
body { font: 15px/1.4 system-ui, sans-serif; margin: 16px; background: #fff; color: #111; }
[lang="he"] { font-family: "Frank Ruhl Libre", serif; font-size: 1.2em; }
section { border-top: 1px solid #ccc; padding: 8px 0; }
section.disagree { background: #fff6f0; }
.pair { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
figure { margin: 0; }
figcaption { font-size: 13px; color: #555; text-align: center; }
.verdict { max-width: 360px; }
.agree { color: #060; }
.differ { color: #a00; padding-left: 18px; }
.notes { color: #555; font-size: 13px; }
</style></head><body>
<h1>Rose sigils: Vaughan beside ours</h1>
<p>Noose tolerance ${ROSE_SIGIL_PROFILE.nooseTolerance} unit(s). ${compared.length - disagreeing.length} of ${compared.length} figures agree on their marks. Local only: never commit this page or its images.${pdf ? ` Crops from ${escape(pdf)}.` : ""}</p>
<p>Disagreeing: ${disagreeing.map((c) => `<a href="#n${c.n}">#${c.n}</a>`).join(", ") || "none"}.</p>
${rows.join("\n")}
</body></html>
`,
  );
}

// ---------------------------------------------------------------- the report

export interface SigilOracleReportOptions {
  /** Where the report and sheets go. */
  out: string;
  /** A handful of cases of each kind, for the smoke test. */
  tiny?: boolean;
  /** `SIGIL_ORACLE_EXTERNAL`: the directory O4 reads and writes. */
  external?: string;
  log?: (line: string) => void;
}

/** Runs the oracle over the corpus and writes the report; returns its summary. */
export async function sigilOracleReport(options: SigilOracleReportOptions) {
  const { out, tiny = false, external, log = () => {} } = options;
  if (external) checkExternalDirectory(external, out);
  mkdirSync(out, { recursive: true });
  const cases = corpus(tiny);
  const started = performance.now();
  const verdicts: Verdict[] = [];
  for (const c of cases)
    verdicts.push(
      await judge(
        c,
        c.corpus === "names" || c.corpus === "fixtures" || c.corpus === "kamea",
      ),
    );
  log(
    `judged ${verdicts.length} figures in ${((performance.now() - started) / 1000).toFixed(1)} s`,
  );

  const beyond: Verdict[] = [];
  const beyondStarted = performance.now();
  for (const c of beyondCorpus(tiny)) beyond.push(await judge(c, false));
  log(
    `judged ${beyond.length} figures beyond the tested domain in ${((performance.now() - beyondStarted) / 1000).toFixed(1)} s`,
  );

  const { rules, oracle, byCorpus } = tallies(verdicts);
  // Failures against the engine suite's known-failures list.
  const line = (v: Verdict) => ({
    corpus: v.case.corpus,
    id: v.case.id,
    version: v.case.version,
    text: v.case.text,
    failing: failures(v),
  });
  const failed = verdicts.filter((v) => failures(v).length > 0);
  const expected = failed
    .filter((v) => knownFailure(v.case) !== undefined)
    .map((v) => ({
      ...line(v),
      known: knownFailure(v.case),
      checks: checksFailed(v),
    }));
  const regressions = failed
    .filter((v) => knownFailure(v.case) === undefined)
    .map(line);
  const fixed = verdicts
    .filter((v) => failures(v).length === 0 && knownFailure(v.case))
    .map((v) => ({ ...line(v), known: knownFailure(v.case) }));
  const known = {
    expected: expected.length,
    regressions: regressions.length,
    fixed: fixed.length,
    /** Known failures whose checks today differ from the list's. */
    changed: expected.filter((e) => e.known !== e.checks).length,
  };
  const beyondByLength: Record<string, Tally> = {};
  for (const v of beyond) {
    const length = [...v.case.text].length;
    const band = `${length - ((length - 13) % 5)}–${Math.min(32, length - ((length - 13) % 5) + 4)} letters`;
    beyondByLength[band] ??= { applies: 0, passes: 0 };
    beyondByLength[band].applies++;
    if (failures(v).length === 0) beyondByLength[band].passes++;
  }
  const beyondSummary = {
    cases: beyond.length,
    passes: beyond.filter((v) => failures(v).length === 0).length,
    byLength: beyondByLength,
  };
  const names = verdicts
    .filter((v) => v.case.corpus === "names")
    .map((v) => ({
      id: v.case.id,
      version: v.case.version,
      text: v.case.text,
      failing: failures(v),
    }));
  const failing = verdicts
    .filter((v) => failures(v).length > 0)
    .map((v) => ({
      corpus: v.case.corpus,
      id: v.case.id,
      version: v.case.version,
      text: v.case.text,
      failing: failures(v),
    }));

  // Sheets.
  const sheets: Record<string, { svg: string; png: string }> = {};
  const write = async (name: string, svg: string) => {
    writeFileSync(join(out, `${name}.svg`), svg);
    writeFileSync(join(out, `${name}.png`), await png(svg));
    sheets[name] = {
      svg: join(out, `${name}.svg`),
      png: join(out, `${name}.png`),
    };
  };
  const gdNames = verdicts.filter(
    (v) => v.case.corpus === "names" && v.case.version === "gd",
  );
  await write(
    "names",
    sheet(
      "The 72 names on the Golden Dawn's rose, placed by rule (red frame: a check fails)",
      gdNames.map((v) => ({
        svg: roseFigure(v.case.text, "gd"),
        labels: [`${v.case.id.replace("72-", "#")} ${v.case.text}`],
        failing: failures(v).length > 0,
      })),
    ),
  );
  const triples = verdicts
    .filter((v) => v.case.corpus === "triples")
    .map((v) => ({ v, moved: moved(v) }))
    .sort(
      (a, b) => b.moved - a.moved || a.v.case.text.localeCompare(b.v.case.text),
    )
    .slice(0, tiny ? 4 : 48);
  await write(
    "hardest-triples",
    sheet(
      "The triples placement moved most (total distance of the vertices from their anchors, units)",
      triples.map(({ v, moved: m }) => ({
        svg: roseFigure(v.case.text, v.case.version),
        labels: [`${v.case.text} (${v.case.version})`, `moved ${m.toFixed(2)}`],
        failing: failures(v).length > 0,
      })),
    ),
  );
  // R4: the names, the templates and the triples; Regardie's rose only
  // where it differs from the default, through Kaph or Tau.
  const r4Cases = cases.filter(
    (c) =>
      (c.corpus === "names" ||
        c.corpus === "templates" ||
        c.corpus === "triples") &&
      (c.version === "gd" || c.corpus === "templates" || /[כת]/.test(c.text)),
  );
  const near = nearChordVertices(r4Cases);
  await write(
    "r4",
    sheet(
      `R4: vertices 0.5–3 units off their neighbours' chord, as placed at a noose tolerance of ${ROSE_SIGIL_PROFILE.nooseTolerance} (24 units about the anchor; dashed: the chord)`,
      near.map((n) => {
        const word = sigilWords(n.case.text)[n.word];
        return {
          svg: vertexWindow(
            n.case.text,
            n.case.version,
            n.word,
            n.anchors[1],
            n.anchors[0],
            n.anchors[2],
          ),
          labels: [
            `${n.case.text} (${n.case.version})`,
            `${n.case.corpus === "templates" ? `${n.case.id}, ` : ""}vertex ${n.vertex + 1} of ${word?.length ?? "?"}`,
            `${n.distance.toFixed(3)} units${n.noose ? ", noose" : ""}`,
          ],
        };
      }),
    ),
  );

  const o4 = external ? runO4(external) : undefined;
  const summary = {
    cases: verdicts.length,
    rules,
    oracle,
    byCorpus,
    known,
    beyond: beyondSummary,
    r4Vertices: near.length,
    o4,
  };
  writeFileSync(
    join(out, "report.json"),
    `${JSON.stringify(
      {
        summary,
        names,
        failing,
        regressions,
        expected,
        fixed,
        beyond: beyond.filter((v) => failures(v).length > 0).map(line),
        sheets,
      },
      null,
      2,
    )}\n`,
  );
  const table = (rows: Record<string, Tally & { title?: string }>) => [
    "| | Applies | Passes |",
    "| --- | --- | --- |",
    ...Object.entries(rows).map(
      ([id, t]) =>
        `| ${id}${t.title ? ` ${t.title}` : ""} | ${t.applies} | ${t.passes} |`,
    ),
  ];
  writeFileSync(
    join(out, "report.md"),
    [
      "# Sigil oracle report (plan 088)",
      "",
      `${verdicts.length} figures${tiny ? " (the tiny corpus)" : ""}, the engine against O1–O3; the 1-ulp check on the names, fixtures and kamea stubs, nudged before rounding.`,
      "",
      `${oracle.All.passes} pass. ${known.expected} fail as known (expected: \`engineKnownFailures.ts\`${known.changed ? `, ${known.changed} with other checks than listed` : ""}); ${known.regressions} regression${known.regressions === 1 ? "" : "s"}; ${known.fixed} known failure${known.fixed === 1 ? "" : "s"} now pass${known.fixed === 1 ? "es" : ""}.`,
      "",
      `Beyond the tested domain (13–32 letters, not in CI): ${beyondSummary.passes} of ${beyondSummary.cases} pass.`,
      "",
      "## By rule",
      "",
      ...table(rules),
      "",
      "## By check",
      "",
      ...table(oracle),
      "",
      "## By corpus",
      "",
      ...table(byCorpus),
      "",
      "## The 72 names",
      "",
      ...names.map(
        (n) =>
          `- ${n.id} ${n.text} (${n.version}): ${n.failing.length ? n.failing.join("; ") : "passes"}`,
      ),
      "",
      "## Regressions",
      "",
      "Failing, and not in the known-failures list.",
      "",
      ...(regressions.length
        ? regressions.map(
            (f) =>
              `- ${f.corpus} ${f.text} (${f.version}): ${f.failing.join("; ")}`,
          )
        : ["None."]),
      "",
      "## Known failures (expected)",
      "",
      ...(expected.length
        ? expected.map(
            (f) =>
              `- ${f.corpus} ${f.text} (${f.version}): ${f.checks}${f.checks === f.known ? "" : ` (listed: ${f.known})`}`,
          )
        : ["None."]),
      "",
      "## Known failures that now pass",
      "",
      "Take them off the list.",
      "",
      ...(fixed.length
        ? fixed.map(
            (f) => `- ${f.corpus} ${f.text} (${f.version}): listed ${f.known}`,
          )
        : ["None."]),
      "",
      "## Beyond the tested domain",
      "",
      "Seeded random words of 13 to 32 letters (`BEYOND_DOMAIN_CORPUS`), drawn best effort; CI tests words up to 12. Not regressions.",
      "",
      ...table(beyondSummary.byLength),
      "",
      ...beyond
        .filter((v) => failures(v).length > 0)
        .map((v) => `- ${v.case.text} (${v.case.version}): ${checksFailed(v)}`),
      "",
      "## Sheets",
      "",
      ...Object.entries(sheets).map(
        ([name, files]) => `- ${name}: ${files.svg}, ${files.png}`,
      ),
      `- r4 holds ${near.length} vertices.`,
      ...(o4
        ? [
            "",
            `O4 (written to SIGIL_ORACLE_EXTERNAL only): ${o4.agree} of ${o4.figures} figures agree.`,
          ]
        : []),
      "",
    ].join("\n"),
  );
  return summary;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values } = parseArgs({
    options: { out: { type: "string" }, tiny: { type: "boolean" } },
  });
  const out = resolve(values.out ?? join(REPO, "output/sigil-oracle"));
  const external = process.env.SIGIL_ORACLE_EXTERNAL || undefined;
  const summary = await sigilOracleReport({
    out,
    tiny: values.tiny,
    external: external && resolve(external),
    log: (line) => console.log(line),
  });
  console.log(JSON.stringify(summary, null, 2));
  console.log(`report: ${join(out, "report.md")}`);
}
