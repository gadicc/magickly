import { describe, expect, it } from "vitest";
import elements from "../alchemy/Elements.ts";
import { DECANS } from "../astrology/decans.ts";
import planets from "../astrology/Planets.ts";
import zodiac, { type ZodiacId } from "../astrology/Zodiac.ts";
import godForms, { type GDGodFormId } from "../gd/GodForms.ts";
import hebrewLetters, { type HebrewLetterId } from "../HebrewLetters.ts";
import kerubim from "../kabbalah/Kerubim.ts";
import paths, { type PathId } from "../kabbalah/Paths.ts";
import sephirot, { type SephirahId } from "../kabbalah/Sephirot.ts";
import { minorCard } from "../tarot/minorCards.ts";
import {
  AIR_GREAT_CROSS_P287,
  ATTRIBUTIONS_P298,
  BADGE_V1,
  CHILDREN_P361,
  EARTH_OF_WATER_P290,
  GODS_P315,
  GREAT_CROSS_LETTERS_P283,
  KERUBIC_RANKS_P284,
  PLATES,
  type PlateSquare,
  UNION_CARDS_P290,
  UNION_COLUMNS_P290,
  WORKED_GODS,
  WORKED_SQUARES,
} from "./fixtures/pyramidReadings.ts";
import {
  findTabletName,
  TABLET_QUARTER_ID_PREFIXES,
  TABLET_QUARTERS,
  tabletNames,
} from "./TabletNames.ts";
import {
  pyramidExceptions,
  pyramidReading,
  pyramidRules,
} from "./TabletNotes.ts";
import {
  CALVARY_BARS,
  CALVARY_COLUMN,
  GEOMANTIC_FIGURES,
  KERUBIC_RANKS,
  NAME_LETTER_HEBREW,
  NAME_LETTERS,
  type NameLetter,
  TABLET_NAME_LETTERS,
  type TabletPyramid,
  tabletPyramid,
  tabletPyramids,
  tabletRegion,
  WATCHTOWER_REGIONS,
} from "./TabletPyramids.ts";
import tablets, {
  type EnochianTabletID,
  TABLET_VERSIONS,
  type TabletVersionId,
  tabletVersion,
  WATCHTOWER_IDS,
} from "./Tablets.ts";

/** A tablet in a version, which the test expects to exist. */
const view = (id: EnochianTabletID, version: TabletVersionId = "gd") => {
  const found = tabletVersion(tablets[id], version);
  if (!found) throw new Error(`no ${id} in ${version}`);
  return found;
};

/** A square's pyramid, which the test expects to exist. */
const pyramid = (
  id: EnochianTabletID,
  row: number,
  column: number,
  version: TabletVersionId = "gd",
) => {
  const found = tabletPyramid(view(id, version), { row, column });
  if (!found) throw new Error(`no pyramid at ${id} ${row},${column}`);
  return found;
};

/** The readers' planets, by the planet table's ids. */
const PLANET_WORDS: Readonly<Record<string, string>> = {
  sol: "sun",
  luna: "moon",
};
const planetWord = (id: string) => PLANET_WORDS[id] ?? id;

/** A Sephirah's number, as the plates print it. */
const number = (id: SephirahId) => sephirot[id].index;

/**
 * The symbol a plate draws on a side, by the readers' vocabulary: the
 * Great Cross's sign and planet, a Calvary square's Sephirah's number, and
 * otherwise the side's element.
 */
function plateSymbol(square: TabletPyramid, side: 0 | 1 | 2 | 3): string {
  const { elementId, attribution } = square.sides[side];
  if (square.region === "greatCross" && side === 0)
    return attribution.zodiacId ?? "?";
  if (square.region === "greatCross" && side === 2)
    return planetWord(attribution.planetId ?? "?");
  if (square.region === "calvaryCross" && side === 3)
    return `n${number(attribution.sephirahId as SephirahId)}`;
  return elementId ?? "?";
}

/** p.298's letters, as it spells them, by the Hebrew letters' ids. */
const P298_LETTERS: Readonly<Record<string, HebrewLetterId>> = {
  Aleph: "alef",
  Beth: "bet",
  Gimel: "gimel",
  Daleth: "dalet",
  Heh: "he",
  Vav: "vav",
  Zayin: "zayin",
  Cheth: "het",
  Teth: "tet",
  Yod: "yod",
  Kaph: "kaf",
  Lamed: "lamed",
  Mem: "mem",
  Nun: "nun",
  Samekh: "samekh",
  Ayin: "ayin",
  Peh: "pe",
  Tzaddi: "tsadi",
  Qoph: "qof",
  Resh: "resh",
  Shin: "shin",
  Tau: "tav",
};

/** p.298's Sephiroth, as it spells them. */
const P298_SEPHIROTH: Readonly<Record<string, SephirahId>> = {
  Kether: "keter",
  Chokmah: "chochmah",
  Binah: "binah",
  Chesed: "hesed",
  Geburah: "gevurah",
  Tiphareth: "tiferet",
};

/** p.298's geomantic figures, as it prints them. */
const P298_FIGURES: Readonly<Record<string, string>> = {
  "Fort. Min.": "fortuna_minor",
  "Fort. Maj.": "fortuna_major",
  "Cauda Dra": "cauda_draconis",
  Caput: "caput_draconis",
  Puer: "puer",
  Amissio: "amissio",
  Albus: "albus",
  Populus: "populus",
  Conjunctio: "conjunctio",
  Puella: "puella",
  Via: "via",
  Rubeus: "rubeus",
  Acquisitio: "acquisitio",
  Carcer: "carcer",
  Tristitia: "tristitia",
  Laetitia: "laetitia",
};

/** The paths' trump titles that p.298 words otherwise. */
const TRUMP_NAMES: Readonly<Record<string, string>> = {
  "Last Judgment": "Judgement",
};

/** The path of a letter, on the Hermetic tree. */
function pathOfLetter(letter: string): PathId | undefined {
  return (Object.keys(paths) as PathId[]).find(
    (id) => hermetic(id)?.hebrewLetterId === letter,
  );
}

/** A path's Hermetic attribution, which every path but the Hebrew tree's has. */
function hermetic(id: string) {
  return (
    paths[id as PathId] as
      | { hermetic?: { hebrewLetterId: string; tarotTitle: string } }
      | undefined
  )?.hermetic;
}

/** A path's trump, without its article. */
const trumpOf = (id: string | undefined) =>
  hermetic(id ?? "")?.tarotTitle.replace(/^The /, "");

const SIDES = [
  ["left", 0],
  ["top", 1],
  ["right", 2],
  ["bottom", 3],
] as const;

/** Where a version's pyramids differ from a plate, side by side. */
function plateDifferences(tablet: EnochianTabletID, version: TabletVersionId) {
  const found: string[] = [];
  for (const read of PLATES[tablet].squares) {
    const square = pyramid(tablet, read.row - 1, read.square - 1, version);
    for (const [place, side] of SIDES)
      if (plateSymbol(square, side) !== read[place as keyof PlateSquare])
        found.push(`${tablet} ${read.row - 1},${read.square - 1} ${place}`);
  }
  return found;
}

/**
 * The plates' printer's slips (plan 095, stage 0): two blank triangles on
 * Plate V and three Suns without their dot on Plates VI and VII, by row and
 * column from 0. A new difference fails the test.
 */
const PLATE_SLIPS = [
  "water 8,5 bottom",
  "water 8,6 bottom",
  "earth 2,5 right",
  "earth 11,5 right",
  "fire 5,5 right",
];

/** The bar's squares whose Sephirah the two layouts place differently. */
function barDifferences(tablet: EnochianTabletID) {
  const found: string[] = [];
  for (const [top, left] of [
    [0, 0],
    [0, 7],
    [7, 0],
    [7, 7],
  ])
    for (const offset of [0, 1, 3, 4])
      found.push(`${tablet} ${top + 1},${left + offset} bottom`);
  return found;
}

describe("the region rule", () => {
  it("puts every square of a Watchtower in one region", () => {
    const counts = new Map<string, number>();
    for (let row = 0; row < 13; row++)
      for (let column = 0; column < 12; column++) {
        const region = tabletRegion(row, column) ?? "outside";
        counts.set(region, (counts.get(region) ?? 0) + 1);
      }
    expect(Object.fromEntries(counts)).toEqual({
      greatCross: 36,
      calvaryCross: 40,
      kerubic: 16,
      servient: 64,
    });
    expect([...counts.keys()].sort()).toEqual([...WATCHTOWER_REGIONS].sort());
  });

  it("agrees with the names' paths", () => {
    // tabletNames reads the Calvary crosses, the top rows and the servient
    // rows along their squares; what no quarter's name reads is the Great
    // Cross.
    const kinds = new Map<string, string>();
    for (const name of tabletNames(view("air")))
      if (name.quarter)
        for (const { row, column } of name.squares) {
          const region =
            name.kind === "crossColumn" || name.kind === "crossRow"
              ? "calvaryCross"
              : name.kind === "topRow" || name.kind === "kerubicArchangel"
                ? "kerubic"
                : "servient";
          const key = `${row},${column}`;
          if (region === "calvaryCross" || !kinds.has(key))
            kinds.set(key, region);
        }
    for (let row = 0; row < 13; row++)
      for (let column = 0; column < 12; column++)
        expect(tabletRegion(row, column), `${row},${column}`).toBe(
          kinds.get(`${row},${column}`) ?? "greatCross",
        );
  });

  it("is every pyramid's region", () => {
    for (const id of WATCHTOWER_IDS)
      for (const square of tabletPyramids(view(id)))
        expect(square.region).toBe(tabletRegion(square.row, square.column));
    expect(
      tabletPyramids(view("union")).every(
        (square) => square.region === "union",
      ),
    ).toBe(true);
  });
});

describe("the versions", () => {
  it("give every square of every tablet in the Golden Dawn's three", () => {
    for (const version of ["gd", "regardie", "equinox"] as const) {
      for (const id of WATCHTOWER_IDS)
        expect(tabletPyramids(view(id, version))).toHaveLength(156);
      expect(tabletPyramids(view("union", version))).toHaveLength(20);
    }
  });

  it("give none in Dee's and Raphael's, which have no elements", () => {
    for (const version of ["dee", "raphael"] as const) {
      for (const id of WATCHTOWER_IDS) {
        expect(tabletPyramids(view(id, version))).toEqual([]);
        expect(tabletPyramid(view(id, version), { row: 0, column: 0 })).toBe(
          undefined,
        );
      }
      expect(CALVARY_BARS[version]).toBeNull();
    }
    expect(Object.keys(CALVARY_BARS).sort()).toEqual(
      [...TABLET_VERSIONS].sort(),
    );
  });

  it("give nothing outside a tablet, and the same frozen array twice", () => {
    expect(tabletPyramid(view("air"), { row: 13, column: 0 })).toBeUndefined();
    expect(tabletPyramid(view("union"), { row: 0, column: 5 })).toBeUndefined();
    const all = tabletPyramids(view("air"));
    expect(tabletPyramids(view("air"))).toBe(all);
    expect(Object.isFrozen(all)).toBe(true);
    expect(Object.isFrozen(all[0].sides[0].attribution)).toBe(true);
  });

  it("differ only in the Calvary bar", () => {
    for (const id of WATCHTOWER_IDS) {
      const gd = tabletPyramids(view(id, "gd"));
      const regardie = tabletPyramids(view(id, "regardie"));
      const equinox = tabletPyramids(view(id, "equinox"));
      expect(regardie).toEqual(
        gd.map((square, index) => ({
          ...square,
          // The angels are read off each version's own letters.
          ...("angel" in square ? { angel: regardie[index].angel } : {}),
          ...("greatAngel" in square
            ? { greatAngel: regardie[index].greatAngel }
            : {}),
        })),
      );
      const differ = gd
        .filter(
          (square, index) =>
            JSON.stringify(square.sides) !==
            JSON.stringify(equinox[index].sides),
        )
        .map((square) => `${id} ${square.row},${square.column} bottom`);
      expect(differ.sort()).toEqual(barDifferences(id).sort());
    }
  });
});

describe("the Equinox's plates (Plates IV to VIII)", () => {
  it("are every square of each tablet, read once", () => {
    for (const id of [...WATCHTOWER_IDS, "union"] as const) {
      const keys = PLATES[id].squares.map((s) => `${s.row},${s.square}`);
      expect(new Set(keys).size, id).toBe(id === "union" ? 20 : 156);
    }
  });

  it("match the Equinox's version on every side but the printer's slips", () => {
    const found = [...WATCHTOWER_IDS, "union" as const].flatMap((id) =>
      plateDifferences(id, "equinox"),
    );
    expect(found.sort()).toEqual([...PLATE_SLIPS].sort());
    // 2,576 sides: 624 squares of the Watchtowers and 20 of the Union.
    const sides =
      4 *
      [...WATCHTOWER_IDS, "union" as const].reduce(
        (sum, id) => sum + PLATES[id].squares.length,
        0,
      );
    expect(sides).toBe(2576);
  });

  it("match the Golden Dawn's but for the slips and the bar", () => {
    const found = [...WATCHTOWER_IDS, "union" as const].flatMap((id) =>
      plateDifferences(id, "gd"),
    );
    expect(found.sort()).toEqual(
      [...PLATE_SLIPS, ...WATCHTOWER_IDS.flatMap(barDifferences)].sort(),
    );
    expect(found).toHaveLength(69);
  });

  it("have their slips noted, where the rule has the Sun or Water", () => {
    const noted = pyramidExceptions()
      .filter((each) => each.witness === "equinox1912")
      .flatMap((each) =>
        each.squares.map(
          (square) =>
            `${square.tablet} ${square.row},${square.column} ${["left", "top", "right", "bottom"][each.side - 1]}`,
        ),
      );
    expect(noted.sort()).toEqual([...PLATE_SLIPS].sort());
    expect(
      pyramid("earth", 2, 5, "equinox").sides[2].attribution.planetId,
    ).toBe("sol");
    expect(pyramid("water", 8, 5, "equinox").sides[3].elementId).toBe("water");
  });
});

describe("vol. 4's diagrams and tables", () => {
  it("p.283: the Great Cross's letters on all four tablets", () => {
    for (const id of WATCHTOWER_IDS) {
      const { column, row } = GREAT_CROSS_LETTERS_P283[id];
      const block = (r: number, c: number) =>
        pyramid(id, r, c).letters.block as NameLetter;
      // Five levels down the column: rows 0-2, 3-5, the row's centre
      // blocks (row 6, columns 3-5 and 6-8), 7-9 and 10-12.
      const levels = [
        [block(0, 5), block(0, 6)],
        [block(3, 5), block(3, 6)],
        [block(6, 3), block(6, 6)],
        [block(7, 5), block(7, 6)],
        [block(10, 5), block(10, 6)],
      ];
      expect(levels, id).toEqual(column);
      expect(
        [0, 3, 6, 9].map((c) => block(6, c)),
        id,
      ).toEqual(row);
      expect(levels[0][0]).toBe(TABLET_NAME_LETTERS[id]);
    }
  });

  it("p.284: the sixteen Kerubic ranks, the outside square the quarter's", () => {
    const QUARTER_LETTERS = {
      topLeft: "vav",
      topRight: "he",
      bottomLeft: "heFinal",
      bottomRight: "yod",
    } as const;
    let checked = 0;
    for (const id of WATCHTOWER_IDS)
      for (const quarter of TABLET_QUARTERS) {
        const ranks = KERUBIC_RANKS[id][quarter];
        expect(ranks, `${id} ${quarter}`).toEqual(
          KERUBIC_RANKS_P284[id][quarter],
        );
        // The rule in words: the outside square has the quarter's letter,
        // and the Name runs inward from it, one way or the other.
        const inward = quarter.endsWith("Left") ? ranks : [...ranks].reverse();
        expect(inward[0]).toBe(QUARTER_LETTERS[quarter]);
        const steps = inward
          .slice(1)
          .map(
            (letter, i) =>
              (NAME_LETTERS.indexOf(letter) -
                NAME_LETTERS.indexOf(inward[i]) +
                4) %
              4,
          );
        expect(new Set(steps).size).toBe(1);
        expect([1, 3]).toContain(steps[0]);
        checked++;
      }
    expect(checked).toBe(16);
  });

  it("p.287: the Air tablet's Great Cross, 35 of 36 and the 3 of Swords", () => {
    const differ: string[] = [];
    for (const read of AIR_GREAT_CROSS_P287) {
      const { attribution } = pyramid("air", read.row, read.column).sides[0];
      const planet = pyramid("air", read.row, read.column).sides[2].attribution
        .planetId;
      expect(attribution.zodiacId, `${read.row},${read.column}`).toBe(
        read.sign,
      );
      if (read.card) {
        const [n, suit] = read.card.replace(".", "").split(" ");
        const card = minorCard(attribution.minorCardId ?? "");
        expect(card?.rank).toBe(Number(n));
        expect(card?.suit.slice(0, 2)).toBe(suit.toLowerCase().slice(0, 2));
      }
      if (planetWord(planet ?? "") !== read.planet)
        differ.push(`${read.row},${read.column}`);
    }
    expect(AIR_GREAT_CROSS_P287).toHaveLength(36);
    expect(AIR_GREAT_CROSS_P287.filter((read) => read.card)).toHaveLength(18);
    expect(differ).toEqual(["1,5"]);
    expect(
      pyramidExceptions("air").find((each) => each.id === "vol4ThreeOfSwords")
        ?.squares,
    ).toEqual([{ tablet: "air", row: 1, column: 5 }]);
  });

  it("p.290: the Earth angle of the Water tablet, 30 of 30", () => {
    // The one symbol a square shows: a Kerub's sign, a Calvary square's
    // planet or number, a servient square's sign or element (Saturn for
    // Earth).
    const shown = (square: TabletPyramid) => {
      const [one, , three, four] = square.sides.map((s) => s.attribution);
      if (square.region === "kerubic")
        return three.kerubId === "water"
          ? "other:eagle head"
          : kerubim[three.kerubId ?? "air"].zodiacId;
      if (square.region === "calvaryCross")
        return four.planetId
          ? planetWord(four.planetId)
          : `n${number(four.sephirahId as SephirahId)}`;
      return one.planetId ?? one.zodiacId ?? one.elementId;
    };
    for (const version of ["gd", "regardie"] as const)
      EARTH_OF_WATER_P290.forEach((row, r) =>
        row.forEach((symbol, c) =>
          expect(shown(pyramid("water", 7 + r, c, version)), `${r},${c}`).toBe(
            symbol,
          ),
        ),
      );
  });

  it("p.290: the Tablet of Union's cards", () => {
    UNION_CARDS_P290.forEach(({ cards }, row) =>
      cards.forEach((card, column) => {
        const id = pyramid("union", row, column).sides[0].attribution
          .minorCardId;
        expect(minorCard(id ?? "")?.name.toUpperCase(), card).toBe(
          card.replace(" PENTS", " PENTACLES").replace(" ", " OF "),
        );
      }),
    );
  });

  it("p.298: each letter's trump, symbol, figure and place", () => {
    for (const row of ATTRIBUTIONS_P298) {
      const letter = P298_LETTERS[row.letter];
      expect(hebrewLetters[letter], row.letter).toBeDefined();
      const pathId = pathOfLetter(letter);
      expect(trumpOf(pathId), row.letter).toBe(
        TRUMP_NAMES[row.trump] ?? row.trump,
      );
      if (row.column === "sc") {
        // A Calvary square's planet, by its Sephirah.
        const sephirah = P298_SEPHIROTH[row.rank];
        const squares = tabletPyramids(view("air")).filter(
          (square) => square.sides[3].attribution.sephirahId === sephirah,
        );
        expect(squares, row.rank).toHaveLength(4);
        for (const square of squares) {
          const four = square.sides[3].attribution;
          expect(planetWord(four.planetId ?? "")).toBe(row.symbol);
          expect(four.hebrewLetterId).toBe(letter);
          expect(four.pathId).toBe(pathId);
        }
        continue;
      }
      // Every servient square of that column and rank carries the letter.
      const found = WATCHTOWER_IDS.flatMap((id) =>
        tabletPyramids(view(id)),
      ).filter(
        (square) =>
          square.letters.column === row.column &&
          square.letters.rank === row.rank,
      );
      expect(found, row.letter).toHaveLength(16);
      const figure = row.geomantic ? P298_FIGURES[row.geomantic] : undefined;
      expect(figure, row.letter).toBeDefined();
      expect(GEOMANTIC_FIGURES[letter]).toBe(figure);
      for (const square of found) {
        const [one, two, three, four] = square.sides.map((s) => s.attribution);
        expect(four.hebrewLetterId).toBe(letter);
        expect(two.pathId).toBe(pathId);
        expect(one.planetId ?? one.zodiacId ?? one.elementId).toBe(
          row.symbol === "saturn (earth)" ? "saturn" : row.symbol,
        );
        expect(three.tetragramId, row.letter).toBe(figure);
      }
    }
    expect(ATTRIBUTIONS_P298).toHaveLength(22);
  });

  it("p.298: the signs' and elements' letters, Earth's through Saturn", () => {
    const symbolOf = (letter: string) =>
      ATTRIBUTIONS_P298.find((row) => P298_LETTERS[row.letter] === letter)
        ?.symbol;
    for (const id of Object.keys(zodiac) as ZodiacId[])
      expect(symbolOf(zodiac[id].hebrewLetterId), id).toBe(id);
    expect(
      new Set(Object.values(zodiac).map((sign) => sign.hebrewLetterId)).size,
    ).toBe(12);
    for (const element of ["air", "water", "fire"] as const)
      expect(
        symbolOf(
          (elements[element] as { hebrewLetterId: string }).hebrewLetterId,
        ),
        element,
      ).toBe(element);
    expect("hebrewLetterId" in elements.earth).toBe(false);
    expect("hebrewLetterId" in elements.spirit).toBe(false);
    expect(symbolOf(planets.saturn.hebrewLetterId ?? "")).toBe(
      "saturn (earth)",
    );
  });
});

describe("vol. 4's worked squares", () => {
  /** A worked side's words, as the pyramid gives them. */
  const words = (square: TabletPyramid, side: number) => {
    const { elementId, attribution: a } = square.sides[side];
    const card = minorCard(a.minorCardId ?? "");
    const figure = a.tetragramId ?? "";
    return [
      elementId,
      a.zodiacId,
      a.planetId && planetWord(a.planetId),
      card?.name,
      // "5 Swords", as p.294 gives a small card.
      card && typeof card.rank === "number"
        ? `${card.rank} ${card.suit[0].toUpperCase()}${card.suit.slice(1)}`
        : undefined,
      a.pathId && trumpOf(a.pathId),
      a.hebrewLetterId &&
        Object.keys(P298_LETTERS).find(
          (name) => P298_LETTERS[name] === a.hebrewLetterId,
        ),
      figure && figure[0].toUpperCase() + figure.slice(1),
      a.sephirahId &&
        Object.keys(P298_SEPHIROTH).find(
          (name) => P298_SEPHIROTH[name] === a.sephirahId,
        ),
      a.kerubId && kerubim[a.kerubId].face.en,
    ].filter(Boolean);
  };

  /** Where a version departs from the worked squares, as `page row,column`. */
  const departures = (version: TabletVersionId) =>
    WORKED_SQUARES.flatMap((worked) => {
      const square = pyramid(worked.tablet, worked.row, worked.column, version);
      // The page's letter, in vol. 4's own print, places the square.
      expect(
        view(worked.tablet, "regardie").grid[worked.row][
          worked.column
        ]?.toUpperCase(),
      ).toBe(worked.letter);
      return worked.sides.flatMap((given, side) =>
        given.every((word) => words(square, side).includes(word))
          ? []
          : [`p.${worked.page} ${worked.row},${worked.column} ${side + 1}`],
      );
    });

  it("are ten, and all match the Equinox's version", () => {
    expect(WORKED_SQUARES).toHaveLength(10);
    expect(departures("equinox")).toEqual([]);
  });

  it("match the Golden Dawn's but for the O of OMEBB, vol. 4's own", () => {
    for (const version of ["gd", "regardie"] as const)
      expect(departures(version)).toEqual(["p.302 1,7 4"]);
    const noted = pyramidExceptions("water").find(
      (each) => each.id === "vol4Omebb",
    );
    expect(noted?.versions).toEqual(["gd", "regardie"]);
    expect(noted?.squares).toEqual([{ tablet: "water", row: 1, column: 7 }]);
  });
});

describe("the gods", () => {
  it("are p.315's table, row by row", () => {
    const rows = Object.values(godForms).sort((a, b) => a.no - b.no);
    expect(rows.map((row) => row.id)).toEqual(GODS_P315.map((row) => row.god));
    for (const [index, read] of GODS_P315.entries()) {
      const row = rows[index];
      expect([...new Set(read.elements)].sort()).toEqual(
        [...row.elementIds].sort(),
      );
      const mix =
        read.elements[0] === "spirit"
          ? "each"
          : read.orThreeOfFour
            ? "single"
            : read.elements.length === 4
              ? "pair"
              : "three";
      expect(row.mix, row.id).toBe(mix);
    }
  });

  it("give the Children of Horus p.361's three elements", () => {
    for (const child of CHILDREN_P361)
      expect(
        [...godForms[child.god as GDGodFormId].elementIds].sort(),
        child.god,
      ).toEqual([...child.elements].sort());
  });

  it("give the worked squares their gods: nhdD, lSha and CPao", () => {
    for (const worked of WORKED_GODS) {
      const found = WATCHTOWER_IDS.includes(worked.tablet as "air")
        ? tabletPyramids(view(worked.tablet)).filter(
            (square) => square.angel?.spelling === worked.name,
          )
        : [];
      expect(found, worked.name).toHaveLength(1);
      expect(found[0].godFormId, worked.name).toBe(worked.god);
    }
  });

  it("cover the mixes of the 256 servient squares", () => {
    const mixes = new Map<string, number>();
    const gods = new Map<string, number>();
    for (const id of WATCHTOWER_IDS)
      for (const square of tabletPyramids(view(id))) {
        if (square.region !== "servient") {
          expect(square.godFormId).toBeUndefined();
          expect(square.sphinx).toBeUndefined();
          continue;
        }
        const counts = new Map<string, number>();
        for (const side of square.sides)
          counts.set(
            side.elementId ?? "",
            (counts.get(side.elementId ?? "") ?? 0) + 1,
          );
        const shape = [...counts.values()].sort().reverse().join("");
        mixes.set(shape, (mixes.get(shape) ?? 0) + 1);
        gods.set(
          square.godFormId ?? "",
          (gods.get(square.godFormId ?? "") ?? 0) + 1,
        );
        expect(square.sphinx).toEqual(
          square.sides.map((side) => side.elementId),
        );
      }
    expect(Object.fromEntries(mixes)).toEqual({
      "4": 4,
      "31": 48,
      "22": 36,
      "211": 144,
      "1111": 24,
    });
    expect(gods.get("osiris")).toBe(24);
    expect(gods.size).toBe(15);
    expect(pyramidReading("children")?.text).toContain("nhdD");
  });
});

describe("the counts", () => {
  it("each tablet's Great Cross holds the 36 decans once", () => {
    for (const id of WATCHTOWER_IDS) {
      const decans = tabletPyramids(view(id))
        .filter((square) => square.region === "greatCross")
        .map((square) => square.sides[0].attribution.decanId);
      expect(new Set(decans).size).toBe(36);
      expect(decans.sort()).toEqual(DECANS.map((decan) => decan.id).sort());
    }
  });

  it("each lesser angle holds the ten Sephiroth once", () => {
    for (const version of ["gd", "equinox"] as const)
      for (const id of WATCHTOWER_IDS)
        for (const quarter of TABLET_QUARTERS) {
          const sephiroth = tabletPyramids(view(id, version))
            .filter(
              (square) =>
                square.quarter === quarter && square.region === "calvaryCross",
            )
            .map((square) =>
              number(square.sides[3].attribution.sephirahId as SephirahId),
            );
          expect(sephiroth.sort((a, b) => a - b)).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
          ]);
        }
  });

  it("each lesser angle's servient squares hold the 12 signs and 4 elements once", () => {
    for (const id of WATCHTOWER_IDS)
      for (const quarter of TABLET_QUARTERS) {
        const symbols = tabletPyramids(view(id))
          .filter(
            (square) =>
              square.quarter === quarter && square.region === "servient",
          )
          .map((square) => {
            const { zodiacId, elementId } = square.sides[0].attribution;
            return zodiacId ?? elementId;
          });
        expect(symbols.sort()).toEqual(
          [...Object.keys(zodiac), "air", "water", "earth", "fire"].sort(),
        );
      }
  });

  it("the column and the bar are the badge's in vol. 1, and the plates' in the Equinox", () => {
    const numbers = (ids: readonly SephirahId[] | null) =>
      (ids ?? []).map(number);
    expect(numbers(CALVARY_COLUMN)).toEqual(BADGE_V1.column);
    expect(numbers(CALVARY_BARS.gd)).toEqual(BADGE_V1.bar);
    expect(CALVARY_BARS.regardie).toBe(CALVARY_BARS.gd);
    expect(numbers(CALVARY_BARS.equinox)).toEqual(
      PLATES.air.squares
        .filter((square) => square.row === 2 && square.square <= 5)
        .map((square) => Number(square.bottom.slice(1))),
    );
  });
});

describe("the angels", () => {
  it("are the servient rows' rotations from the square, from tabletNames", () => {
    for (const version of ["gd", "equinox"] as const)
      for (const id of WATCHTOWER_IDS)
        for (const square of tabletPyramids(view(id, version))) {
          if (square.region !== "servient") {
            expect(square.angel).toBeUndefined();
            continue;
          }
          const quarter = square.quarter ?? "topLeft";
          const prefix = TABLET_QUARTER_ID_PREFIXES[quarter];
          const top = square.row < 6 ? 0 : 7;
          const nameId = `${prefix}-servient-${square.row - top - 1}`;
          const name = findTabletName(view(id, version), nameId);
          const index =
            name?.squares.findIndex(
              (each) =>
                each.row === square.row && each.column === square.column,
            ) ?? -1;
          expect(square.angel).toEqual({
            nameId,
            rotation: index,
            spelling: name?.rotations?.[index],
          });
          const great = findTabletName(
            view(id, version),
            `${nameId}-archangel`,
          );
          expect(square.greatAngel?.spelling).toBe(great?.rotations?.[index]);
          expect(square.greatAngel?.unionLetter).toEqual(great?.unionLetter);
          // The square's own letter starts its angel's name.
          expect(square.angel?.spelling[0]).toBe(
            view(id, version).grid[square.row][square.column] ?? "?",
          );
        }
  });
});

describe("the notes", () => {
  it("give each topic's rule by vol. 4 and, but for the gods, the Equinox", () => {
    for (const topic of [
      "sides",
      "greatCross",
      "calvaryCross",
      "kerubic",
      "servient",
      "union",
      "gods",
    ]) {
      const witnesses = pyramidRules(topic).map((rule) => rule.witness);
      expect(witnesses, topic).toEqual(
        topic === "gods" ? ["regardie1940"] : ["regardie1940", "equinox1912"],
      );
    }
    for (const id of [
      "calvaryBar",
      "sphinx",
      "tendency",
      "children",
      "earthAsSaturn",
      "geomanticFigures",
    ])
      expect(pyramidReading(id)?.sources.length, id).toBeGreaterThan(0);
  });

  it("give in the Calvary bar's reading the two orders the versions take", () => {
    // Built from the data, not read out of the prose: each order as the
    // reading must write it, by the Sephiroth's names in the package.
    const order = (bar: readonly SephirahId[] | null) => {
      const names = (bar ?? []).map((id) => sephirot[id].name.roman);
      return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
    };
    const text = pyramidReading("calvaryBar")?.text ?? "";
    expect(order(CALVARY_BARS.gd)).toBe(
      "Binah, Gevurah, Tiferet, Chesed and Chochmah",
    );
    expect(text).toContain(`have ${order(CALVARY_BARS.gd)} from the left`);
    expect(CALVARY_BARS.regardie).toEqual(CALVARY_BARS.gd);
    expect(text).toContain(
      `the Equinox's plates have ${order(CALVARY_BARS.equinox)} in every lesser angle`,
    );
  });

  it("name the court cards and suits vol. 4 gives the Kerubic squares", () => {
    // The M of AISMT: Earth tablet, Fire angle, the Queen of Wands.
    const m = pyramid("earth", 7, 10);
    expect(m.letters.column).toBe("he");
    expect(m.sides[0].attribution.minorCardId).toBe("queen-wands");
    expect(kerubim[m.sides[2].attribution.kerubId ?? "air"].zodiacId).toBe(
      "scorpio",
    );
  });
});

/** Every square of every tablet in the Golden Dawn's three versions. */
const EVERY_SQUARE = (["gd", "regardie", "equinox"] as const).flatMap(
  (version) =>
    [...WATCHTOWER_IDS, "union" as const].flatMap((id) =>
      tabletPyramids(view(id, version)).map((square) => ({
        version,
        id,
        square,
      })),
    ),
);

/** p.294, written out: the element each planet rules. */
const RULED: Readonly<Record<string, string>> = {
  sol: "fire",
  jupiter: "fire",
  saturn: "air",
  mercury: "air",
  venus: "earth",
  luna: "earth",
  mars: "water",
};

/** Each quarter's suit, by its element (Air, Water, Earth, Fire). */
const QUARTER_SUITS: Readonly<Record<string, string>> = {
  topLeft: "swords",
  topRight: "cups",
  bottomLeft: "pentacles",
  bottomRight: "wands",
};

/** p.288, written out: each court rank's element. */
const COURT: Readonly<Record<string, string>> = {
  king: "fire",
  queen: "water",
  prince: "air",
  princess: "earth",
};

/** pp.287-288 and p.298, written out: the six Calvary planets and trumps. */
const CALVARY: Readonly<
  Record<string, { planet: string; trump: string; letter: string }>
> = {
  keter: { planet: "jupiter", trump: "Wheel of Fortune", letter: "kaf" },
  chochmah: { planet: "mercury", trump: "Magician", letter: "bet" },
  binah: { planet: "luna", trump: "High Priestess", letter: "gimel" },
  hesed: { planet: "venus", trump: "Empress", letter: "dalet" },
  gevurah: { planet: "mars", trump: "Tower", letter: "pe" },
  tiferet: { planet: "sol", trump: "Sun", letter: "resh" },
};

const where = (each: (typeof EVERY_SQUARE)[number]) =>
  `${each.version} ${each.id} ${each.square.row},${each.square.column}`;

describe("each square's computed attributions, in every view", () => {
  it("are 2,016 squares: three versions of four Watchtowers and the Union", () => {
    expect(EVERY_SQUARE).toHaveLength(3 * (4 * 156 + 20));
  });

  it("the Great Cross: the sign's element on side 1, the planet's on side 3", () => {
    for (const each of EVERY_SQUARE.filter(
      ({ square }) => square.region === "greatCross",
    )) {
      const [one, , three] = each.square.sides;
      const sign = one.attribution.zodiacId as ZodiacId;
      expect(one.elementId, where(each)).toBe(zodiac[sign].elementId);
      expect(three.elementId, where(each)).toBe(
        RULED[three.attribution.planetId ?? ""],
      );
      const card = minorCard(one.attribution.minorCardId ?? "");
      expect(card?.suit, where(each)).toBe(
        { fire: "wands", water: "cups", air: "swords", earth: "pentacles" }[
          zodiac[sign].elementId as "fire"
        ],
      );
    }
  });

  it("a Calvary cross: the quarter's card of the Sephirah's number, and six planets", () => {
    for (const each of EVERY_SQUARE.filter(
      ({ square }) => square.region === "calvaryCross",
    )) {
      const four = each.square.sides[3].attribution;
      const sephirah = four.sephirahId as SephirahId;
      const card = minorCard(four.minorCardId ?? "");
      expect(card?.suit, where(each)).toBe(
        QUARTER_SUITS[each.square.quarter ?? ""],
      );
      const n = number(sephirah);
      expect(card?.rank, where(each)).toBe(n === 1 ? "ace" : n);
      const planet = CALVARY[sephirah];
      expect(four.planetId, where(each)).toBe(planet?.planet);
      expect(four.hebrewLetterId, where(each)).toBe(planet?.letter);
      expect(trumpOf(four.pathId), where(each)).toBe(planet?.trump);
      expect(each.square.sides[3].elementId).toBeUndefined();
    }
  });

  it("a Kerubic square: the quarter's court card of the Kerub's element, and its sign", () => {
    const SIGNS = {
      fire: "leo",
      water: "scorpio",
      air: "aquarius",
      earth: "taurus",
    } as const;
    for (const each of EVERY_SQUARE.filter(
      ({ square }) => square.region === "kerubic",
    )) {
      const [one, , three] = each.square.sides;
      const card = minorCard(one.attribution.minorCardId ?? "");
      expect(card?.suit, where(each)).toBe(
        QUARTER_SUITS[each.square.quarter ?? ""],
      );
      expect(card?.kind).toBe("court");
      expect(COURT[String(card?.rank)], where(each)).toBe(one.elementId);
      expect(three.attribution.kerubId, where(each)).toBe(one.elementId);
      expect(three.elementId, where(each)).toBe(one.elementId);
      expect(three.attribution.zodiacId, where(each)).toBe(
        SIGNS[one.elementId as "fire"],
      );
    }
  });

  it("the Tablet of Union: p.290's cards and columns, the line's element", () => {
    const unions = EVERY_SQUARE.filter(({ id }) => id === "union");
    expect(unions).toHaveLength(60);
    for (const each of unions) {
      const { row, column } = each.square;
      const [one, two, three, four] = each.square.sides;
      expect(one.elementId, where(each)).toBe(UNION_COLUMNS_P290[column]);
      expect(three.elementId, where(each)).toBe(UNION_CARDS_P290[row].line);
      expect([two.elementId, four.elementId]).toEqual(["spirit", "spirit"]);
      expect(
        minorCard(one.attribution.minorCardId ?? "")?.name.toUpperCase(),
        where(each),
      ).toBe(
        UNION_CARDS_P290[row].cards[column]
          .replace(" PENTS", " PENTACLES")
          .replace(" ", " OF "),
      );
    }
  });
});

describe("the closed sets", () => {
  it("the exceptions are these four, and a new one fails", () => {
    expect(
      pyramidExceptions()
        .map((each) => each.id)
        .sort(),
    ).toEqual([
      "plateBlankTriangles",
      "plateDotlessSuns",
      "vol4Omebb",
      "vol4ThreeOfSwords",
    ]);
  });

  it("the region rule gives nothing outside a Watchtower", () => {
    expect(tabletRegion(0, 0)).toBe("kerubic");
    expect(tabletRegion(12, 11)).toBe("servient");
    for (const [row, column] of [
      [-1, 0],
      [13, 0],
      [0, -1],
      [0, 12],
      [12, 12],
      [13, 11],
      [0.5, 0],
      [Number.NaN, 0],
    ])
      expect(tabletRegion(row, column), `${row},${column}`).toBeUndefined();
  });

  it("the Name's letters map to the Hebrew letters, both He's to He", () => {
    expect(NAME_LETTER_HEBREW).toEqual({
      yod: "yod",
      he: "he",
      vav: "vav",
      heFinal: "he",
    });
    for (const letter of NAME_LETTERS)
      expect(hebrewLetters[NAME_LETTER_HEBREW[letter]]).toBeDefined();
  });
});
