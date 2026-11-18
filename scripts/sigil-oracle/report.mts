/**
 * `pnpm sigils:oracle`: plan 088's accuracy report ("Measuring
 * accuracy"). It runs the oracle over the corpus against the engine and
 * writes, to `--out <dir>` (default `output/sigil-oracle/`, git-ignored):
 *
 * - `report.json` and `report.md`: per rule, how many cases it applies to
 *   and how many pass; per oracle check (O1 plans, O2 invariants, O3
 *   read-back, the 1-ulp check), the same; per name of the 72, which
 *   checks fail; and every failing case;
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

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RoseSigilImage from "../../packages/magick-components/src/gd/RoseSigilImage.tsx";
import type { RoseVersionId } from "../../packages/magick-components/src/gd/roseSigilInternals.ts";
import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "../../packages/magick-components/src/gd/roseSigilLayout.ts";
import {
  roseTexts,
  SEVENTY_TWO_NAMES,
} from "../../packages/magick-components/src/sigil/oracle/corpus.ts";
import { HAND_FIXTURES } from "../../packages/magick-components/src/sigil/oracle/fixtures.ts";
import {
  checkInvariants,
  checkStability,
  type InvariantCheck,
  type InvariantFailure,
} from "../../packages/magick-components/src/sigil/oracle/invariants.ts";
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

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const VERSIONS: readonly RoseVersionId[] = ["gd", "regardie1939"];

/** Which corpus a case comes from. */
type Corpus = "fixtures" | "templates" | "names" | "pairs" | "triples";

/** One text to judge, with the plan it must have. */
interface Case {
  corpus: Corpus;
  id: string;
  text: string;
  version: RoseVersionId;
  expected: SigilPlan;
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
    title: "a crook per repeated letter",
    checks: ["crook"],
    applies: (plan) => plan.some((w) => w.some((v) => v.crooks > 0)),
  },
  {
    id: "R4",
    title: "a noose on a straight pass",
    checks: ["noose"],
    applies: (plan) =>
      plan.some((w) => w.some((v) => v.marks.includes("noose"))),
  },
  {
    id: "R5",
    title: "a bar at the last letter",
    checks: ["bar"],
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
  for (const version of VERSIONS) {
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

async function judge(c: Case, stability: boolean): Promise<Verdict> {
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
  if (stability)
    verdict.stable = (await checkStability(draw, c.text, layout)).stable;
  return verdict;
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
    const key = `${v.case.corpus} (${v.case.version})`;
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
            `<text x="${x + size / 2}" y="${y + size + (k + 1) * labelHeight}" text-anchor="middle" font-size="13">${escape(label)}</text>`,
        )
        .join("");
      return drawing + frame + labels;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<rect width="100%" height="100%" fill="#fff"/>
<text x="12" y="26" font-size="18">${escape(title)}</text>
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
  spelling: string;
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
  return summary;
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
  mkdirSync(out, { recursive: true });
  const cases = corpus(tiny);
  const started = performance.now();
  const verdicts: Verdict[] = [];
  for (const c of cases)
    verdicts.push(
      await judge(c, c.corpus === "names" || c.corpus === "fixtures"),
    );
  log(
    `judged ${verdicts.length} figures in ${((performance.now() - started) / 1000).toFixed(1)} s`,
  );

  const { rules, oracle, byCorpus } = tallies(verdicts);
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
    r4Vertices: near.length,
    o4,
  };
  writeFileSync(
    join(out, "report.json"),
    `${JSON.stringify({ summary, names, failing, sheets }, null, 2)}\n`,
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
      `${verdicts.length} figures${tiny ? " (the tiny corpus)" : ""}, the engine against O1–O3; the 1-ulp check on the names and fixtures.`,
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
      "## Failing figures",
      "",
      ...(failing.length
        ? failing.map(
            (f) =>
              `- ${f.corpus} ${f.text} (${f.version}): ${f.failing.join("; ")}`,
          )
        : ["None."]),
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
