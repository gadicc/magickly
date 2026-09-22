import { describe, expect, it } from "vitest";
import dictionary from "@/../data/enochian/Dictionary";
import {
  entriesFor,
  findWord,
  KEY_ENTRIES,
  keyWords,
  spellings,
} from "./keyEntries";

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
      URBS: source.VRBS,
    });
  });

  it("covers every word of the nineteen Keys", () => {
    const words = keyWords();
    expect(words).toHaveLength(181);
    expect(words).toContain("OL");
    const missing = words.filter((word) => !(word in KEY_ENTRIES));
    expect(missing).toEqual([]);
    expect(Object.keys(KEY_ENTRIES)).toHaveLength(181);
    // The whole dictionary is 1,911 words; the page ships these.
    expect(Object.keys(dictionary).length).toBe(1911);
    expect(KEY_ENTRIES.URBS).toBe(dictionary.VRBS);
  });
});
