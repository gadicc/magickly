import { describe, expect, it } from "vitest";
import tabletNotes, {
  sourceText,
  sourceUrl,
  squareNote,
  squareNotes,
  type TabletSource,
} from "./TabletNotes.ts";
import tablets, { type EnochianTablet } from "./Tablets.ts";

const allSources = (): TabletSource[] => [
  ...[...tabletNotes.versions, ...tabletNotes.differences].flatMap(
    (topic) => topic.sources,
  ),
  ...Object.values(tabletNotes.tablets).flatMap((note) => note.sources),
  ...Object.values(tabletNotes.squares).flatMap((notes) =>
    (notes ?? []).flatMap((note) => note.sources),
  ),
];

describe("the tablet notes", () => {
  it("note every tablet, and only tablets the data has", () => {
    expect(Object.keys(tabletNotes.tablets).sort()).toEqual(
      Object.keys(tablets).sort(),
    );
    for (const id of Object.keys(tabletNotes.squares))
      expect(Object.hasOwn(tablets, id), id).toBe(true);
  });

  it("call a tablet the Golden Dawn's only where its rows are", () => {
    expect(tabletNotes.tablets.water.version).toBe("gd");
    expect(tabletNotes.tablets.fire.version).toBe("gd");
    expect(tabletNotes.tablets.union.version).toBe("gd");
    expect(tabletNotes.tablets.earth.version).toBe("older");
    expect(tabletNotes.tablets.air.version).toBe("older");
  });

  it("cite only works they name, each with a place or an edition", () => {
    for (const source of allSources()) {
      const work = tabletNotes.works[source.work];
      expect(work, source.work).toBeDefined();
      if (source.leaf) expect(work.archive, source.work).toBeDefined();
    }
    // The topics are all there, each cited.
    expect(tabletNotes.versions.map((topic) => topic.id)).toEqual([
      "dee1584",
      "raphael1587",
      "gd",
      "printings",
    ]);
    expect(tabletNotes.differences.map((topic) => topic.id)).toEqual([
      "letters",
      "doubled",
      "reversed",
      "earthRow8",
      "union",
      "attributions",
      "colours",
    ]);
    for (const topic of [...tabletNotes.versions, ...tabletNotes.differences])
      expect(topic.sources.length, topic.id).toBeGreaterThan(0);
  });

  it("note squares inside their tablets, once each, top row first", () => {
    for (const [id, notes] of Object.entries(tabletNotes.squares)) {
      const tablet: EnochianTablet = tablets[id as keyof typeof tablets];
      const keys = (notes ?? []).map((note) => note.row * 100 + note.column);
      expect(keys, id).toEqual([...new Set(keys)].sort((a, b) => a - b));
      for (const note of notes ?? []) {
        expect(tablet.grid[note.row]?.[note.column], id).toBeDefined();
        expect(
          note.note.length,
          `${id} ${note.row},${note.column}`,
        ).toBeGreaterThan(20);
      }
    }
  });

  it("note every marked square of Water and Fire, from what the sources print", () => {
    for (const id of ["water", "fire"] as const) {
      const tablet: EnochianTablet = tablets[id];
      for (const mark of tablet.marks ?? []) {
        const note = squareNote(id, mark.row, mark.column);
        expect(note, `${id} ${mark.row},${mark.column}`).toBeDefined();
        // Every letter the grid or its alt holds is one a source prints.
        const printed = Object.values(note?.printed ?? {})
          .join(" ")
          .toLowerCase();
        for (const letter of [
          tablet.grid[mark.row][mark.column],
          ...(mark.alt ?? []),
        ])
          expect(printed, `${id} ${mark.row},${mark.column}`).toContain(
            letter.toLowerCase(),
          );
      }
    }
  });

  it("count the squares where Earth and Air differ from the Golden Dawn's", () => {
    const words = [
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "eleven",
      "twelve",
      "thirteen",
      "fourteen",
      "fifteen",
    ];
    for (const id of ["earth", "air"] as const) {
      const tablet: EnochianTablet = tablets[id];
      const differing = squareNotes(id).filter((note) => note.goldenDawn);
      for (const note of differing) {
        // A letter the Golden Dawn prints there, and not this tablet's.
        expect(note.goldenDawn, `${id} ${note.row},${note.column}`).not.toBe(
          tablet.grid[note.row][note.column],
        );
        expect(note.printed.regardie1940.split(" ")[0]).toBe(note.goldenDawn);
      }
      const count = words[differing.length];
      expect(tabletNotes.tablets[id].text).toContain(
        `differ from the Golden Dawn's in ${count} squares`,
      );
    }
    for (const id of ["water", "fire"] as const)
      expect(squareNotes(id).some((note) => note.goldenDawn)).toBe(false);
  });

  it("find a square's note, and none for a square or key without", () => {
    expect(squareNote("water", 4, 11)?.printed.regardie1940).toBe(
      "y and l over N and h",
    );
    expect(squareNote("water", 6, 6)).toBeUndefined();
    expect(squareNotes("union")).toEqual([]);
    expect(squareNotes("constructor")).toEqual([]);
    expect(squareNotes("__proto__")).toEqual([]);
  });

  it("write and link a source", () => {
    const regardie = { work: "regardie1940", page: 271, leaf: 263 } as const;
    expect(sourceText(regardie)).toBe(
      "Israel Regardie, The Golden Dawn, vol. 4 (Aries Press, Chicago, 1940), p.271 (archive.org leaf n263)",
    );
    expect(sourceUrl(regardie)).toBe(
      "https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n263",
    );
    expect(sourceUrl({ work: "equinox1912", plate: "III", leaf: 241 })).toBe(
      "https://archive.org/details/crowley-equinox_202110/The%20Equinox%20Vol.%201%2C%20No.%207/page/n241",
    );
    expect(sourceText({ work: "greer" })).toContain("ISBN 978-0-7387-4399-8");
    expect(sourceUrl({ work: "greer" })).toBeUndefined();
    expect(sourceText({ work: "equinox1912", plate: "X" })).toBe(
      'The Equinox, vol. I no. 7 (London, 1912), "Liber Chanokh", Plate X',
    );
    expect(
      sourceText({ work: "equinox1912", plate: "III", page: 234 }),
    ).toMatch(/, Plate III, p\.234$/);
    expect(sourceUrl({ work: "regardie1940" })).toBe(
      "https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940",
    );
    expect(sourceUrl({ work: "sloane3191" })).toBeUndefined();
  });
});
