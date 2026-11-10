import dictionary from "magick-data/enochian/dictionary";
import keys, { keyVersion } from "magick-data/enochian/keys";
import { describe, expect, it } from "vitest";
import {
  entriesFor,
  findParts,
  findWord,
  KEY_ENTRIES,
  keyWords,
  spellings,
} from "./keyEntries";

/**
 * Dee's words the dictionary does not have, even as two entries, each
 * with the reason. Adding words to the dictionary is its own work (plan
 * 073, decision 9): its sources are copyrighted.
 */
const NOT_IN_THE_DICTIONARY: Record<string, string> = {
  ZOMDV: "Casaubon's V after E.K.'s doubtful X; the dictionary has ZOMD",
  PIAMOL:
    'Key 1\'s "of righteousnesse", spelled out letter by letter; not in the dictionary',
  VIIV: "Casaubon's spelling; the dictionary has VIV",
  IALPURG: "Casaubon's spelling; the dictionary has IALPRG",
  TAPVIN: "one word in Casaubon, two (TA, PUIM) in the dictionary",
};

describe("the Keys' dictionary entries", () => {
  it("spells a word with U and V both ways, itself first", () => {
    expect(spellings("URBS")).toEqual(["URBS", "VRBS"]);
    expect(spellings("GIUI")).toEqual(["GIUI", "GIVI"]);
    expect(spellings("VAV")).toEqual(["VAV", "UAU"]);
    expect(spellings("OL")).toEqual(["OL"]);
  });

  it("finds a word under the spelling the dictionary files it by", () => {
    expect(findWord(dictionary, "OL")).toBe("OL");
    // U and V are one letter in the sources.
    expect(findWord(dictionary, "URBS")).toBe("VRBS");
    expect(findWord(dictionary, "GIUI")).toBe("GIVI");
    // A hyphen in a key is a reading aid, not part of the word.
    expect(findWord(dictionary, "GRSAM")).toBe("G-RSAM");
    // The three words step 1 added, found exactly.
    for (const word of ["IZAZAZ", "BIAB", "VOMZARG"])
      expect(findWord(dictionary, word), word).toBe(word);
    expect(findWord(dictionary, "NOSUCHWORD")).toBeUndefined();
  });

  it("finds CASARMA, which CASARM's meaning used to carry", () => {
    // `CASARM` is a different word, and its second meaning read
    // "whom, unto whomCASARMA whom" until the two were parted.
    expect(findWord(dictionary, "CASARMA")).toBe("CASARMA");
    expect(dictionary.CASARM.meanings[1].meaning).toBe("whom, unto whom");
    expect(dictionary.CASARMA.meanings.map((one) => one.meaning)).toEqual([
      "whom",
      "whome",
    ]);
  });

  it("prefers an exact key to a normalised one", () => {
    const source = {
      GIUI: { gematria: [], meanings: [], pronounciations: [] },
      GIVI: { gematria: [], meanings: [], pronounciations: [] },
      "G-RSAM": { gematria: [], meanings: [], pronounciations: [] },
      GRSAM: { gematria: [], meanings: [], pronounciations: [] },
    };
    expect(findWord(source, "GIUI")).toBe("GIUI");
    expect(findWord(source, "GRSAM")).toBe("GRSAM");
    // The first key that strips to it wins, which is the file's own order.
    expect(findWord({ "A-B": source.GIUI, "AB-": source.GIVI }, "AB")).toBe(
      "A-B",
    );
    // A trailing hyphen marks an affix (`MEL-`, `PINZU-`), never a word.
    expect(findWord({ "MEL-": source.GIUI }, "MEL")).toBeUndefined();
  });

  it("returns only the words asked for, keyed as they were asked for", () => {
    const source = {
      VRBS: { gematria: [1], meanings: [], pronounciations: [] },
      OTHER: { gematria: [2], meanings: [], pronounciations: [] },
    };
    expect(entriesFor(["URBS", "MISSING"], source)).toEqual({
      URBS: [{ key: "VRBS", entry: source.VRBS }],
    });
  });

  it("finds a word as two entries when it is not one", () => {
    const entry = { gematria: [], meanings: [], pronounciations: [] };
    const source = { NOR: entry, MOLAP: entry, NORMO: entry, LA: entry };
    expect(findParts(source, "NORMOLAP")).toEqual(["NOR", "MOLAP"]);
    // The longest first part that leaves a word.
    expect(findParts({ ...source, LAP: entry }, "NORMOLAP")).toEqual([
      "NORMO",
      "LAP",
    ]);
    // The whole word first, and U for V in each part.
    expect(findParts({ ...source, NORMOLAP: entry }, "NORMOLAP")).toEqual([
      "NORMOLAP",
    ]);
    expect(findParts({ NOR: entry, QVASAHI: entry }, "NORQUASAHI")).toEqual([
      "NOR",
      "QVASAHI",
    ]);
    // Never a part of one letter, nor three parts.
    expect(findParts({ DS: entry, I: entry }, "DSI")).toBeUndefined();
    expect(findParts({ AB: entry, CD: entry, EF: entry }, "ABCDEF")).toBe(
      undefined,
    );
    expect(entriesFor(["NORMOLAP"], source)).toEqual({
      NORMOLAP: [
        { key: "NOR", entry },
        { key: "MOLAP", entry },
      ],
    });
  });

  it("looks up Dee's words, every one but the listed", () => {
    const words = keyWords();
    expect(words).toContain("OL");
    const missing = words.filter((word) => !(word in KEY_ENTRIES));
    // A word missed here is either a reading to check or one for the list.
    expect(missing.sort()).toEqual(Object.keys(NOT_IN_THE_DICTIONARY).sort());
    expect(Object.keys(KEY_ENTRIES)).toHaveLength(
      words.length - missing.length,
    );
    // The whole dictionary is 1,911 words; the page ships these.
    expect(Object.keys(dictionary).length).toBe(1911);
  });

  it("takes the words from the Keys, by Dee's spelling, once each", () => {
    const words = keyWords();
    expect(new Set(words).size).toBe(words.length);
    // The first word Dee's version has, in the first Key.
    const dee = keyVersion(keys[0])?.find((word) => word.lookup)?.lookup;
    expect(dee).toBeTruthy();
    expect(words[0]).toBe(dee);
    // The Golden Dawn's forms are never looked up.
    expect(
      keyWords([
        {
          key: 1,
          sources: [],
          checked: { works: [], covered: [], notCovered: [] },
          rows: [
            {
              english: "I",
              readings: {
                casaubon1659: { word: "OL" },
                equinox1912no8: { word: "Ol" },
              },
            },
            { english: "and", readings: {} },
          ],
        },
      ]),
    ).toEqual(["OL"]);
  });

  it("looks up every Aethyr's name on Key 19", () => {
    const call = {
      key: 19,
      sources: [],
      checked: { works: [], covered: [], notCovered: [] },
      rows: [
        {
          english: "in the {ordinal} aire",
          readings: {
            casaubon1659: { word: "LIL" },
            equinox1912no8: { word: "LIL" },
          },
          slot: "aethyr" as const,
        },
        {
          english: "the second",
          readings: {
            casaubon1659: { word: "IDOIGO" },
            equinox1912no8: { word: "Idoigo" },
          },
          slot: "idoigo" as const,
        },
      ],
    };
    const table = ["LIL", "ARN"].map((name, index) => ({
      n: index + 1,
      readings: { equinox1912no8: name },
      sources: [],
    }));
    expect(keyWords([call], table)).toEqual(["LIL", "IDOIGO", "ARN"]);
    expect(keyWords([call], [])).toEqual(["LIL", "IDOIGO"]);
  });
});
