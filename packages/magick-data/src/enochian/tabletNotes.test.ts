import { describe, expect, it } from "vitest";
import tabletNotes, {
  sourceText,
  sourceUrl,
  squareNote,
  squareNotes,
  type TabletSource,
  versionNote,
} from "./TabletNotes.ts";
import tablets, {
  type EnochianTabletID,
  readingMark,
  TABLET_VERSIONS,
  tabletReading,
  tabletVersion,
  WATCHTOWER_IDS,
} from "./Tablets.ts";

const allSources = (): TabletSource[] => [
  ...tabletNotes.versions.flatMap((version) => version.sources),
  ...tabletNotes.differences.flatMap((topic) => topic.sources),
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

  it("note every version, in order, against every other", () => {
    expect(tabletNotes.versions.map((version) => version.id)).toEqual([
      ...TABLET_VERSIONS,
    ]);
    for (const version of tabletNotes.versions) {
      expect(Object.keys(version.differs).sort(), version.id).toEqual(
        TABLET_VERSIONS.filter((other) => other !== version.id).sort(),
      );
      for (const text of [
        version.text,
        version.reversed,
        version.sigils,
        ...Object.values(version.differs),
      ])
        expect(text?.length, version.id).toBeGreaterThan(30);
      expect(version.sources.length, version.id).toBeGreaterThan(0);
    }
    expect(versionNote("dee")?.title).toBe("Dee's, 1584");
    expect(versionNote("nonesuch")).toBeUndefined();
    expect(tabletNotes.intro).toContain("Dee alone");
  });

  it("leave the counts to the readings", () => {
    // Prose written beside data drifts from it: the notes give no count of
    // squares or letters, which the page reads from the readings.
    const numbers =
      /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|twenty|\d+) squares\b/;
    const prose = [
      ...tabletNotes.versions.flatMap((version) => [
        version.text,
        ...Object.values(version.differs),
      ]),
      ...Object.values(tabletNotes.tablets).map((note) => note.text),
    ];
    // Nor a count in other words.
    for (const text of prose)
      expect(text).not.toMatch(
        /\b(?:dozens?|score|scores|half|halves|hundreds?)\b/i,
      );
    const counted = prose.filter((text) => numbers.test(text ?? ""));
    // Facts of the sources, not counts of the data: the four squares Dee
    // corrected, the print's ten misprints, the two it leaves empty.
    for (const text of counted)
      for (const count of text.match(new RegExp(numbers, "g")) ?? [])
        expect(["four squares", "ten squares", "two squares"]).toContain(count);
  });

  it("cite only works they name, each with a place or an edition", () => {
    for (const source of allSources()) {
      const work = tabletNotes.works[source.work];
      expect(work, source.work).toBeDefined();
      if (source.leaf) expect(work.archive, source.work).toBeDefined();
    }
    expect(tabletNotes.differences.map((topic) => topic.id)).toEqual([
      "letters",
      "doubled",
      "reversed",
      "earthRow8",
      "emptyFire",
      "union",
      "attributions",
      "sigils",
      "colours",
    ]);
    for (const topic of tabletNotes.differences)
      expect(topic.sources.length, topic.id).toBeGreaterThan(0);
  });

  it("note squares inside their tablets, once each, top row first", () => {
    for (const [id, notes] of Object.entries(tabletNotes.squares)) {
      const tablet = tabletVersion(tablets[id as EnochianTabletID]);
      const keys = (notes ?? []).map((note) => note.row * 100 + note.column);
      expect(keys, id).toEqual([...new Set(keys)].sort((a, b) => a - b));
      for (const note of notes ?? []) {
        expect(tablet?.grid[note.row]?.[note.column], id).toBeDefined();
        expect(
          note.note.length,
          `${id} ${note.row},${note.column}`,
        ).toBeGreaterThan(20);
        expect(note.sources.length).toBeGreaterThan(0);
      }
    }
  });

  it("note every square the Golden Dawn's version chooses, or Dee corrected or left empty", () => {
    for (const id of WATCHTOWER_IDS) {
      const tablet = tablets[id];
      const squares = [
        ...(tablet.choices?.gd ?? []),
        ...(tabletReading(tablet, "dee1584")?.marks ?? []).filter(
          (mark) => mark.dictated || mark.alt,
        ),
        ...(tabletReading(tablet, "raphael1587")?.marks ?? []).filter(
          (mark) => mark.alt,
        ),
      ];
      for (const { row, column } of squares)
        expect(
          squareNote(id, row, column),
          `${id} ${row},${column}`,
        ).toBeDefined();
    }
    // The letters first written are named in their notes.
    for (const id of WATCHTOWER_IDS)
      for (const note of squareNotes(id)) {
        const mark = readingMark(
          tabletReading(tablets[id], "dee1584"),
          note.row,
          note.column,
        );
        for (const letter of mark?.dictated ?? [])
          expect(note.note, `${id} ${note.row},${note.column}`).toMatch(
            new RegExp(`\\b${letter}\\b`),
          );
      }
  });

  it("find a square's note, and none for a square or key without", () => {
    expect(squareNote("water", 4, 11)?.note).toMatch(/y and l side by side/);
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
    const recensa = {
      work: "casaubon1659",
      part: "Actio Tertia",
      page: 15,
      leaf: 456,
    } as const;
    expect(sourceText(recensa)).toMatch(
      /, Actio Tertia, p\.15 \(archive\.org leaf n456\)$/,
    );
    expect(sourceUrl(recensa)).toBe(
      "https://archive.org/details/truefaithfulrela00deej/page/n456",
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
    expect(sourceUrl({ work: "cottonAppXLVI" })).toBeUndefined();
  });
});
