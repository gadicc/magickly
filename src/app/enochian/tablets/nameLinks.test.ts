import dictionary from "magick-data/enochian/dictionary";
import {
  tabletNameSpellings,
  tabletNames,
} from "magick-data/enochian/tabletNames";
import tablets, {
  TABLET_VERSIONS,
  tabletVersion,
  WATCHTOWER_IDS,
} from "magick-data/enochian/tablets";
import { describe, expect, it, vi } from "vitest";
import { dictionaryHref, linkedHeadword } from "./dictionaryLinks";
import { nameHeadword, TABLET_NAME_LINKS, tabletNameLinks } from "./nameLinks";

// Imported on the server only; the tests read it directly.
vi.mock("server-only", () => ({}));

const fold = (word: string) => word.toLowerCase().replaceAll("v", "u");

describe("the tablets' names' dictionary links", () => {
  it("links every name of every Watchtower, in every version, to a headword", () => {
    // Every name read off a Watchtower's own letters has a headword with
    // every version's reading tried (magick-data's tabletNames test pins
    // it: 152 for each version).
    for (const tablet of WATCHTOWER_IDS)
      for (const version of TABLET_VERSIONS) {
        const view = tabletVersion(tablets[tablet], version);
        for (const { id, unionLetter } of view ? tabletNames(view) : []) {
          if (unionLetter) continue;
          const key = linkedHeadword(TABLET_NAME_LINKS, tablet, version, id);
          expect(key, `${tablet} ${version} ${id}`).toBeDefined();
          expect(Object.hasOwn(dictionary, key as string)).toBe(true);
        }
      }
  });

  it("links the Union's lines and the Kerubic archangels, not the servient ones", () => {
    // Plan 090, stage 4: the names with a letter of the Union, and the
    // Union's own, in the Golden Dawn's versions.
    const unlinked: string[] = [];
    for (const tablet of [...WATCHTOWER_IDS, "union"] as const)
      for (const version of TABLET_VERSIONS) {
        const view = tabletVersion(tablets[tablet], version);
        for (const name of view ? tabletNames(view) : []) {
          if (!name.unionLetter && tablet !== "union") continue;
          const key = linkedHeadword(
            TABLET_NAME_LINKS,
            tablet,
            version,
            name.id,
          );
          if (key) expect(Object.hasOwn(dictionary, key)).toBe(true);
          else if (name.kind !== "servientArchangel")
            unlinked.push(`${tablet} ${version} ${name.spelling}`);
          // The dictionary has no servient row with its Union letter.
          if (name.kind === "servientArchangel") expect(key).toBeUndefined();
        }
      }
    // Earth's two lower archangels, as the Equinox's letters read them,
    // and the Union's column, have no headword. The Golden Dawn's and
    // Regardie's reach the dictionary's NOCNC and NASMT by a second letter.
    expect(unlinked).toEqual([
      "earth equinox NROnc",
      "earth equinox Niaom",
      "union gd EHNB",
      "union regardie EHNB",
      "union equinox EHNB",
    ]);
    const links = tabletNameLinks();
    expect(links.union?.["union-row-3"]).toBe("NANTA");
    expect(links.earth?.["top-left-kerubic-archangel"]).toBe("NBOZA");
    expect(
      linkedHeadword(links, "earth", "gd", "bottom-left-kerubic-archangel"),
    ).toBe("NOCNC");
    expect(
      linkedHeadword(links, "earth", "dee", "bottom-left-kerubic-archangel"),
    ).toBeUndefined();
  });

  it("tries the version's own spelling first", () => {
    for (const tablet of WATCHTOWER_IDS)
      for (const version of TABLET_VERSIONS) {
        const view = tabletVersion(tablets[tablet], version);
        for (const name of view ? tabletNames(view) : []) {
          const own = (name.spellings ?? [name.spelling]).find((spelling) =>
            Object.keys(dictionary).some((key) => fold(key) === fold(spelling)),
          );
          if (!own) continue;
          const key = linkedHeadword(
            TABLET_NAME_LINKS,
            tablet,
            version,
            name.id,
          );
          expect(fold(key as string).replaceAll("-", "")).toBe(fold(own));
        }
      }
    expect(
      linkedHeadword(TABLET_NAME_LINKS, "earth", "gd", "senior-row-left"),
    ).toBe("LAIDROM");
  });

  it("falls back to a single second letter where no version's spelling is a headword", () => {
    // A square's second letter that no version reads there: its spelling
    // with that letter is found only by the last step.
    let tried = 0;
    for (const tablet of WATCHTOWER_IDS) {
      const view = tabletVersion(tablets[tablet], "gd");
      if (!view) continue;
      for (const name of tabletNames(view)) {
        const readings = tabletNameSpellings(
          tablets[tablet],
          name.id,
          "gd",
        ).map(fold);
        name.squares.forEach(({ row, column }, index) => {
          const mark = view.marks.find(
            (each) => each.row === row && each.column === column,
          );
          for (const letter of mark?.alt ?? []) {
            const read =
              name.spelling.slice(0, index) +
              letter +
              name.spelling.slice(index + 1);
            if (readings.includes(fold(read)) || tried > 3) continue;
            tried++;
            const only = { [read.toUpperCase()]: {} };
            expect(nameHeadword(tablet, "gd", name.id, only)).toBe(
              read.toUpperCase(),
            );
          }
        });
      }
    }
    expect(tried).toBeGreaterThan(0);
  });

  it("finds a headword that differs in case and u or v alone, but not a gap", () => {
    expect(nameHeadword("earth", "gd", "holy-1", { mor: {} })).toBe("mor");
    expect(nameHeadword("earth", "gd", "holy-1", { "M-OR": {} })).toBe("M-OR");
    expect(
      nameHeadword("earth", "gd", "holy-1", { "MOR-": {} }),
    ).toBeUndefined();
    // Dee's Fire has two empty squares; a name through one reads "?".
    const deeFire = tabletVersion(tablets.fire, "dee");
    const gap =
      deeFire &&
      tabletNames(deeFire).find((name) => name.spelling.includes("?"));
    expect(gap).toBeDefined();
    expect(
      nameHeadword("fire", "dee", gap!.id, {
        [gap!.spelling.toUpperCase()]: {},
      }),
    ).toBeUndefined();
  });

  it("keeps the map small, one key where the versions agree", () => {
    const links = tabletNameLinks();
    expect(JSON.stringify(links).length).toBeLessThan(8_000);
    expect(links.earth?.["holy-1"]).toBe("MOR");
    // Raphael's King is seven letters, the Golden Dawn's eight.
    expect(links.earth?.king).toEqual({
      gd: "ICZHIHAL",
      regardie: "ICZHIHAL",
      equinox: "ICZHIHAL",
      dee: "ICZHIHAL",
      raphael: "ICZHIHA",
    });
    expect(linkedHeadword(links, "earth", "raphael", "king")).toBe("ICZHIHA");
    expect(linkedHeadword(undefined, "earth", "gd", "king")).toBeUndefined();
    expect(linkedHeadword(links, "union", "gd", "king")).toBeUndefined();
  });

  it("links relatively, so the page can be prerendered", () => {
    expect(dictionaryHref("LAIDROM")).toBe("/enochian/dictionary?w=LAIDROM");
    expect(dictionaryHref("G-RSAM")).toBe("/enochian/dictionary?w=G-RSAM");
  });
});
