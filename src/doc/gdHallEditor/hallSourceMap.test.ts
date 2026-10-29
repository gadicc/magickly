import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import { describe, expect, it } from "vitest";
import {
  type HallSourceLocations,
  parseHallSourceWithLocations,
  printHallSource,
} from "../gdHallPug";
import { gdHallSource } from "../gdHallRows";
import { ritualPugHeaderId } from "../ritualPugIds";
import { type HallElement, indexHall } from "./hallModel";
import { hallSourceMap } from "./hallSourceMap";
import { sequentialIds } from "./hallTestFixtures";

/** A hall typed by hand: no IDs, lists and comments over several lines. */
const typed = [
  "", // 1: before the hall
  "gdHall(width=10)", // 2
  "  //- a comment", // 3
  "  //- carried", // 4
  "    onto a second line", // 5
  "", // 6
  "  dais", // 7
  '    officer(role="hierophant",', // 8
  "      x=1", // 9
  "    )", // 10
  "", // 11: precedes the comment in the row
  "    //- inner", // 12
  '    officer(role="hiereus")', // 13
  "  floor", // 14
  "    altar(x=3)", // 15
  '      label(text="Altar")', // 16
  "", // 17
  "", // 18
  "", // 19: the final empty line
].join("\n");

const located = (source: string) => {
  const { hall, locations } = parseHallSourceWithLocations(source);
  const map = hallSourceMap(hall, source, locations);
  if (!map) throw new Error("no map");
  return map;
};

describe("hallSourceMap", () => {
  it("places every element of every preset where the printer puts it, without parsing", () => {
    for (const preset of HALL_PRESETS) {
      const hall = gdHallSource(preset.hall, sequentialIds());
      const source = printHallSource(hall, { ids: true });
      const lines = source.split("\n");
      const printed = hallSourceMap(hall, source);
      const parsed = located(source);
      if (!printed) throw new Error(`${preset.id}: no printed map`);
      for (const [id, entry] of indexHall(hall).byId) {
        const place = printed.placeOf(entry.rowPath);
        expect(place, preset.id).toEqual(parsed.placeOf(entry.rowPath));
        if (!place) throw new Error(`${preset.id}: ${id} has no place`);
        const text = lines[place.line - 1];
        expect(ritualPugHeaderId(text)).toBe(id);
        expect(place.column).toBe(text.length - text.trimStart().length + 1);
        expect(printed.pathAt(place)).toEqual(entry.rowPath);
      }
      // Every line, in the indentation and past its end, agrees too.
      for (let line = 0; line <= lines.length + 1; line++)
        for (const column of [1, 200])
          expect(
            printed.pathAt({ line, column }),
            `${preset.id}:${line}`,
          ).toEqual(parsed.pathAt({ line, column }));
    }
  });

  it("refuses a source the printer did not write for the hall", () => {
    const hall = gdHallSource(HALL_PRESETS[0].hall, sequentialIds());
    const source = printHallSource(hall, { ids: true });
    expect(hallSourceMap(hall, `${source}\n`)).toBeNull();
  });

  it("gives each line of a typed hall the element it belongs to", () => {
    const map = located(typed);
    const at = (line: number, column = 1) => map.pathAt({ line, column });
    // Outside the hall, and its own lines: nothing to select.
    expect(at(1)).toBeNull();
    expect(at(2)).toEqual([]);
    // Comments and blank lines in the hall, a comment's second line too.
    expect(at(3)).toEqual([]);
    expect(at(5, 7)).toEqual([]);
    expect(at(6)).toEqual([]);
    // A row and its children, an attribute list over three lines.
    expect(at(7, 3)).toEqual([0]);
    expect(at(8, 9)).toEqual([0, 0]);
    expect(at(9, 7)).toEqual([0, 0]);
    expect(at(10, 5)).toEqual([0, 0]);
    // A blank line and a comment inside the row belong to the row.
    expect(at(11)).toEqual([0]);
    expect(at(12, 8)).toEqual([0]);
    // In the indentation or past the end, a line is its element's.
    expect(at(13, 1)).toEqual([0, 1]);
    expect(at(13, 200)).toEqual([0, 1]);
    expect(at(14)).toEqual([1]);
    expect(at(15)).toEqual([1, 0]);
    expect(at(16)).toEqual([1, 0, 0]);
    // Blank lines after the hall and the final empty line: the hall's.
    expect(at(17)).toEqual([]);
    expect(at(18)).toEqual([]);
    expect(at(19)).toEqual([]);
    // Lines that are not there.
    expect(at(0)).toBeNull();
    expect(at(20)).toBeNull();
    expect(at(2.5)).toBeNull();
    expect(map.placeOf([0, 1])).toEqual({ line: 13, column: 5 });
    expect(map.placeOf([1, 0, 0])).toEqual({ line: 16, column: 7 });
    expect(map.placeOf([])).toEqual({ line: 2, column: 1 });
    expect(map.placeOf([5])).toBeUndefined();
  });

  it("keeps a list carried on less indented, and blank lines in a comment, with their node", () => {
    const map = located(
      [
        "gdHall", // 1
        "  dais", // 2
        '    officer(role="hierophant",', // 3
        "  x=1", // 4: less indented than its tag
        ")", // 5
        "    //- a note", // 6
        "      carried on", // 7
        "", // 8: inside the comment
        "      and on", // 9
        '    officer(role="hiereus")', // 10
        "", // 11: the final empty line
      ].join("\n"),
    );
    const at = (line: number) => map.pathAt({ line, column: 1 });
    expect(at(3)).toEqual([0, 0]);
    expect(at(4)).toEqual([0, 0]);
    expect(at(5)).toEqual([0, 0]);
    // The comment and every line of it, the blank one too: the row's.
    expect([6, 7, 8, 9].map(at)).toEqual([[0], [0], [0], [0]]);
    expect(at(10)).toEqual([0, 1]);
    expect(at(11)).toEqual([]);
  });

  it("maps the same lines to the same paths at every read, IDs or none", () => {
    const first = located(typed);
    const second = located(typed);
    for (let line = 1; line <= 19; line++)
      expect(first.pathAt({ line, column: 3 })).toEqual(
        second.pathAt({ line, column: 3 }),
      );
  });

  it("chooses between nodes that start on one line by the caret's column", () => {
    // Pug in a hall never puts two nodes on one line; the map does not
    // rely on it.
    const hall: HallElement = {
      kind: "element",
      id: "Hall000000000001",
      tag: "gdHall",
      attrs: {},
      children: [
        {
          kind: "element",
          id: "Dais000000000001",
          tag: "dais",
          attrs: {},
          children: [
            {
              kind: "element",
              id: "Offi000000000001",
              tag: "officer",
              attrs: {},
              children: [],
            },
          ],
        },
      ],
    };
    const [dais] = hall.children as HallElement[];
    const [officer] = dais.children as HallElement[];
    const locations: HallSourceLocations = new WeakMap();
    locations.set(hall, { line: 1, column: 1 });
    locations.set(dais, { line: 2, column: 3 });
    locations.set(officer, { line: 2, column: 9 });
    const map = hallSourceMap(hall, "gdHall\n  dais: officer\n", locations);
    expect(map?.pathAt({ line: 2, column: 1 })).toEqual([0]);
    expect(map?.pathAt({ line: 2, column: 8 })).toEqual([0]);
    expect(map?.pathAt({ line: 2, column: 9 })).toEqual([0, 0]);
    expect(map?.pathAt({ line: 2, column: 30 })).toEqual([0, 0]);
  });
});
