import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apparatusSource, type Note, withWitnesses } from "./apparatus";
import { readEvidence } from "./evidence";
import { handReadings } from "./hebrew";
import { MARKDOWN_PATH, renderMarkdown } from "./renderPages";
import { disagreements } from "./validate";
import {
  inNotation,
  readWitnesses,
  verdictProblem,
  type WitnessReading,
  witnessedWhy,
  witnessesOf,
} from "./witnesses";

/**
 * The witnesses are read by hand and joined to notes that are computed, so the
 * join is where a later re-extraction could silently drop one. These hold it
 * to failing loudly instead, and to wording a reader can check.
 */

const TABLES_WHY =
  "Lenain's own tables give otherwise, and the rest of the book keeps to them.";

const note = (fields: Partial<Note> = {}): Note => ({
  no: 18,
  kind: "correction",
  field: "presidingDays",
  printed: "6/4, 17/6, 28/8, 8/11, 18/1",
  used: "6/4, 17/6, 28/8, 8/11, 19/1",
  why: TABLES_WHY,
  ...fields,
});

const reading = (fields: Partial<WitnessReading> = {}): WitnessReading => ({
  no: 18,
  field: "presidingDays",
  verdict: "reissue",
  print1823: { at: 57, reads: "19 janvier" },
  ms5365: { at: 65, reads: "19 janvier" },
  ...fields,
});

describe("joining witnesses to the apparatus", () => {
  it("stops on a reading that matches no note", () => {
    expect(() =>
      withWitnesses([note()], [reading(), reading({ no: 19 })], []),
    ).toThrow(/match no note: 19\|presidingDays/);
  });

  it("stops on a computed correction no one looked up", () => {
    const unread = note({ no: 20, field: "degrees" });
    expect(() =>
      withWitnesses([note(), unread], [reading()], [note(), unread]),
    ).toThrow(/no witness reading: 20\|degrees/);
  });

  it("stops where a misprinted Hebrew name is not given as 1823 has it", () => {
    const hebrew = note({
      no: 37,
      kind: "reading",
      field: "name.he",
      printed: "אנואל",
      used: "אנואל",
      why: "Read from the scan by hand.",
    });
    expect(() =>
      withWitnesses(
        [hebrew],
        [
          reading({
            no: 37,
            field: "name.he",
            print1823: { at: 69, reads: "אניאל" },
          }),
        ],
        [],
      ),
    ).toThrow(/1823 printing reads אניאל/);
  });

  it("applies one reading to every note at its place", () => {
    const choirs = [
      note({ no: 64, field: "choir", printed: "le chœur des anges" }),
      note({ no: 64, field: "choir", printed: "anges" }),
    ];
    const joined = withWitnesses(
      choirs,
      [reading({ no: 64, field: "choir", verdict: "lenain" })],
      [],
    );
    expect(joined.every((n) => n.witnesses?.length === 2)).toBe(true);
  });
});

describe("what a witnessed note says", () => {
  it("lays a misprint at the reissue's door, with the 1823 reading", () => {
    const { why } = witnessedWhy(note(), reading(), true);
    expect(why).toBe(
      "The reissue's resetting misprints this: the 1823 printing reads " +
        "“19 janvier” (p. 57), as Lenain's own tables require. The " +
        "manuscript copy Ms 5365 has the same (leaf n65).",
    );
  });

  it("says nothing is printed where neither printing gives an hour", () => {
    const { why, printed } = witnessedWhy(
      note({ no: 8, field: "invocation", printed: "", used: "2:20" }),
      reading({
        no: 8,
        field: "invocation",
        verdict: "absent",
        print1823: { at: 50, reads: "" },
        ms5365: { at: 59, reads: "" },
      }),
      true,
    );
    expect(printed).toBe("");
    expect(why).toMatch(/^Neither the 1823 printing \(p\. 50\) nor/);
    expect(why).toMatch(/gives none either \(leaf n59\)\.$/);
    expect(why).not.toMatch(/“”/);
  });

  it("calls a manuscript's difference the copyist's", () => {
    const { why } = witnessedWhy(
      note(),
      reading({
        verdict: "lenain",
        print1823: { at: 54, reads: "66–10" },
        ms5365: { at: 62, reads: "66–70" },
      }),
      true,
    );
    expect(why).toMatch(/Ms 5365 reads “66–70” \(leaf n62\), a copyist's/);
  });

  it("links the page of each copy", () => {
    expect(witnessesOf(reading())).toEqual([
      {
        source: "print1823",
        label: "1823 printing, p. 57",
        at: "57",
        url: "https://books.google.com/books?id=qt9SAAAAcAAJ&pg=PA57",
        reads: "19 janvier",
      },
      {
        source: "ms5365",
        label: "Ms 5365, leaf n65",
        at: "n65",
        url: "https://archive.org/details/BIUSante_ms05365/page/n65/mode/1up",
        reads: "19 janvier",
      },
    ]);
  });

  it("never quotes an empty reading, in the committed file", () => {
    for (const each of readWitnesses().readings) {
      const { why } = witnessedWhy(
        { no: each.no, field: each.field, why: "A note.", printed: "x" },
        each,
        false,
      );
      expect(why, `${each.no} ${each.field}`).not.toMatch(/“”/);
    }
  });
});

describe("holding a verdict to its values", () => {
  it("puts the 1823 reading in the apparatus's notation", () => {
    expect(inNotation("degrees", "226–130")).toBe("226-130");
    expect(
      inNotation("presidingDays", "20 mars, 31 avril, 11 août, 2 janvier"),
    ).toBe("20/3, 31/4, 11/8, 2/1");
    expect(inNotation("decade", "9e décade")).toBe("9");
    // Worded differently on the two sides, so not compared.
    expect(inNotation("invocation", "depuis 5 heures du matin")).toBe(
      undefined,
    );
    expect(inNotation("choir", "le chœur des anges")).toBe(undefined);
  });

  it("will not blame the reissue for what 1823 prints too", () => {
    expect(
      verdictProblem(
        note({ printed: "6/4, 17/6, 28/8, 8/11, 19/1" }),
        reading({
          print1823: {
            at: 57,
            reads: "6 avril, 17 juin, 28 août, 8 novembre, 19 janvier",
          },
        }),
      ),
    ).toMatch(/yet the verdict blames the reissue/);
  });

  it("will not blame Lenain for what 1823 does not print", () => {
    const degrees = note({ no: 14, field: "degrees", printed: "66-10" });
    const lenain = (reads: string) =>
      reading({
        no: 14,
        field: "degrees",
        verdict: "lenain",
        print1823: { at: 54, reads },
      });
    expect(verdictProblem(degrees, lenain("66–10"))).toBe(undefined);
    expect(verdictProblem(degrees, lenain("66–70"))).toMatch(
      /yet the verdict says they agree/,
    );
  });

  it("will not call a Hebrew name corrected when the edition uses 1823's", () => {
    const hebrew = note({
      no: 6,
      kind: "reading",
      field: "name.he",
      printed: "ללהאל",
      used: "ללחאל",
    });
    expect(
      verdictProblem(
        hebrew,
        reading({
          no: 6,
          field: "name.he",
          verdict: "reissueCorrected",
          print1823: { at: 49, reads: "ללחאל" },
        }),
      ),
    ).toMatch(/the reissue corrected nothing/);
  });

  it("will not blame the reissue for a Hebrew name it prints as 1823 does", () => {
    expect(
      verdictProblem(
        note({
          no: 13,
          kind: "reading",
          field: "name.he",
          printed: "יזּלּׄאׄלּ",
          used: "יזלאל",
        }),
        reading({
          no: 13,
          field: "name.he",
          print1823: { at: 53, reads: "יזלאל" },
        }),
      ),
    ).toMatch(/as the reissue does, yet the verdict blames the reissue/);
  });

  it("stops on a hand-read Hebrew name no one looked up", () => {
    const hebrew = note({
      no: 13,
      kind: "reading",
      field: "name.he",
      printed: "יזלאל",
      used: "יזלאל",
    });
    expect(() => withWitnesses([hebrew], [], [hebrew])).toThrow(
      /no witness reading: 13\|name\.he/,
    );
  });
});

describe("the witness file", () => {
  const dir = mkdtempSync(join(tmpdir(), "witnesses-"));
  const write = (name: string, value: unknown) => {
    const path = join(dir, name);
    writeFileSync(path, JSON.stringify(value));
    return path;
  };
  const withRows = (rows: { no: number }[]) =>
    write("rows.json5", {
      readings: [],
      firstTable: {
        page: 25,
        rows: rows.map((row) => ({
          name: "",
          nation: "",
          godName: "",
          ...row,
        })),
      },
    });

  it("holds the 1823 plate's rows to 1–72, once each, in order", () => {
    expect(() =>
      readWitnesses(withRows([{ no: 57 }, { no: 58 }])),
    ).not.toThrow();
    expect(() => readWitnesses(withRows([{ no: 0 }]))).toThrow(
      /not one of the 72/,
    );
    expect(() => readWitnesses(withRows([{ no: 73 }]))).toThrow(
      /not one of the 72/,
    );
    expect(() => readWitnesses(withRows([{ no: 58 }, { no: 58 }]))).toThrow(
      /repeated or out of order/,
    );
    expect(() => readWitnesses(withRows([{ no: 59 }, { no: 58 }]))).toThrow(
      /repeated or out of order/,
    );
  });

  it("accepts a misprinted Hebrew name only as recorded", () => {
    const misprint = write("misprint.json5", {
      readings: [
        {
          no: 37,
          field: "name.he",
          verdict: "reissue",
          print1823: { at: 69, reads: "אניאל" },
        },
      ],
      firstTable: { page: 25, rows: [] },
    });
    const none = withRows([]);
    const hands = (row: Record<string, unknown>) =>
      write("hand.json5", [{ no: 37, pointed: "אׄנואלּ", ...row }]);

    expect(
      handReadings(hands({ plain: "אניאל", reissue: "אנואל" }), misprint).get(
        37,
      )?.plain,
    ).toBe("אניאל");
    // The pointed form must strip to the reissue's letters as recorded.
    expect(() =>
      handReadings(hands({ plain: "אניאל", reissue: "אבואל" }), misprint),
    ).toThrow(/strips to אנואל, not אבואל/);
    // No witness, no misprint.
    expect(() =>
      handReadings(hands({ plain: "אניאל", reissue: "אנואל" }), none),
    ).toThrow(/no witness records the 1823 printing as אניאל/);
    // A witness, but the row does not say what the reissue prints.
    expect(() => handReadings(hands({ plain: "אנואל" }), misprint)).toThrow(
      /gives no reissue letters/,
    );
  });
});

describe("absent invocation hours", () => {
  const scanned = (invocationFrom: {
    hour: number;
    minute: number;
    partOfDay: string;
  }) => {
    const [row] = readEvidence().filter((each) => each.no === 1);
    return { ...row.scanned, invocationFrom };
  };

  it("say nothing is printed for the three entries that give no hour", () => {
    for (const row of readEvidence().filter((each) =>
      [8, 38, 44].includes(each.no),
    )) {
      const clash = disagreements(row).find((d) => d.field === "invocation");
      expect(clash?.scanned, `genius ${row.no}`).toBe("");
    }
  });

  it("still read the first genius's midnight as midnight", () => {
    const [first] = readEvidence().filter((each) => each.no === 1);
    expect(first.scanned.invocationFrom.partOfDay).toBe("minuit");
    expect(
      disagreements(first).find((d) => d.field === "invocation"),
    ).toBeUndefined();
    // The same hour with no part of the day is an absent hour, not midnight.
    expect(
      disagreements({
        no: 1,
        scanned: scanned({ hour: 0, minute: 0, partOfDay: "" }),
      }).find((d) => d.field === "invocation")?.scanned,
    ).toBe("");
  });
});

describe("the committed files", () => {
  it("are what the scripts build from the sources today", () => {
    // Cheap enough to run: both read only committed files. A hand edit to
    // either, or a source changed without regenerating, fails here.
    expect(apparatusSource()).toBe(
      readFileSync(
        "packages/magick-data/src/kabbalah/lenain/apparatus.json5",
        "utf8",
      ),
    );
    expect(renderMarkdown()).toBe(readFileSync(MARKDOWN_PATH, "utf8"));
  });
});
