import { describe, expect, it } from "vitest";
import { assemble } from "./assemble";
import barrel from "./data";
import type {
  AlchemySymbolRow,
  ArchangelRow,
  GDGradeRow,
  PlanetRow,
  SephirahRow,
  TetragramRow,
  TolPathRow,
  ZodiacRow,
} from "./rows";
import { tables } from "./tables";
import type { Links, Raw, Row } from "./types";

/**
 * The row types, asserted where they matter: a link is a property typed as
 * the target's row, so a multi-hop read checks; and everything the graph does
 * not declare is a compile error rather than `undefined` at runtime. Each
 * `@ts-expect-error` is the assertion — TypeScript fails the build if the
 * line it marks turns out to be legal — and the `expect` beside it says what
 * the same expression does when it runs.
 */

const data = assemble(tables);
const scoped = assemble({ sephirah: tables.sephirah });

/**
 * Whether two types are the same one, rather than merely assignable to each
 * other. `SephirahRow` and the mapped type it extends are assignable both
 * ways, and telling them apart is the whole of the assertion below.
 */
type Same<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

describe("the row types", () => {
  it("follows links as far as the data goes", () => {
    const letter: string | undefined =
      data.sephirah.hod.gdGrade?.planet?.hebrewLetter?.letter.he;
    expect(letter).toBe("ב");

    // A cycle: the mirror leads back to where it started, and is the same row.
    const back = data.sephirah.keter.archangel?.sephirah;
    expect(back).toBe(data.sephirah.keter);

    const signs: string[] = data.element.fire.zodiacs.map((z) => z.name.en);
    expect(signs).toEqual(["Aries", "Leo", "Sagittarius"]);

    const planets: string[] = data.tetragram.caput_draconis.planets.map(
      (p) => p.id,
    );
    expect(planets).toEqual(["venus", "jupiter"]);

    const nested: string | undefined =
      data.tolPath["1_2"].hermetic?.hebrewLetter?.letter.name;
    expect(nested).toBe("Aleph");

    const house: string = data.house[0].zodiac.name.en;
    expect(house).toBe("Aries");
  });

  it("is a row a consumer's own annotation still accepts", () => {
    const compat: Raw<"sephirah"> & Partial<Links<"*", "sephirah">> =
      data.sephirah.keter;
    expect(compat.archangel?.name.roman).toBe("Metatron");
    // Uniform per table, at every depth: Da'at is the only one with a dashed
    // stroke, and the others still have the key.
    const dash: number | undefined = data.sephirah.keter.color.strokeDasharray;
    expect(dash).toBeUndefined();
  });

  it("gives every table's rows a name of their own", () => {
    // The interfaces in rows.ts add nothing to `Row<"*", T>`, so a row is
    // assignable in both directions and no consumer's annotation changes
    // meaning. What they buy is the printing: a hover, an error and step 4's
    // `.d.ts` say `SephirahRow` where they used to expand the whole row, and
    // a link inside one is named too.
    const named: SephirahRow = data.sephirah.keter;
    const structural: Row<"*", "sephirah"> = named;
    const back: SephirahRow = structural;
    expect(back).toBe(data.sephirah.keter);

    const archangel: ArchangelRow | undefined = named.archangel;
    expect(archangel?.name.roman).toBe("Metatron");
    expect(archangel?.sephirah).toBe(named);
  });

  it("names the barrel's rows, and not only a full assemble()'s", () => {
    // The barrel is the object step 4's package emits a `.d.ts` for, and it
    // assembles 23 of the 26 tables rather than all of them. Its rows are
    // named because the three it leaves out are named in no link, either as
    // a source or as a target, so the scope leaves nothing out; a link
    // declared to one of the three would narrow it and drop every row of the
    // barrel back to the expansion, which is what this line would catch.
    const named: Same<typeof barrel.sephirah.keter, SephirahRow> = true;
    expect(named).toBe(true);
    expect(barrel.sephirah.keter.archangel?.name.roman).toBe("Metatron");
  });

  it("types the back-links the entity pages read", () => {
    // Plan 036's seven, none of them in the JSON: a list where the graph says
    // `inverseMany`, and otherwise the one row or nothing, which the
    // integrity check proves unique. Type equality, as above, so that a
    // back-link that lost its name or widened would fail here rather than
    // still be assignable.
    const sol = data.planet.sol;
    const resh = data.hebrewLetter.resh;
    const exact: [
      Same<typeof sol.zodiacs, readonly ZodiacRow[]>,
      Same<typeof sol.tetragrams, readonly TetragramRow[]>,
      Same<typeof sol.gdGrade, GDGradeRow | undefined>,
      Same<typeof sol.alchemySymbol, AlchemySymbolRow | undefined>,
      Same<typeof resh.planet, PlanetRow | undefined>,
      Same<typeof resh.hermeticPath, TolPathRow | undefined>,
      Same<typeof resh.hebrewPath, TolPathRow | undefined>,
    ] = [true, true, true, true, true, true, true];
    expect(exact).not.toContain(false);

    expect(sol.zodiacs.map((z) => z.id)).toEqual(["leo"]);
    expect(sol.gdGrade?.id).toBe("5=6");
    expect(sol.alchemySymbol?.name.en).toBe("Gold");
    expect(resh.planet).toBe(sol);
    // A nested link's back-link lands at the top of the row it points at.
    expect(resh.hermeticPath?.hermetic?.hebrewLetter).toBe(resh);
    expect(resh.hebrewPath?.hebrew?.hebrewLetter).toBe(resh);
  });

  it("names a path's two sephirot, and each sephirah's paths", () => {
    // Every one of the twenty-four paths carries both ends, so neither
    // accessor is optional; Da'at, on no path, has two empty lists.
    const path = data.tolPath["1_6"];
    const tiferet = data.sephirah.tiferet;
    const exact: [
      Same<typeof path.from, SephirahRow>,
      Same<typeof path.to, SephirahRow>,
      Same<typeof tiferet.pathsFrom, readonly TolPathRow[]>,
      Same<typeof tiferet.pathsTo, readonly TolPathRow[]>,
    ] = [true, true, true, true];
    expect(exact).not.toContain(false);

    const joins: string = `${path.from.name.roman}–${path.to.name.roman}`;
    expect(joins).toBe("Keter–Tiferet");
    expect(tiferet.pathsTo).toContain(path);
    expect(data.sephirah.daat.pathsFrom).toEqual([]);
  });

  it("is readonly wherever assemble() froze it", () => {
    // Each of these used to compile and then throw, because `assemble()`
    // deep-freezes and the types said nothing about it. They are now compile
    // errors, and the `toThrow` beside each says what the freeze does with
    // the same line at runtime — modules are strict mode, so writing through
    // a frozen object raises rather than failing quietly.
    const frozen = (change: () => void) => expect(change).toThrow(TypeError);

    frozen(() => {
      // @ts-expect-error a row's own field
      data.sephirah.keter.scent = "x";
    });
    frozen(() => {
      // @ts-expect-error a field of a nested block
      data.sephirah.keter.color.queen = "x";
    });
    frozen(() => {
      // @ts-expect-error a link
      data.sephirah.keter.archangel = undefined;
    });
    frozen(() => {
      // @ts-expect-error a list of links is a readonly array
      data.tetragram.via.planets.push(data.planet.sol);
    });
    frozen(() => {
      // @ts-expect-error so is a list the JSON itself holds
      data.tetragram.via.rows.push(1);
    });
    frozen(() => {
      // @ts-expect-error a row of a table
      data.sephirah.keter = data.sephirah.hod;
    });
    frozen(() => {
      // @ts-expect-error a row of an array table
      data.house[0] = data.house[1];
    });
    frozen(() => {
      // @ts-expect-error and a whole table
      data.sephirah = data.sephirah;
    });
  });

  it("has no accessor for a table that was not assembled", () => {
    // @ts-expect-error only the sephirot were assembled
    expect(scoped.sephirah.keter.archangel).toBeUndefined();
    expect(scoped.sephirah.keter.next?.id).toBe("chochmah");

    // A back-link belongs to the table that declares it, so it is there only
    // where that table was assembled too.
    const planets = assemble({ planet: tables.planet });
    // @ts-expect-error the signs were not assembled
    expect(planets.planet.sol.zodiacs).toBeUndefined();
  });

  it("has no accessor for anything the graph does not link", () => {
    // @ts-expect-error a pending target is not a link
    expect(data.planet.saturn.spirit).toBeUndefined();
    // @ts-expect-error nor is an enum
    expect(data.gdGrade["0=0"].order).toBeUndefined();
    // @ts-expect-error nor is something external
    expect(data.tolPath["1_2"].hermetic?.tarot).toBeUndefined();
  });

  it("knows a list from a row, and an absent link from a certain one", () => {
    // @ts-expect-error the accessor of an `Ids` field is plural
    expect(data.tetragram.acquisitio.planet).toBeUndefined();
    // @ts-expect-error a list is not a row
    expect(data.tetragram.acquisitio.planets.symbol).toBeUndefined();
    // @ts-expect-error nine of the eleven sephirot have a grade, so it needs ?.
    expect(data.sephirah.hod.gdGrade.name).toBe("Practicus");
    // @ts-expect-error a back-link derived for many rows is a list
    expect(data.planet.sol.zodiacs.id).toBeUndefined();
    // @ts-expect-error seven of the letters have a planet, so it needs ?.
    expect(data.hebrewLetter.resh.planet.id).toBe("sol");
  });

  it("knows the tables and the ids the JSON has", () => {
    // @ts-expect-error there is no such table
    expect(data.wizard).toBeUndefined();
    // @ts-expect-error there is no such sephirah
    expect(data.sephirah.nowhere).toBeUndefined();
  });
});
