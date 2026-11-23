import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSON5 from "json5";
import { describe, expect, it } from "vitest";
import {
  apparatusSource,
  keptAsPrinted,
  type Note,
  unsettledName,
  withWitnesses,
  witnessedNames,
} from "./apparatus";
import { readEvidence } from "./evidence";
import { handReadings, hebrewNames, hebrewReadings } from "./hebrew";
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

  it("says the reissue changed a word the 1823 printing has otherwise", () => {
    const changed = reading({
      no: 64,
      field: "people",
      verdict: "reissueChanged",
      print1823: { at: 89, reads: "la langue des Mogols" },
      ms5365: undefined,
    });
    const said = note({
      no: 64,
      kind: "reading",
      field: "people",
      printed: "les Mongols",
      used: "",
      why: "Kircher's plate has Mogores.",
    });
    expect(witnessedWhy(said, changed, false).why).toBe(
      "Kircher's plate has Mogores. The reissue changed this: the 1823 " +
        "printing reads “la langue des Mogols” (p. 89).",
    );
    expect(verdictProblem(said, changed)).toBeUndefined();
    // A change to nothing is not a change the 1823 printing can show.
    expect(
      verdictProblem(said, {
        ...changed,
        print1823: { at: 89, reads: "" },
      }),
    ).toMatch(/changed a value the 1823 printing does not give/);
  });

  describe("holds a nation's or a name of God's verdict to the 1823 phrase", () => {
    const entryNote = (no: number, field: string, printed: string) =>
      note({ no, kind: "reading", field, printed, used: "", why: "W." });
    const read1823 = (
      no: number,
      field: string,
      verdict: WitnessReading["verdict"],
      reads: string,
    ) =>
      reading({
        no,
        field,
        verdict,
        print1823: { at: 1, reads },
        ms5365: undefined,
      });

    it("accepts the readings recorded", () => {
      expect(
        verdictProblem(
          entryNote(50, "people", "les Samaritains"),
          read1823(50, "people", "lenain", "la langue des Samaritains"),
        ),
      ).toBeUndefined();
      expect(
        verdictProblem(
          entryNote(41, "people", "la langue irlandaise"),
          read1823(41, "people", "lenain", "la langue Irlandaise"),
        ),
      ).toBeUndefined();
      expect(
        verdictProblem(
          entryNote(3, "people", ""),
          read1823(3, "people", "agree", ""),
        ),
      ).toBeUndefined();
    });

    it("refuses a change the 1823 printing does not show", () => {
      expect(
        verdictProblem(
          entryNote(64, "people", "les Mongols"),
          read1823(64, "people", "reissueChanged", "la langue des Mongols"),
        ),
      ).toMatch(/as the reissue does, yet the verdict blames the reissue/);
      expect(
        verdictProblem(
          entryNote(46, "godName", "Pino"),
          read1823(46, "godName", "reissue", "Pino"),
        ),
      ).toMatch(/as the reissue does, yet the verdict blames the reissue/);
    });

    it("refuses agreement where the 1823 printing differs", () => {
      expect(
        verdictProblem(
          entryNote(50, "people", "les Samaritains"),
          read1823(50, "people", "lenain", "la langue des Sumatrans"),
        ),
      ).toMatch(/yet the verdict says they agree/);
      expect(
        verdictProblem(
          entryNote(3, "people", ""),
          read1823(3, "people", "agree", "les Chaldéens"),
        ),
      ).toMatch(/yet the verdict says it agrees/);
    });

    it("says a nation's difference is Lenain's, not a slip", () => {
      const { why } = witnessedWhy(
        entryNote(50, "people", "les Samaritains"),
        read1823(50, "people", "lenain", "la langue des Samaritains"),
        false,
      );
      expect(why).toBe(
        "W. The 1823 printing has the same (p. 1), so the difference is " +
          "Lenain's, not the reissue's.",
      );
    });
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

  it("links Kircher's table of the verses after the copies, by its leaf", () => {
    const verse = reading({
      no: 11,
      field: "psalm.la",
      verdict: "lenain",
      print1823: { at: 53, reads: "et exultatur Deus salutis meæ" },
      ms5365: undefined,
      kircher: { at: 283, page: 276, reads: "& exaltetur Deus salutis meæ" },
    });
    expect(witnessesOf(verse).map((w) => w.source)).toEqual([
      "print1823",
      "kircherVerses",
    ]);
    expect(witnessesOf(verse)[1]).toEqual({
      source: "kircherVerses",
      label: "Kircher, p. 276",
      at: "n283",
      url: "https://archive.org/details/bub_gb_XjfzMnomDQoC/page/n283/mode/1up",
      reads: "& exaltetur Deus salutis meæ",
    });
  });

  it("refuses a Kircher reading off his table, or on a field he does not give", () => {
    const dir = mkdtempSync(join(tmpdir(), "witnesses-"));
    const file = (kircher: unknown, field = "psalm.la") => {
      const path = join(
        dir,
        `${field}-${JSON.stringify(kircher).length}.json5`,
      );
      writeFileSync(
        path,
        JSON5.stringify({
          readings: [
            {
              no: 11,
              field,
              verdict: "lenain",
              print1823: { at: 53, reads: "x" },
              kircher,
            },
          ],
          firstTable: { page: 25, rows: [] },
        }),
      );
      return path;
    };
    expect(() =>
      readWitnesses(file({ at: 283, page: 276, reads: "x" })),
    ).not.toThrow();
    expect(() =>
      readWitnesses(file({ at: 283, page: 281, reads: "x" })),
    ).toThrow(/not his table/);
    expect(() => readWitnesses(file({ page: 276, reads: "x" }))).toThrow(
      /no page or leaf/,
    );
    expect(() =>
      readWitnesses(file({ at: 283, page: 276, reads: "x" }, "godName")),
    ).toThrow(/only the verses/);
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

describe("names the reissue misprints, whoever read them", () => {
  const hand = (no: number, plain: string, pointed = plain) => ({
    no,
    plain,
    pointed,
  });

  it("gives a machine-read misprint as the 1823 printing has it", () => {
    const names = hebrewNames(
      new Map([
        [69, "ראחאל"],
        [70, "יבמיה"],
      ]),
      new Map(),
      new Map([[69, "ראהאל"]]),
    );
    expect(names.get(69)).toEqual({
      he: "ראהאל",
      hePointed: "ראחאל",
      heSource: "corroborated",
    });
    // A name with no misprint recorded is the reissue's, and nothing more.
    expect(names.get(70)).toEqual({ he: "יבמיה", heSource: "corroborated" });
  });

  it("lets only a recorded misprint differ from the reissue", () => {
    const names = hebrewNames(new Map([[69, "ראחאל"]]), new Map(), new Map());
    expect(names.get(69)?.he).toBe("ראחאל");
    expect(names.get(69)?.hePointed).toBe(undefined);
  });

  it("stops on a misprint the reissue does not print", () => {
    expect(() =>
      hebrewNames(
        new Map([[69, "ראהאל"]]),
        new Map(),
        new Map([[69, "ראהאל"]]),
      ),
    ).toThrow(/so it misprints nothing/);
  });

  it("holds the 1823 letters to the shape of a name", () => {
    const misprint = (in1823: string) => () =>
      hebrewNames(new Map([[69, "ראחאל"]]), new Map(), new Map([[69, in1823]]));
    expect(misprint("ראהאאל")).toThrow(/ראהאאל is 6 letters, not 5/);
    expect(misprint("ראהאה")).toThrow(/ראהאה does not end in יה or אל/);
  });

  it("stops on a misprint of a name no reading gives", () => {
    expect(() =>
      hebrewNames(new Map(), new Map(), new Map([[69, "ראהאל"]])),
    ).toThrow(/Genius 69: a witness records a misprint/);
  });

  it("takes a person's reading over the machines'", () => {
    const names = hebrewNames(
      new Map([[57, "נמחיה"]]),
      new Map([[57, hand(57, "נממיה")]]),
      new Map(),
    );
    expect(names.get(57)).toEqual({
      he: "נממיה",
      hePointed: "נממיה",
      heSource: "hand",
    });
  });

  it("gives the committed 69th as the 1823 printing has it", () => {
    const [entry] = readEvidence().filter((each) => each.no === 69);
    const names = hebrewNames(new Map([[69, entry.nameHe]]));
    expect(names.get(69)).toEqual({
      he: "ראהאל",
      hePointed: "ראחאל",
      heSource: "corroborated",
    });
  });
});

describe("the committed names", () => {
  it("are what hebrewNames makes of the committed readings", () => {
    const evidence = readEvidence();
    const { agreed } = hebrewReadings(
      new Map(evidence.map((row) => [row.no, row.nameHe])),
      new Map(
        evidence.map((row) => [
          row.no,
          { hebrew: row.crop.he, legible: row.crop.legible },
        ]),
      ),
    );
    const names = hebrewNames(agreed);
    const angels: { no: number; name: Record<string, string> }[] = JSON5.parse(
      readFileSync(
        "packages/magick-data/src/kabbalah/seventyTwoAngels.json5",
        "utf8",
      ),
    );
    expect(angels).toHaveLength(72);
    for (const { no, name } of angels) {
      const { en, ...hebrew } = name;
      expect(hebrew, `genius ${no} (${en})`).toEqual(names.get(no) ?? {});
    }
  });
});

describe("notes for witnessed names", () => {
  const corroborated = (he: string, hePointed?: string) => ({
    he,
    ...(hePointed ? { hePointed } : {}),
    heSource: "corroborated" as const,
  });
  const nameRead = (no: number, verdict: WitnessReading["verdict"], at = 60) =>
    reading({
      no,
      field: "name.he",
      verdict,
      print1823: { at, reads: "" },
      ms5365: undefined,
    });

  it("makes a reading note for a witnessed name nothing else notes", () => {
    const [made] = witnessedNames(
      [nameRead(24, "agree")],
      new Map([[24, corroborated("ההויה")]]),
      [],
    );
    expect(made).toEqual({
      no: 24,
      kind: "reading",
      field: "name.he",
      printed: "ההויה",
      used: "ההויה",
      why: "Two readings of the scan agree on the reissue's letters.",
    });
  });

  it("prints the reissue's letters and uses 1823's for a misprint", () => {
    const [made] = witnessedNames(
      [nameRead(69, "reissue", 92)],
      new Map([[69, corroborated("ראהאל", "ראחאל")]]),
      [],
    );
    expect(made.printed).toBe("ראחאל");
    expect(made.used).toBe("ראהאל");
    expect(made.why).toMatch(/not those letters but the 1823 printing's\.$/);
  });

  it("leaves a name that already has a note alone", () => {
    const existing = note({
      no: 34,
      kind: "reading",
      field: "name.he",
      printed: "לּׄההיׄה",
      used: "לההיה",
    });
    expect(
      witnessedNames(
        [nameRead(34, "agree")],
        new Map([[34, corroborated("לההיה")]]),
        [existing],
      ),
    ).toEqual([]);
  });

  it("stops on a witnessed name the edition does not give", () => {
    expect(() =>
      witnessedNames([nameRead(24, "agree")], new Map(), []),
    ).toThrow(/24 name\.he: the edition gives no name/);
  });

  it("makes no note for any other field, which still has to match one", () => {
    const days = reading({ no: 19 });
    expect(witnessedNames([days], new Map(), [])).toEqual([]);
    expect(() => withWitnesses([note()], [reading(), days], [])).toThrow(
      /match no note: 19\|presidingDays/,
    );
  });
});

describe("names no reading settled", () => {
  it("print and use nothing, so no renderer says “kept as printed”", () => {
    const note = unsettledName(9, "Two readings of the scan differed.");
    expect(note.printed).toBe("");
    expect(note.used).toBe("");
    expect(note.why).toMatch(/No name is given/);
  });

  it("never read “kept as printed” in the committed apparatus", () => {
    const notes = JSON5.parse(
      readFileSync(
        "packages/magick-data/src/kabbalah/lenain/apparatus.json5",
        "utf8",
      ),
    ) as Note[];
    const keptYetUnnamed = notes.filter(
      (each) => each.printed && !each.used && /No name is given/.test(each.why),
    );
    expect(keptYetUnnamed).toEqual([]);
  });
});

describe("names kept as printed", () => {
  const name = (printed: string, used: string) =>
    note({ no: 24, kind: "reading", field: "name.he", printed, used });

  it("empties `used` where the name is the printed one", () => {
    expect(keptAsPrinted([name("ההויה", "ההויה")])[0].used).toBe("");
  });

  it("keeps a name that differs from what is printed, marks included", () => {
    expect(keptAsPrinted([name("ראחאל", "ראהאל")])[0].used).toBe("ראהאל");
    expect(keptAsPrinted([name("לּׄההיׄה", "לההיה")])[0].used).toBe("לההיה");
  });

  it("leaves every other field alone, an absent hour included", () => {
    const same = note({ printed: "1/1", used: "1/1" });
    const absent = note({ field: "invocation", printed: "", used: "2:20" });
    expect(keptAsPrinted([same, absent])).toEqual([same, absent]);
  });

  it("is what the committed apparatus does, the 57th included", () => {
    const notes = JSON5.parse(
      readFileSync(
        "packages/magick-data/src/kabbalah/lenain/apparatus.json5",
        "utf8",
      ),
    ) as Note[];
    const names = notes.filter((each) => each.field === "name.he");
    expect(
      names.filter((each) => each.used && each.used === each.printed),
    ).toEqual([]);
    expect(names.find((each) => each.no === 57)?.used).toBe("");
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
