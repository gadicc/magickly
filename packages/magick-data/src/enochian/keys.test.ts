import { describe, expect, it } from "vitest";
import keys, {
  AETHYR_ORDINALS,
  type Aethyr,
  aethyrCall,
  aethyrs,
  checkedText,
  DEFAULT_KEY_VERSION,
  type EnochianKey,
  hasGdReadings,
  hasVersion,
  KEY_VERSIONS,
  type KeyRow,
  keyByNumber,
  keySourceText,
  keyTitle,
  keyVersion,
  keyWork,
} from "./Keys.ts";
import tabletNotes from "./TabletNotes.ts";

/** A row carried over from the 2023 text rather than re-derived. */
const isLegacy = (row: KeyRow) =>
  row.readings.legacy2023 !== undefined &&
  row.readings.casaubon1659 === undefined;

/** Every source a Key or its rows cite. */
const sourcesOf = (key: EnochianKey) => [
  ...key.sources,
  ...key.rows.flatMap((row) => row.sources ?? []),
];

describe("the Keys' data", () => {
  it("has Keys in order, each once, from 1 to 19", () => {
    const numbers = keys.map((key) => key.key);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(numbers.length);
    for (const n of numbers) expect(n >= 1 && n <= 19, String(n)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
  });

  it("gives every row a Casaubon reading and English, unless carried over", () => {
    for (const key of keys)
      key.rows.forEach((row, index) => {
        const where = `Key ${key.key}.${index + 1}`;
        const empty = Object.keys(row.readings).length === 0;
        if (isLegacy(row) || (empty && !row.unspoken)) {
          // The 2023 text, until the Key is re-derived: every row says
          // something, and the Key says it was not checked.
          expect(
            row.english || row.readings.legacy2023?.word,
            where,
          ).toBeTruthy();
          expect(key.checked.covered, where).toEqual([]);
          return;
        }
        // Casaubon may print no English against a word (Key 2's OM), and
        // the note then says so.
        if (!row.english.trim()) expect(row.note, where).toMatch(/no English/);
        if (row.notInCasaubon) {
          // Casaubon's print lost it: Crowley's form stands in, and the
          // note says so.
          expect(row.readings.casaubon1659, where).toBeUndefined();
          expect(row.readings.equinox1912no8?.word?.trim(), where).toBeTruthy();
          expect(row.note?.trim(), where).toBeTruthy();
          return;
        }
        if (row.unspoken) {
          // No source prints it; the note says why.
          expect(row.readings.casaubon1659?.word ?? "", where).toBe("");
          expect(row.note, where).toMatch(/not printed|unprinted/);
          return;
        }
        expect(row.readings.casaubon1659?.word, where).toMatch(/^[A-Z]+$/);
      });
  });

  it("covers every row in the Golden Dawn's reading where a Key has one", () => {
    for (const key of keys) {
      if (!hasVersion(key, "gd")) continue;
      key.rows.forEach((row, index) => {
        const gd = row.readings.equinox1912no8;
        const where = `Key ${key.key}.${index + 1}`;
        expect(gd, where).toBeDefined();
        // A form, or a marker saying why there is none.
        if (!gd?.marker || gd.marker === "split")
          expect(gd?.word?.trim(), where).toBeTruthy();
      });
      // A join or an overlap belongs to a form on an earlier row.
      expect(["joined", "overlap"], `Key ${key.key}`).not.toContain(
        key.rows[0].readings.equinox1912no8?.marker,
      );
    }
  });

  it("cites only works it knows, with a place where it has a scan", () => {
    const known = new Set([...Object.keys(tabletNotes.works), "legacy2023"]);
    for (const key of keys) {
      for (const source of sourcesOf(key)) {
        expect(known.has(source.work), `Key ${key.key}: ${source.work}`).toBe(
          true,
        );
        if (source.leaf) expect(keyWork(source.work).archive).toBeDefined();
      }
      for (const work of key.checked.works) expect(known.has(work)).toBe(true);
      expect(key.sources.length, `Key ${key.key}`).toBeGreaterThan(0);
    }
    for (const aethyr of aethyrs)
      for (const source of aethyr.sources)
        expect(known.has(source.work), `Aethyr ${aethyr.n}`).toBe(true);
  });

  it("says where a corrected word comes from", () => {
    for (const key of keys)
      key.rows.forEach((row, index) => {
        if (row.was === undefined) return;
        // A change from the 2023 text names its source and page.
        expect(row.note, `Key ${key.key}.${index + 1}`).toMatch(
          /(Casaubon|Crowley|Equinox|Dee|Sloane)[^]*\bpp?\.\s?\d+/,
        );
      });
  });

  it("says what each Key was checked against, from its own record", () => {
    for (const key of keys) {
      const { checked } = key;
      if (checked.date) expect(checked.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (checked.covered.length) {
        expect(checked.works).toContain("casaubon1659");
        expect(checked.date).toBeDefined();
      } else expect(checked.notCovered.length).toBeGreaterThan(0);
      if (hasVersion(key, "gd") && checked.covered.length)
        expect(checked.covered).toContain("gd");
    }
  });

  it("has Key 19's slots for all thirty Aethyrs in both versions, when it has Key 19", () => {
    const key = keyByNumber(19);
    if (!key) {
      expect(aethyrs).toEqual([]);
      expect(aethyrCall(1)).toBeUndefined();
      return;
    }
    expect(aethyrs.map((aethyr) => aethyr.n)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
    expect(key.rows.filter((row) => row.slot === "aethyr")).toHaveLength(1);
    for (const version of KEY_VERSIONS) {
      if (!hasVersion(key, version)) continue;
      for (const aethyr of aethyrs) {
        const call = aethyrCall(aethyr.n, version);
        const slot = call?.find((word) => word.slot === "aethyr");
        expect(slot?.word, `${version} ${aethyr.n}`).toBeTruthy();
        expect(slot?.lookup, `${version} ${aethyr.n}`).toBeTruthy();
        for (const word of call ?? []) expect(word.english).not.toMatch(/[{}]/);
        expect(
          call?.some((word) =>
            word.english.includes(AETHYR_ORDINALS[aethyr.n - 1]),
          ),
        ).toBe(true);
      }
    }
  });
});

/** A small Key for the rules, with every kind of row. */
const KEY: EnochianKey = {
  key: 4,
  sources: [{ work: "casaubon1659", page: 109, leaf: 198 }],
  checked: { works: [], covered: [], notCovered: ["x"] },
  rows: [
    {
      english: "which is",
      readings: {
        casaubon1659: { word: "DSI" },
        equinox1912no8: { word: "das iod" },
      },
      gdNote: "the I printed with OD",
    },
    {
      english: "and",
      readings: {
        casaubon1659: { word: "OD" },
        equinox1912no8: { marker: "overlap" },
      },
      note: "two words, glossed together",
    },
    {
      english: "as the first",
      readings: {
        casaubon1659: { word: "TALO" },
        equinox1912no8: { word: "ta el-o", marker: "split" },
      },
    },
    {
      english: "And",
      readings: {
        casaubon1659: { word: "OD" },
        equinox1912no8: { marker: "absent" },
      },
      uncertain: true,
    },
    {
      english: "shew",
      readings: {
        casaubon1659: { word: "ZAMRAN" },
        sloane3191: { word: "ZAMRAN" },
        equinox1912no8: { word: "Zodameranu" },
      },
    },
    {
      english: "joined",
      readings: {
        casaubon1659: { word: "NAZPSAD" },
        equinox1912no8: { marker: "joined" },
      },
    },
  ],
};

describe("the versions", () => {
  it("are Dee's, the default, and the Golden Dawn's", () => {
    expect(KEY_VERSIONS).toEqual(["dee", "gd"]);
    expect(DEFAULT_KEY_VERSION).toBe("dee");
  });

  it("give Dee's words and English in Dee's version", () => {
    const words = keyVersion(KEY) ?? [];
    expect(words.map((word) => word.word)).toEqual([
      "DSI",
      "OD",
      "TALO",
      "OD",
      "ZAMRAN",
      "NAZPSAD",
    ]);
    expect(words.map((word) => word.row)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(words[1].note).toBe("two words, glossed together");
    expect(words[0].note).toBeUndefined();
    expect(words[3].uncertain).toBe(true);
    expect(words.some((word) => word.marker)).toBe(false);
  });

  it("give the Golden Dawn's forms, with markers, and still look up Dee's", () => {
    const words = keyVersion(KEY, "gd") ?? [];
    expect(words.map((word) => [word.word, word.marker])).toEqual([
      ["das iod", undefined],
      [null, "overlap"],
      ["ta el-o", "split"],
      [null, "absent"],
      ["Zodameranu", undefined],
      [null, "joined"],
    ]);
    expect(words.map((word) => word.lookup)).toEqual(
      (keyVersion(KEY) ?? []).map((word) => word.word),
    );
    expect(words.map((word) => word.english)).toEqual(
      KEY.rows.map((row) => row.english),
    );
    expect(words[0].note).toBe("the I printed with OD");
    expect(words[1].note).toBe("two words, glossed together");
  });

  it("are undefined for a version a Key lacks, or no version at all", () => {
    const deeOnly: EnochianKey = {
      ...KEY,
      rows: [{ english: "I", readings: { casaubon1659: { word: "OL" } } }],
    };
    expect(hasVersion(deeOnly, "gd")).toBe(false);
    expect(keyVersion(deeOnly, "gd")).toBeUndefined();
    expect(keyVersion(KEY, "regardie")).toBeUndefined();
    expect(hasVersion(KEY, "gd")).toBe(true);
    expect(hasGdReadings([deeOnly])).toBe(false);
    expect(hasGdReadings([KEY])).toBe(true);
  });

  it("fall back to Crowley's form in Dee's for a word Casaubon's print lost", () => {
    const lost: EnochianKey = {
      ...KEY,
      rows: [
        {
          english: "the second",
          readings: { equinox1912no8: { word: "vi-vau di-vau" } },
          notInCasaubon: true,
          note: "lost in Casaubon's print",
        },
        { english: "and", readings: { casaubon1659: { word: "OD" } } },
        {
          english: "the beginning",
          readings: { equinox1912no8: { word: "bial'" } },
          notInCasaubon: true,
          note: "lost in Casaubon's print",
        },
        {
          english: "wise",
          readings: { equinox1912no8: { word: "monasaçi" } },
          notInCasaubon: true,
          note: "lost in Casaubon's print",
        },
      ],
    };
    expect(
      keyVersion(lost)?.map((word) => [word.word, word.lookup, word.from]),
    ).toEqual([
      ["vi-vau di-vau", "VIVAUDIVAU", "equinox1912no8"],
      ["OD", "OD", undefined],
      // Letters only: no apostrophe, no accent.
      ["bial'", "BIAL", "equinox1912no8"],
      ["monasaçi", "MONASACI", "equinox1912no8"],
    ]);
    // In the Golden Dawn's the form is its own, and says nothing of `from`.
    expect(hasVersion(lost, "gd")).toBe(false);
    const both: EnochianKey = {
      ...lost,
      rows: [
        lost.rows[0],
        {
          english: "and",
          readings: {
            casaubon1659: { word: "OD" },
            equinox1912no8: { word: "od" },
          },
        },
      ],
    };
    expect(
      keyVersion(both, "gd")?.map((word) => [word.word, word.from]),
    ).toEqual([
      ["vi-vau di-vau", undefined],
      ["od", undefined],
    ]);
  });

  it("read a row of the 2023 text, or none, as Dee's", () => {
    const legacy: EnochianKey = {
      ...KEY,
      rows: [
        { english: "I", readings: { legacy2023: { word: "OL" } } },
        { english: "and", readings: {} },
      ],
    };
    expect(keyVersion(legacy)?.map((word) => [word.word, word.lookup])).toEqual(
      [
        ["OL", "OL"],
        [null, null],
      ],
    );
  });
});

/** Key 19 in small: the name's slot, IDOIGO's, and the ordinal. */
const CALL: EnochianKey = {
  key: 19,
  sources: [{ work: "casaubon1659", page: 201 }],
  checked: { works: [], covered: [], notCovered: ["x"] },
  rows: [
    {
      english: "which dwell",
      readings: {
        casaubon1659: { word: "PRAF" },
        equinox1912no8: { word: "PRAF" },
      },
    },
    {
      english: "in the {ordinal} aire",
      readings: {
        casaubon1659: { word: "LIL" },
        equinox1912no8: { word: "LIL" },
      },
      slot: "aethyr",
    },
    {
      english: "the second",
      readings: {
        casaubon1659: { word: "IDOIGO" },
        equinox1912no8: { word: "Idoigo" },
      },
      slot: "idoigo",
    },
  ],
};

const AETHYRS: Aethyr[] = [
  {
    n: 1,
    readings: { casaubon1659: "Lil", equinox1912no8: "LIL" },
    sources: [{ work: "casaubon1659", page: 209, leaf: 298 }],
  },
  {
    n: 20,
    readings: {
      casaubon1659: "Chr",
      equinox1912no8: "KHR",
      equinox1911no5: "KHR",
    },
    sources: [{ work: "equinox1912no8", page: 125 }],
  },
  {
    n: 30,
    readings: { equinox1912no8: "TEX" },
    sources: [{ work: "equinox1912no8", page: 125 }],
  },
];

describe("the Call of the Aethyrs", () => {
  const call = (n: number, version: string) =>
    (keyVersion(CALL, version, n, AETHYRS) ?? []).map((word) => [
      word.word,
      word.lookup,
      word.english,
      word.from,
    ]);

  it("is the first Aethyr's by default, Dee's word for LIL", () => {
    expect(call(1, "dee")).toEqual([
      ["PRAF", "PRAF", "which dwell", undefined],
      ["LIL", "LIL", "in the first aire", undefined],
      ["IDOIGO", "IDOIGO", "the second", undefined],
    ]);
    expect(keyVersion(CALL, "dee", undefined, AETHYRS)?.[1].word).toBe("LIL");
  });

  it("takes another Aethyr's name, Dee's from Casaubon's list in capitals", () => {
    expect(call(20, "dee")[1]).toEqual([
      "CHR",
      "CHR",
      "in the twentieth aire",
      undefined,
    ]);
    // Crowley's, said so, where no work gives Dee's.
    expect(call(30, "dee")[1]).toEqual([
      "TEX",
      "TEX",
      "in the thirtieth aire",
      "equinox1912no8",
    ]);
  });

  it("takes the Equinox's name in the Golden Dawn's", () => {
    expect(call(20, "gd")[1]).toEqual([
      "KHR",
      "CHR",
      "in the twentieth aire",
      undefined,
    ]);
  });

  it("leaves IDOIGO as it is in both versions, its slot marked", () => {
    // Crowley says it may be varied, and names no word to vary it to.
    expect(call(20, "dee")[2]).toEqual([
      "IDOIGO",
      "IDOIGO",
      "the second",
      undefined,
    ]);
    expect(call(20, "gd")[2]).toEqual([
      "Idoigo",
      "IDOIGO",
      "the second",
      undefined,
    ]);
    expect(keyVersion(CALL, "gd", 20, AETHYRS)?.[2].slot).toBe("idoigo");
  });

  it("keeps a hidden Golden Dawn slot hidden, and drops a split it no longer has", () => {
    const marked = (marker: "joined" | "absent" | "split", word?: string) =>
      keyVersion(
        {
          ...CALL,
          rows: [
            {
              ...CALL.rows[1],
              readings: {
                casaubon1659: { word: "LIL" },
                equinox1912no8: { word, marker },
              },
            },
          ],
        },
        "gd",
        20,
        AETHYRS,
      )?.[0];
    for (const marker of ["joined", "absent"] as const)
      expect(marked(marker)).toMatchObject({
        word: null,
        marker,
        lookup: "CHR",
      });
    const split = marked("split", "li l");
    expect(split).toMatchObject({ word: "KHR", lookup: "CHR" });
    expect(split?.marker).toBeUndefined();
  });

  it("takes the name from the table where Dee's row is Crowley's form", () => {
    const lost: EnochianKey = {
      ...CALL,
      rows: [
        {
          english: "in the {ordinal} aire",
          readings: { equinox1912no8: { word: "LIL" } },
          notInCasaubon: true,
          slot: "aethyr",
        },
      ],
    };
    // Aethyr 1 has Dee's spelling in Casaubon's list, so `from` goes.
    const first = keyVersion(lost, "dee", 1, AETHYRS)?.[0];
    expect(first).toMatchObject({ word: "LIL", lookup: "LIL" });
    expect(first?.from).toBeUndefined();
    expect(keyVersion(lost, "dee", 30, AETHYRS)?.[0].from).toBe(
      "equinox1912no8",
    );
  });

  it("leaves the slots alone for an Aethyr not in the table", () => {
    expect(call(5, "dee")[1]).toEqual([
      "LIL",
      "LIL",
      "in the fifth aire",
      undefined,
    ]);
  });

  it("has thirty ordinals", () => {
    expect(AETHYR_ORDINALS).toHaveLength(30);
    expect(AETHYR_ORDINALS[20]).toBe("twenty-first");
    expect(AETHYR_ORDINALS[29]).toBe("thirtieth");
  });

  it("is undefined for an Aethyr there is not", () => {
    expect(aethyrCall(31)).toBeUndefined();
  });
});

describe("the text around the Keys", () => {
  it("titles Key 19 by what it is", () => {
    expect(keyTitle(KEY)).toBe("Key 4");
    expect(keyTitle(CALL)).toBe("Key 19: the Call of the Thirty Aethyrs");
  });

  it("says what was checked, from the record", () => {
    expect(
      checkedText({
        date: "2026-11-10",
        works: ["casaubon1659", "equinox1912no8"],
        covered: ["enochian", "english", "gd"],
        notCovered: ["Sloane MS 3191", "a second reading"],
      }),
    ).toBe(
      "Checked on 10 November 2026 against Casaubon's print of Dee's journal (1659) and The Equinox I(8) (1912): the Enochian, the English and the Golden Dawn's reading. Not checked: Sloane MS 3191 and a second reading.",
    );
    expect(
      checkedText({ works: [], covered: [], notCovered: ["not re-derived"] }),
    ).toBe("Not yet checked. Not checked: not re-derived.");
    expect(
      checkedText({
        works: ["casaubon1659"],
        covered: ["english"],
        notCovered: [],
      }),
    ).toBe(
      "Checked against Casaubon's print of Dee's journal (1659): the English.",
    );
  });

  it("cites a source by the registry's title, page and leaf", () => {
    expect(
      keySourceText({ work: "casaubon1659", page: 109, leaf: 198 }),
    ).toMatch(/^Meric Casaubon .*, p\.109 \(archive\.org leaf n198\)$/);
    expect(keySourceText({ work: "legacy2023" })).toBe(
      "The 2023 text of the Keys, whose source is not known",
    );
    expect(keyWork("equinox1912no8").archive?.file).toBe(
      "The Equinox Vol. 1, No. 8",
    );
  });
});
