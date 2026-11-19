import { readFileSync } from "node:fs";
import JSON5 from "json5";
import { describe, expect, it } from "vitest";
import {
  firstTable,
  firstTableAgreement,
  firstTableCounts,
  kircherDepartures,
  kircherNations,
  kircherRays,
  kircherRemarks,
  kircherSentence,
  plateCells,
  plateDifferences,
  sameGodName,
  sourceCell,
  transliterated,
} from "./lenain/firstTable.ts";
import { piecesOf, segmentsOf } from "./lenain/pieces.ts";
import {
  bookLeaves,
  divisionOfLeaf,
  divisions,
  LAST_LEAF,
  leavesOf,
  leaves as volumeLeaves,
} from "./lenain/volume.ts";

/**
 * The edition as a document: the checks `pnpm data:check` cannot make.
 *
 * `integrity.ts` checks a graph of id-keyed tables — every link resolving,
 * every mirror symmetric — and the book is not one of those. It is 168 leaves
 * of prose with an apparatus hanging off them, and `data:check` reports
 * "nothing wrong in 26 tables" while never opening the largest file in
 * the package. What matters here is different: that a permalink names one place,
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
  witnesses?: {
    source: string;
    label: string;
    url: string;
    reads: string;
    mirror?: string;
  }[];
}

interface Witnessed {
  no: number;
  field: string;
  verdict: string;
  print1823: { at: number; reads: string };
  ms5365?: { at: number; reads: string };
}

const leaves: Leaf[] = read("./lenain/pages.json5");
const notes: Note[] = read("./lenain/apparatus.json5");
const evidence: { no: number }[] = read("./lenain/evidence.json5");
const witnessed: { readings: Witnessed[] } = read("./lenain/witnesses.json5");

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

describe("folding the leaves into pieces", () => {
  it("loses no letter of the book", () => {
    // The fold rejoins paragraphs across leaves, mends words a leaf broke in
    // half, and carries a paragraph past a footnote set below the rule — so it
    // changes where text sits, and in what order, but never how much of it
    // there is. Compared within each kind, because carrying a paragraph past a
    // note is precisely a reordering between kinds: prose that was printed
    // after the note now reads before it, joined to the sentence it belongs
    // to. Eleven words were left holding a hyphen before that.
    const letters = (text: string) => text.replace(/[\s-]+/g, "");
    const pieces = piecesOf(volumeLeaves);
    for (const kind of ["paragraph", "footnote", "heading"] as const) {
      const fromBlocks = volumeLeaves
        .flatMap((leaf) => leaf.blocks.filter((b) => b.kind === kind))
        .map((b) => b.text)
        .join(" ");
      const fromPieces = pieces
        .filter((piece) => piece.kind === kind)
        .map((piece) => piece.text)
        .join(" ");
      expect(letters(fromPieces), kind).toBe(letters(fromBlocks));
    }
  });

  it("leaves no word holding a hyphen", () => {
    // A leaf, or a footnote rule, can break a word in half. Either way the
    // word is made whole; a paragraph that still ends in a hyphen is one whose
    // other half was dropped.
    const stranded = piecesOf(volumeLeaves)
      .filter((piece) => piece.kind === "paragraph" && /-\s*$/.test(piece.text))
      .map((piece) => piece.text.slice(-40));
    expect(stranded).toEqual([]);
  });

  it("cuts every piece into segments that rejoin to it", () => {
    // A paragraph carrying on from the leaf before has no break at offset 0,
    // and slicing from its first break silently dropped the opening words of
    // 52 pieces. Rejoining is the invariant that caught it.
    const broken = piecesOf(volumeLeaves)
      .filter(
        (piece) =>
          segmentsOf(piece)
            .map((segment) => segment.text)
            .join("") !== piece.text,
      )
      .map((piece) => `${piece.kind} at ${piece.breaks[0]?.anchor}`);
    expect(broken).toEqual([]);
  });

  it("marks every leaf exactly once", () => {
    const marked = piecesOf(volumeLeaves).flatMap((piece) =>
      piece.breaks.map((pageBreak) => pageBreak.anchor),
    );
    expect(marked.length).toBe(volumeLeaves.length);
    expect(new Set(marked).size).toBe(volumeLeaves.length);
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
});

describe("the other witnesses", () => {
  it("joins every reading to a note, and links its pages", () => {
    // apparatus.ts stops on a reading that matches no note; this holds the
    // committed apparatus to the same, so a hand edit cannot drop one either.
    for (const reading of witnessed.readings) {
      const where = `${reading.no} ${reading.field}`;
      const at = notes.filter(
        (note) => note.no === reading.no && note.field === reading.field,
      );
      expect(at.length, where).toBeGreaterThan(0);
      for (const note of at) {
        const [printing, copy] = note.witnesses ?? [];
        expect(printing?.url, where).toBe(
          `https://books.google.com/books?id=qt9SAAAAcAAJ&pg=PA${reading.print1823.at}`,
        );
        expect(printing?.reads, where).toBe(reading.print1823.reads);
        if (reading.ms5365)
          expect(copy?.label, where).toBe(
            `Ms 5365, leaf n${reading.ms5365.at}`,
          );
      }
    }
  });

  it("says nothing is printed where neither printing gives an hour", () => {
    const absent = witnessed.readings.filter((r) => r.verdict === "absent");
    expect(absent.map((r) => r.no)).toEqual([8, 38, 44]);
    for (const reading of absent) {
      const note = notes.find(
        (n) => n.no === reading.no && n.field === "invocation",
      );
      expect(note?.printed, `genius ${reading.no}`).toBe("");
      expect(note?.used, `genius ${reading.no}`).not.toBe("");
    }
  });

  it("gives the three misprinted Hebrew names as 1823 prints them", () => {
    for (const [no, printed, used] of [
      [37, "אנואל", "אניאל"],
      [68, "הבויה", "חבויה"],
      [69, "ראחאל", "ראהאל"],
    ] as const) {
      const note = notes.find((n) => n.no === no && n.field === "name.he");
      expect(note?.printed.replace(/\p{Mark}/gu, ""), `genius ${no}`).toBe(
        printed,
      );
      expect(note?.used, `genius ${no}`).toBe(used);
      expect(note?.witnesses?.[0]?.reads, `genius ${no}`).toBe(used);
    }
  });
});

describe("the first table", () => {
  it("takes 57 to 61 from the 1823 plate, and 62 to 72 from the reissue's", () => {
    const rows = firstTable();
    const from = (source: string) =>
      rows.filter((row) => row.source === source).map((row) => row.no);
    expect(from("plate1823")).toEqual([57, 58, 59, 60, 61]);
    expect(from("plate1909")).toEqual([
      62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72,
    ]);
    expect(rows.filter((row) => row.partly).map((row) => row.no)).toEqual([57]);
    expect(firstTableCounts()).toEqual({
      plate1909: 11,
      plate1823: 5,
      reconstructed: 56,
    });
  });

  it("counts how often the entries recover each plate", () => {
    // The page used to say "ten and eight" in words, which no change to the
    // data could correct. These are counted, and pinned here so that a change
    // to a plate or an entry is noticed.
    expect(firstTableAgreement()).toEqual({
      plate1909: { rows: 11, name: 7, nation: 8, godName: 11 },
      // Row 57, cut through by the fold, is not counted.
      plate1823: { rows: 15, name: 12, nation: 8, godName: 14 },
    });
  });

  it("finds where the two plates differ", () => {
    expect(plateDifferences()).toEqual([
      { no: 62, column: "name", plate1909: "", plate1823: "Iahhel" },
      {
        no: 66,
        column: "nation",
        plate1909: "Les Brahmanes",
        plate1823: "Les Brachmanes",
      },
      { no: 69, column: "godName", plate1909: "DÉOS", plate1823: "DÊOS" },
      { no: 71, column: "name", plate1909: "Haiuiel", plate1823: "Haiaiel" },
    ]);
  });
});

describe("Kircher's plate, the first table's source", () => {
  const angels: { no: number; people: { fr: string }; godName: string }[] =
    read("./seventyTwoAngels.json5");
  const french: string[] = read("./seventyTwoAngelsText/fr.json5");
  const departures = kircherDepartures();
  const departs = (no: number, field: string) =>
    departures.some((d) => d.no === no && d.field === field);

  it("has seventy-two rays in order, each with a name and a nation", () => {
    const rays = kircherRays();
    expect(rays.map((ray) => ray.ray)).toEqual(
      Array.from({ length: 72 }, (_, i) => i + 1),
    );
    for (const ray of rays) {
      expect(ray.godName, `ray ${ray.ray}`).not.toBe("");
      expect(ray.nation, `ray ${ray.ray}`).not.toBe("");
    }
    // The sequence breaks between Thraces and Hebræi, where the numbering
    // begins; and the first ray keeps the engraver's resh.
    expect([rays[0].nation, rays[71].nation]).toEqual(["Hebræi", "Thraces"]);
    expect(rays[0].godName).toBe("יהרה");
    expect(rays[0].note).toContain("engraver's slip");
    expect(rays[71].godName).toBe("KALO");
  });

  it("transliterates as the plate's header says", () => {
    expect(transliterated("GOTT")).toBe(transliterated("Goth"));
    expect(transliterated("Θεὸς")).toBe(transliterated("Théos"));
    expect(transliterated("ΘƐΟϹ")).toBe(transliterated("Téos"));
    expect(transliterated("BVEG")).toBe(transliterated("Bueg"));
    expect(transliterated("ΔΗΟS")).toBe(transliterated("Déos"));
    expect(transliterated("HOBA")).not.toBe(transliterated("Hobo"));
    const ray = (no: number) => kircherRays()[no - 1];
    expect(sameGodName("Idio ou Iddio", ray(15))).toBe(true);
    expect(sameGodName("Agdy et Abdi", ray(26))).toBe(false);
    expect(sameGodName("", ray(3))).toBe(false);
    // A name the rules cannot read is held to its engraved form too, so a
    // changed transcription fails rather than passing on the French alone.
    expect(sameGodName("Jehovah", ray(1))).toBe(true);
    expect(sameGodName("Jehovah", { ...ray(1), godName: "יהוה" })).toBe(false);
    expect(sameGodName("Allah", { ...ray(4), godName: "ألله" })).toBe(false);
  });

  // The rule is only half the check: a name of God that differs from the
  // plate's beyond it must be a recorded departure, and a recorded one must
  // differ, so a new reading of either side that moves a name fails here.
  it("records every name of God that departs from it, and no other", () => {
    for (const angel of angels) {
      const ray = kircherRays()[angel.no - 1];
      expect(
        departs(angel.no, "godName"),
        `genius ${angel.no}: ${angel.godName} beside ${ray.godName}`,
      ).toBe(!sameGodName(angel.godName, ray));
    }
  });

  it("holds the plates' names of God to it too", () => {
    for (const angel of angels) {
      const ray = kircherRays()[angel.no - 1];
      const { plate1909, plate1823 } = plateCells(angel.no);
      for (const row of [plate1909, plate1823])
        if (row?.godName && !row.partly)
          expect(
            sameGodName(row.godName, ray),
            `row ${angel.no}: ${row.godName} beside ${ray.godName}`,
          ).toBe(!departs(angel.no, "godName"));
    }
  });

  // A nation cannot be compared with its Latin by rule, so every pair is
  // listed: accepted as the same people, or recorded as a departure, never
  // both. A new reading of an entry or a ray that moves a nation fails.
  it("holds every entry's nation to an accepted pair or a recorded departure, never both", () => {
    const accepted = new Map(kircherNations().map((pair) => [pair.no, pair]));
    for (const angel of angels) {
      const where = `genius ${angel.no}: ${angel.people.fr}`;
      const pair = accepted.get(angel.no);
      expect(Boolean(pair) !== departs(angel.no, "people"), where).toBe(true);
      if (!pair) continue;
      expect(pair.entry, where).toBe(angel.people.fr);
      expect(pair.nation, where).toBe(kircherRays()[angel.no - 1].nation);
    }
    // An accepted pair with no French is one whose entry gives the name as
    // a group's (the philosophers', the cabalists'), and says so.
    const attributed = kircherRemarks().map((remark) => remark.no);
    expect(
      kircherNations()
        .filter((pair) => !pair.entry)
        .map((pair) => pair.no),
    ).toEqual(attributed);
    for (const departure of departures.filter((d) => d.field === "people"))
      expect(departure.gloss, `genius ${departure.no}`).toBeTruthy();
  });

  // Where only the entry departs, the plates must show the row with the 1823
  // entry's word, which is not the reissue entry's.
  it("checks a departure the table does not share against the plates", () => {
    const worded = (value: string) =>
      value
        .normalize("NFD")
        .replace(/\p{Mark}/gu, "")
        .toLowerCase()
        .replace(/^(la )?langue\s+/, "")
        .replace(/^(des|les|le|la)\s+/, "");
    const shared = departures.filter((d) => d.tableAgrees);
    expect(shared.map((d) => `${d.no} ${d.field}`)).toEqual(["64 people"]);
    for (const departure of shared) {
      const { plate1909, plate1823 } = plateCells(departure.no);
      const in1823 = witnessed.readings.find(
        (r) => r.no === departure.no && r.field === departure.field,
      )?.print1823.reads;
      const entry = angels[departure.no - 1].people.fr;
      for (const row of [plate1909, plate1823]) {
        expect(row, `row ${departure.no}`).toBeDefined();
        expect(worded(row?.nation ?? "")).toBe(worded(in1823 ?? ""));
        expect(worded(row?.nation ?? "")).not.toBe(worded(entry));
      }
    }
  });

  it("quotes the entries its remarks rest on", () => {
    for (const remark of kircherRemarks()) {
      expect(french[remark.no - 1], `genius ${remark.no}`).toContain(
        remark.quote,
      );
      expect(remark.remark).toContain(remark.quote.split(",")[0]);
    }
  });

  it("gives every departure a note with its 1823 witness and its ray", () => {
    for (const departure of departures) {
      const note = notes.find(
        (n) => n.no === departure.no && n.field === departure.field,
      );
      const where = `genius ${departure.no} ${departure.field}`;
      expect(note, where).toBeDefined();
      expect(note?.kind, where).toBe("reading");
      // Lenain's words stay the data: the note keeps them.
      expect(note?.used, where).toBe("");
      expect(
        note?.witnesses?.map((w) => w.source),
        where,
      ).toEqual(["print1823", "kircherPlate"]);
      const plate = note?.witnesses?.[1];
      expect(plate?.mirror, where).toBe("kircherPlate");
      expect(plate?.label, where).toBe(
        `Kircher's plate, ray ${departure.no} (numbered on the rim)`,
      );
      const reading = witnessed.readings.find(
        (r) => r.no === departure.no && r.field === departure.field,
      );
      expect(reading?.print1823.at, where).toBeGreaterThan(0);
    }
    // And no note claims a departure the plate's data does not record.
    expect(
      notes.filter((n) => n.witnesses?.some((w) => w.source === "kircherPlate"))
        .length,
    ).toBe(departures.length);
  });

  it("tells the reissue's change from Lenain's own", () => {
    const verdicts = Object.fromEntries(
      departures.map((d) => [
        `${d.no} ${d.field}`,
        witnessed.readings.find((r) => r.no === d.no && r.field === d.field)
          ?.verdict,
      ]),
    );
    // Mogols in 1823, on both plates, and in Kircher (Mogores); Mongols is
    // the reissue's entry alone.
    expect(verdicts["64 people"]).toBe("reissueChanged");
    expect(
      Object.entries(verdicts)
        .filter(([, verdict]) => verdict !== "lenain")
        .map(([where, verdict]) => `${where} ${verdict}`),
    ).toEqual([
      "3 people agree",
      "3 godName agree",
      "7 people agree",
      "7 godName agree",
      "35 people agree",
      "64 people reissueChanged",
    ]);
  });

  it("sits beside every row of the first table, and says where it departs", () => {
    const rows = firstTable();
    for (const row of rows)
      expect(row.kircher.ray, `row ${row.no}`).toBe(row.no);
    const row = (no: number) => rows[no - 1];
    expect(sourceCell(row(3))).toBe(
      "reconstructed; the entry names neither a nation nor a name of God",
    );
    expect(sourceCell(row(50))).toBe(
      "reconstructed; differs from Kircher in nation",
    );
    expect(sourceCell(row(68))).toBe(
      "on the reissue's plate; differs from Kircher in nation and name of God",
    );
    // The table has Les Mogols, as Kircher; only the reissue's entry differs.
    expect(sourceCell(row(64))).toBe("on the reissue's plate");
    expect(sourceCell(row(37))).toContain("d'après les anciens Philosophes");
    // The engraver's slip on ray 1, and ray 7's guess, beside their rows.
    expect(sourceCell(row(1))).toContain("the engraver's slip");
    expect(sourceCell(row(7))).toContain("best guess");
    expect(kircherSentence()).toContain(
      "his nation in 59, the 37th and 38th among them by attribution",
    );
    expect(kircherSentence()).toContain(
      "the entries give Kircher's name of God in 63 of the 72 rows and his nation in 59",
    );
  });
});
