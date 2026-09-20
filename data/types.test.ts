import { describe, expect, it } from "vitest";
import { assemble } from "./assemble";
import { tables } from "./tables";
import type { Links, Raw } from "./types";

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
  });

  it("knows the tables and the ids the JSON has", () => {
    // @ts-expect-error there is no such table
    expect(data.wizard).toBeUndefined();
    // @ts-expect-error there is no such sephirah
    expect(data.sephirah.nowhere).toBeUndefined();
  });
});
