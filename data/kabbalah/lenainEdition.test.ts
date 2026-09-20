import { readFileSync } from "node:fs";
import JSON5 from "json5";
import { describe, expect, it } from "vitest";
import {
  bookLeaves,
  divisionOfLeaf,
  divisions,
  LAST_LEAF,
  leavesOf,
} from "./lenain/volume";

/**
 * The edition as a document: the checks `pnpm data:check` cannot make.
 *
 * `integrity.ts` checks a graph of id-keyed tables — every link resolving,
 * every mirror symmetric — and the book is not one of those. It is 168 leaves
 * of prose with an apparatus hanging off them, and `data:check` reports
 * "nothing wrong in 26 tables" while never opening the largest file in
 * `data/`. What matters here is different: that a permalink names one place,
 * that the numbering runs the way the volume runs, and that no editorial note
 * points at a leaf or a genius that does not exist.
 *
 * Anchors are the load-bearing part. They were not safe until plan 033: the
 * page number flattened three sequences, so 4, 6 and 7 each named two leaves.
 * A test is the only thing that keeps them distinct once URLs are public.
 */

const read = (path: string) =>
  JSON5.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

type Sequence = "reissue" | "author" | "body" | "unnumbered";

interface Leaf {
  pdfPage: number;
  page: {
    number: number;
    style: string;
    sequence: Sequence;
    label: string;
    anchor: string;
  };
  blocks: { kind: string; text: string; rows: string[][]; marker: string }[];
  uncertain: string[];
}

interface Note {
  no: number;
  kind: string;
  field: string;
  page?: string;
  printed: string;
  used: string;
  why: string;
}

const leaves: Leaf[] = read("./lenain/pages.json5");
const notes: Note[] = read("./lenain/apparatus.json5");
const evidence: { no: number }[] = read("./lenain/evidence.json5");

const KINDS = new Set([
  "heading",
  "paragraph",
  "footnote",
  "table",
  "furniture",
]);
const SEQUENCES = new Set(["reissue", "author", "body", "unnumbered"]);
const KIND_OF_NOTE = new Set(["correction", "reading", "reconstruction"]);

describe("the volume", () => {
  it("gives every leaf one anchor, and no anchor two leaves", () => {
    const seen = new Map<string, number[]>();
    for (const leaf of leaves) {
      expect(leaf.page.anchor, `pdf ${leaf.pdfPage}`).toMatch(/^[\w-]+$/);
      seen.set(leaf.page.anchor, [
        ...(seen.get(leaf.page.anchor) ?? []),
        leaf.pdfPage,
      ]);
    }
    const collisions = [...seen]
      .filter(([, pdfPages]) => pdfPages.length > 1)
      .map(([anchor, pdfPages]) => `${anchor} on pdf ${pdfPages.join(", ")}`);
    expect(collisions).toEqual([]);
    expect(seen.size).toBe(leaves.length);
  });

  it("keeps each anchor tied to the leaf it names", () => {
    // Injecting a renumbered leaf passed every other check here: the anchor
    // is what a permalink resolves, so an anchor free to drift from its own
    // number is the one fault this file exists to catch.
    const wrong = leaves
      .map((leaf) => {
        const { number, style, sequence, label, anchor } = leaf.page;
        if (sequence === "unnumbered")
          return number === 0 &&
            style === "none" &&
            anchor === `leaf-${leaf.pdfPage}`
            ? null
            : `pdf ${leaf.pdfPage}: unnumbered leaf reads ${anchor}/${number}/${style}`;
        const expected = sequence === "body" ? `p${label}` : `p-${label}`;
        if (anchor !== expected)
          return `pdf ${leaf.pdfPage}: anchor ${anchor} but label ${label}`;
        if (sequence === "body" && String(number) !== label)
          return `pdf ${leaf.pdfPage}: number ${number} but label ${label}`;
        const styles = {
          body: "arabic",
          reissue: "roman-upper",
          author: "roman-lower",
        } as const;
        if (style !== styles[sequence])
          return `pdf ${leaf.pdfPage}: ${sequence} leaf set ${style}`;
        return null;
      })
      .filter(Boolean);
    expect(wrong).toEqual([]);
  });

  it("numbers each sequence in its own order", () => {
    for (const sequence of ["reissue", "author", "body"] as const) {
      const numbers = leaves
        .filter((leaf) => leaf.page.sequence === sequence)
        .map((leaf) => leaf.page.number);
      expect(numbers, sequence).toEqual([...numbers].sort((a, b) => a - b));
      expect(new Set(numbers).size, `${sequence} repeats a number`).toBe(
        numbers.length,
      );
    }
  });

  it("is missing only the fold-out leaf, and says so", () => {
    const body = leaves
      .filter((leaf) => leaf.page.sequence === "body")
      .map((leaf) => leaf.page.number);
    const gaps: number[] = [];
    for (let n = Math.min(...body); n <= Math.max(...body); n++)
      if (!body.includes(n)) gaps.push(n);
    expect(gaps).toEqual([26]);
    // The reconstruction note is what explains the gap; without it the
    // missing leaf looks like a transcription failure.
    const reconstruction = notes.find((note) => note.kind === "reconstruction");
    expect(reconstruction?.why).toMatch(/fold-out/);
  });

  it("uses only block kinds the renderers know", () => {
    const unknown = new Set<string>();
    for (const leaf of leaves)
      for (const block of leaf.blocks)
        if (!KINDS.has(block.kind)) unknown.add(block.kind);
    expect([...unknown]).toEqual([]);
    for (const leaf of leaves)
      expect(SEQUENCES.has(leaf.page.sequence)).toBe(true);
  });

  it("carries every one of the seventy-two entries", () => {
    expect(evidence.map((row) => row.no)).toEqual(
      Array.from({ length: 72 }, (_, i) => i + 1),
    );
  });
});

describe("the divisions", () => {
  it("covers every leaf of the book proper exactly once", () => {
    const covered = divisions.flatMap((division) =>
      leavesOf(division).map((leaf) => leaf.pdfPage),
    );
    expect(covered).toEqual([...new Set(covered)].sort((a, b) => a - b));
    expect(covered).toEqual(bookLeaves().map((leaf) => leaf.pdfPage));
    for (const leaf of bookLeaves())
      expect(
        divisionOfLeaf(leaf.pdfPage)?.slug,
        `pdf ${leaf.pdfPage}`,
      ).toBeDefined();
  });

  it("leaves the reissue's advertisements out", () => {
    // pdf 170 onwards are blanks and the 1909 publisher's adverts for
    // Paracelsus and Lancelin, which are not Lenain's book.
    expect(leaves.some((leaf) => leaf.pdfPage > LAST_LEAF)).toBe(true);
    expect(bookLeaves().every((leaf) => leaf.pdfPage <= LAST_LEAF)).toBe(true);
  });

  it("names each division from Lenain, and gives a distinct slug", () => {
    const slugs = divisions.map((division) => division.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
    for (const division of divisions.filter((d) => d.slug !== "preliminaires"))
      expect(division.heading, division.slug).toMatch(/^CHAPITRE/);
    // Titles become route titles, so they have to fit what the SEO tests
    // require of every other page.
    for (const division of divisions)
      expect(division.title.length, division.title).toBeLessThanOrEqual(48);
  });
});

describe("the apparatus", () => {
  it("points every note at something that exists", () => {
    const anchors = new Set(leaves.map((leaf) => leaf.page.anchor));
    const dangling = notes
      .filter((note) => note.page !== undefined && !anchors.has(note.page))
      .map((note) => `${note.field} → ${note.page}`);
    expect(dangling).toEqual([]);

    const outOfRange = notes
      .filter((note) => note.no !== 0 && (note.no < 1 || note.no > 72))
      .map((note) => `${note.field} → genius ${note.no}`);
    expect(outOfRange).toEqual([]);
  });

  it("says what kind each note is, and why", () => {
    for (const note of notes) {
      expect(KIND_OF_NOTE.has(note.kind), `${note.field}: ${note.kind}`).toBe(
        true,
      );
      // A note whose reason is a sentence fragment is not a note.
      expect(note.why.length, note.field).toBeGreaterThan(40);
      expect(note.field, JSON.stringify(note)).not.toMatch(/^p\.\s*\d/);
    }
  });

  it("reaches a reader", () => {
    // Every note is rendered somewhere: against its leaf, or, where it
    // concerns none, in the edition's own notes. Three used to reach neither.
    const homeless = notes.filter((note) => !note.page && note.no === 0);
    const rendered = readFileSync(
      new URL(
        "../../public/docs/Lenain - La Science Cabalistique (1823).md",
        import.meta.url,
      ),
      "utf8",
    );
    expect(rendered).toContain("About this edition");
    for (const note of homeless)
      expect(rendered, note.field).toContain(note.field);
    for (const note of notes.filter((n) => n.page))
      expect(rendered, note.page).toContain(`id="${note.page}"`);
  });
});
