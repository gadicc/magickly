import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import { describe, expect, it } from "vitest";
import { gdHallSourceWarnings, MAX_HALL_WARNINGS } from "./gdHallDiagnostics";
import { gdHallPug } from "./gdHallPug";
import { RITUAL_PUG_HEADER } from "./ritualPug";

const source = (...lines: string[]) =>
  `${RITUAL_PUG_HEADER}\n${lines.join("\n")}\n`;
/** The 1-based column of `text` on a line of `source`. */
const column = (text: string, line: string) => line.indexOf(text) + 1;

describe("hall warnings in Pug source", () => {
  it("places an unknown attribute at its name", () => {
    const line = '    altar(at="centre", colour="red")';
    expect(gdHallSourceWarnings(source("gdHall", "  floor", line))).toEqual([
      {
        line: 4,
        column: column("colour", line),
        message: "Line 4: altar: unknown attribute colour",
      },
    ]);
  });

  it("places an unknown tag at the tag", () => {
    const line = "    unicorn(x=2, y=3)";
    expect(gdHallSourceWarnings(source("gdHall", "  floor", line))).toEqual([
      {
        line: 4,
        column: column("unicorn", line),
        message: "Line 4: unknown tag unicorn; drawn as a placeholder",
      },
    ]);
  });

  it("places a clamped value at its attribute, past comments and IDs", () => {
    const line = '    officer#Ab3k9Qp7Zx2Mn5Rs(role="keryx", x=99, y=2)';
    const warnings = gdHallSourceWarnings(
      source(
        "| Before the hall.",
        "note",
        "  gdHall",
        "    //- the floor",
        "    floor",
        "      //- an officer",
        "",
        `  ${line}`,
      ),
    );
    expect(warnings).toEqual([
      {
        line: 9,
        column: column("x=99", `  ${line}`),
        message: expect.stringMatching(
          /^Line 9: officer: x=99 is outside .* and is clamped$/,
        ),
      },
    ]);
  });

  it("follows each hall in a ritual, in document order", () => {
    const warnings = gdHallSourceWarnings(
      source(
        "gdHall",
        "  floor",
        "    first",
        "ul",
        "  li",
        "    gdHall",
        "      floor",
        "        second",
      ),
    );
    expect(warnings.map(({ line, message }) => [line, message])).toEqual([
      [4, "Line 4: unknown tag first; drawn as a placeholder"],
      [9, "Line 9: unknown tag second; drawn as a placeholder"],
    ]);
  });

  it("names the hall itself for a hall-wide problem", () => {
    expect(
      gdHallSourceWarnings(source('gdHall(wall="glass")', "  floor")),
    ).toEqual([
      expect.objectContaining({
        line: 2,
        column: column("wall", "gdHall(wall"),
      }),
    ]);
  });

  it("has nothing to say about the presets or a source that does not parse", () => {
    for (const preset of HALL_PRESETS)
      expect(gdHallSourceWarnings(source(gdHallPug(preset.hall)))).toEqual([]);
    expect(
      gdHallSourceWarnings(source("gdHall", "  floor", "    each x")),
    ).toEqual([]);
    expect(gdHallSourceWarnings("not ritual pug")).toEqual([]);
  });

  it("shows at most a hundred, and says how many more", () => {
    const warnings = gdHallSourceWarnings(
      source(
        "gdHall",
        "  floor",
        ...Array.from({ length: MAX_HALL_WARNINGS + 5 }, () => "    unicorn"),
      ),
    );
    expect(warnings).toHaveLength(MAX_HALL_WARNINGS + 1);
    expect(warnings.at(-1)).toEqual({
      line: 2,
      column: 1,
      message: "Line 2: 5 more temple hall warnings not shown",
    });
  });
});

describe("hall warnings in a hall's own source (/gd/hall)", () => {
  it("counts lines from the first, without the header", () => {
    const line = '    altar(at="centre", colour="red")';
    const text = ["gdHall", "  //- a comment", "  floor", line, ""].join("\n");
    expect(gdHallSourceWarnings(text, { headerless: true })).toEqual([
      {
        line: 4,
        column: column("colour", line),
        message: "Line 4: altar: unknown attribute colour",
      },
    ]);
    // Read as a whole ritual, the same text has no header: no warnings.
    expect(gdHallSourceWarnings(text)).toEqual([]);
  });
});
