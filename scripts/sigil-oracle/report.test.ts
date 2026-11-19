import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { sigilOracleReport } from "./report.mts";

/**
 * A smoke test of `pnpm sigils:oracle` on its tiny corpus: it runs, and
 * writes the report, the sheets and, given an external directory, O4's
 * comparison there alone. The numbers are the oracle's; the engine's
 * suites hold them.
 */
describe("the sigil oracle report", () => {
  const root = mkdtempSync(join(tmpdir(), "sigil-oracle-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("judges the tiny corpus and writes the report and sheets", async () => {
    const out = join(root, "out");
    const external = join(root, "external");
    // A made-up annotation of two figures: Metatron as we plan it, and a
    // name whose second letter the annotator saw a bead on.
    const letter = (marks: Record<string, unknown>) => ({
      letter: "?",
      circle: false,
      bar: false,
      beads: 0,
      lobesToNext: 0,
      besideEarlierVisit: null,
      ...marks,
    });
    mkdirSync(external);
    writeFileSync(
      join(external, "annotation-reconciled.json"),
      JSON.stringify({
        figures: [
          {
            n: 1,
            page: 2,
            spelling: "מטטרון",
            letters: [
              letter({ circle: true }),
              letter({ lobesToNext: 2 }),
              letter({}),
              letter({ beads: 1 }),
              letter({}),
              letter({ bar: true }),
            ],
          },
          {
            n: 2,
            page: 3,
            spelling: "גדי",
            letters: [
              letter({ circle: true }),
              letter({ beads: 1 }),
              letter({ bar: true }),
            ],
          },
        ],
      }),
    );
    const summary = await sigilOracleReport({ out, tiny: true, external });
    expect(summary.cases).toBeGreaterThan(20);
    // Every failure is a known one; nothing listed passes unnoticed.
    expect(summary.known.regressions).toBe(0);
    expect(summary.oracle.All).toEqual({
      applies: summary.cases,
      passes: summary.cases - summary.known.expected,
    });
    expect(summary.byCorpus.kamea).toEqual({ applies: 1, passes: 1 });
    expect(summary.byCorpus["ababa (gd)"].applies).toBe(3);
    expect(summary.beyond.cases).toBe(4);
    expect(summary.rules.R1.applies).toBe(summary.cases);
    for (const name of ["names", "hardest-triples", "r4"])
      for (const ext of ["svg", "png"])
        expect(existsSync(join(out, `${name}.${ext}`)), `${name}.${ext}`).toBe(
          true,
        );
    expect(readFileSync(join(out, "names.png")).subarray(1, 4).toString()).toBe(
      "PNG",
    );
    const markdown = readFileSync(join(out, "report.md"), "utf8");
    expect(markdown).toContain("## By rule");
    expect(markdown).toContain("## Regressions");
    expect(markdown).toContain("## Beyond the tested domain");

    expect(summary.o4).toEqual({ tolerance: 1, figures: 2, agree: 1 });
    const o4 = JSON.parse(
      readFileSync(join(external, "o4-comparison.json"), "utf8"),
    );
    expect(o4.figures[1].differences).toEqual([
      "letter 2 (?) beads: ours 0, his 1",
    ]);
    // S3's sheet: ours beside his, the disagreeing figure listed; with
    // no PDF in the directory there are no crops of his.
    const sheet = readFileSync(join(external, "side-by-side.html"), "utf8");
    expect(sheet).toContain('Disagreeing: <a href="#n2">#2</a>.');
    expect(sheet).toContain("<figcaption>Vaughan, page 3</figcaption>");
    expect(sheet.match(/<svg /g)).toHaveLength(2);
    expect(sheet).toContain("No crop: no PDF or pdftoppm.");
    // O4 writes into the external directory alone.
    expect(existsSync(join(out, "o4-comparison.json"))).toBe(false);
    expect(existsSync(join(out, "side-by-side.html"))).toBe(false);
  }, 60_000);
});
