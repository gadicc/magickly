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
  keyByNumber,
  keySourceText,
  keyTitle,
  keyVersion,
  keyWork,
} from "./Keys.ts";
import tabletNotes from "./TabletNotes.ts";

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

  it("gives every row a Casaubon reading and English", () => {
    for (const key of keys)
      key.rows.forEach((row, index) => {
        const where = `Key ${key.key}.${index + 1}`;
        // Every row has some reading, or is a word given but not spoken.
        if (!row.unspoken)
          expect(Object.keys(row.readings).length, where).toBeGreaterThan(0);
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
    const known = new Set(Object.keys(tabletNotes.works));
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

  it("says where each correction of the earlier text comes from", () => {
    const corrections = keys.flatMap((key) =>
      key.rows.flatMap((row, index) =>
        /earlier text/.test(row.note ?? "")
          ? [{ where: `Key ${key.key}.${index + 1}`, note: row.note ?? "" }]
          : [],
      ),
    );
    // BOGPA, PIAMOL, Key 2's OM, Key 9's "hands" and Key 16's 8763 at least.
    expect(corrections.length).toBeGreaterThanOrEqual(5);
    for (const { where, note } of corrections)
      expect(note, where).toMatch(/\bpp?\.\s?\d+/);
    const words = (key: number) =>
      keyByNumber(key)?.rows.map((row) => row.readings.casaubon1659?.word);
    expect(words(1)).toContain("BOGPA");
    expect(words(1)).toContain("PIAMOL");
    expect(keyByNumber(9)?.rows.map((row) => row.english)).toContain(
      "their hands",
    );
    expect(keyByNumber(16)?.rows.map((row) => row.english)).toContain("8763");
  });

  it("puts its notes plainly, without the readers' working marks", () => {
    const notes = keys.flatMap((key) => [
      key.note ?? "",
      ...key.rows.flatMap((row) => [row.note ?? "", row.gdNote ?? ""]),
    ]);
    for (const note of notes)
      expect(note).not.toMatch(
        /DAMAGED|NOT IN CASAUBON|SLOT|SECOND READER|plan 073|spike|Keys\.ts|current data|the 2023 text|Use BRINTS/,
      );
    // Nor a placeholder in a field where a reading belongs.
    for (const key of keys)
      for (const row of key.rows) {
        const reading = row.readings.casaubon1659;
        expect(reading?.pronunciation ?? "").not.toMatch(/^\(/);
        expect(reading?.printed ?? "").not.toMatch(/^\(/);
      }
  });

  it("has all nineteen Keys, word by word as read", () => {
    expect(keys.map((key) => key.rows.length)).toEqual([
      88, 53, 84, 51, 55, 45, 52, 56, 74, 83, 45, 37, 38, 40, 32, 38, 37, 41,
      163,
    ]);
    const call = keyByNumber(19);
    expect(call?.rows.filter((row) => row.slot === "aethyr")).toHaveLength(1);
    expect(call?.rows.filter((row) => row.slot === "idoigo")).toHaveLength(1);
    expect(aethyrs).toHaveLength(30);
    for (const aethyr of aethyrs)
      expect(aethyr.readings.casaubon1659, `Aethyr ${aethyr.n}`).toBeTruthy();
    for (const key of keys)
      key.rows.forEach((row, index) => {
        const where = `Key ${key.key}.${index + 1}`;
        expect(row.sources?.length, where).toBeGreaterThan(0);
        if (row.uncertain) expect(row.note?.trim(), where).toBeTruthy();
      });
    // Casaubon numbers the Calls from Key 5; the first four have none.
    expect(keys.slice(0, 4).map((key) => key.casaubonCall)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("says which Keys stand on Crowley for words Casaubon's print lost", () => {
    const lost = keys.filter((key) =>
      key.rows.some((row) => row.notInCasaubon),
    );
    expect(lost.map((key) => key.key)).toEqual([13, 14, 15, 16]);
    for (const key of lost) {
      const count = key.rows.filter((row) => row.notInCasaubon).length;
      expect(checkedText(key.checked), `Key ${key.key}`).toContain(
        `Dee's Enochian for ${count} words Casaubon's print lost`,
      );
    }
    for (const key of keys)
      if (!lost.includes(key))
        expect(checkedText(key.checked)).not.toContain("print lost");
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

  it("read a row with no reading as no word in Dee's", () => {
    const none: EnochianKey = {
      ...KEY,
      rows: [{ english: "and", readings: {} }],
    };
    expect(keyVersion(none)?.map((word) => [word.word, word.lookup])).toEqual([
      [null, null],
    ]);
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
    expect(keySourceText({ work: "equinox1912no8" })).toMatch(
      /^The Equinox, vol\. I no\. 8 /,
    );
    expect(keyWork("equinox1912no8").archive?.file).toBe(
      "The Equinox Vol. 1, No. 8",
    );
  });
});
