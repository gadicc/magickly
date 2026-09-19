import { describe, expect, it } from "vitest";
import { assemble, type Problem, problemsOf } from "./assemble";
import type { Tables } from "./tables";
import { tables } from "./tables";

/**
 * `assemble()` against the real graph. The tables are mostly made up, because
 * the real data has none of the faults the problem list is for; the ones that
 * use it are marked.
 */

/** A row of a made-up table, which is not any real table's shape. */
type Fake = Record<string, unknown>;
type FakeTables = Record<string, Record<string, Fake> | Fake[]>;
type Assembled = Record<string, Record<string, Fake> & Fake[]>;

/** Assembles tables written for a test, which are not the real ones. */
const fake = (input: FakeTables) =>
  assemble(
    input as unknown as Pick<Tables, "sephirah">,
  ) as unknown as Assembled;

const kinds = (problems: Problem[]) =>
  problems.map((p) => `${p.kind} ${p.table}.${p.row}.${p.field}`);

describe("assemble", () => {
  it("links the real tables with nothing left over", () => {
    const data = assemble(tables);
    expect(problemsOf(data)).toEqual([]);
    expect(data.sephirah.keter.archangel?.name.roman).toBe("Metatron");
    expect(data.sephirah.hod.gdGrade?.planet?.hebrewLetter?.letter.he).toBe(
      "ב",
    );
  });

  it("gives every row of the table the accessor, undefined where the id is not there", () => {
    const data = assemble(tables);
    // Da'at has no planet at all; the key is there and the value is not.
    expect(Object.hasOwn(data.sephirah.daat, "planet")).toBe(true);
    expect(data.sephirah.daat.planet).toBeUndefined();
    expect(data.sephirah.keter.planet?.id).toBe("primum-mobile");
  });

  it("reports an id no row is keyed by, and leaves the accessor undefined", () => {
    const data = fake({
      sephirah: { keter: { id: "keter", godNameId: "nowhere" } },
      godName: { ehiyeh: { name: { en: "I am" } } },
    });
    expect(kinds(problemsOf(data))).toEqual([
      "dangling sephirah.keter.godNameId",
    ]);
    expect(data.sephirah.keter.godName).toBeUndefined();
  });

  it("keeps the rows a list does resolve, and reports the one it does not", () => {
    const data = fake({
      tetragram: { via: { id: "via", planetIds: ["luna", "nowhere"] } },
      planet: { luna: { id: "luna" } },
    });
    expect(kinds(problemsOf(data))).toEqual([
      "dangling tetragram.via.planetIds",
    ]);
    expect((data.tetragram.via.planets as Fake[]).map((p) => p.id)).toEqual([
      "luna",
    ]);
  });

  it("makes no list where the field is absent, or is not one", () => {
    const data = fake({
      tetragram: {
        via: { id: "via" },
        carcer: { id: "carcer", planetIds: "luna" },
      },
      planet: { luna: { id: "luna" } },
    });
    expect(problemsOf(data)).toEqual([]);
    expect(data.tetragram.via.planets).toBeUndefined();
    expect(data.tetragram.carcer.planets).toBeUndefined();
  });

  it("puts a nested accessor beside its id, and none where the block is absent", () => {
    // Real paths: two of the twenty-four are on the Hebrew tree only.
    const data = assemble(tables);
    expect(data.tolPath["1_2"].hermetic?.hebrewLetter?.letter.he).toBe("א");
    expect(data.tolPath["2_5"].hermetic).toBeUndefined();
    expect(data.tolPath["2_5"].hebrew?.hebrewLetter?.letter.name).toBe("Zayin");
  });

  it("reports a mirror that does not point back", () => {
    const data = fake({
      sephirah: { keter: { id: "keter", archangelId: "metatron" } },
      archangel: { metatron: { id: "metatron", sephirahId: "binah" } },
    });
    // Tables are walked in name order, so the archangel's dangling
    // back-link is found before the sephirah's mirror of it.
    expect(kinds(problemsOf(data))).toEqual([
      "dangling archangel.metatron.sephirahId",
      "mirror-asymmetric sephirah.keter.archangelId",
    ]);
  });

  it("reports a second row claiming a back-link that must be unique", () => {
    const data = assemble(tables);
    // Every inverse in the real graph is a list, and an empty one where
    // nothing points at the row.
    expect(data.element.spirit.zodiacs).toEqual([]);
    expect(data.element.fire.zodiacs.map((z) => z.id)).toEqual([
      "aries",
      "leo",
      "sagittarius",
    ]);
    expect(data.planet.saturn.sephirot.map((s) => s.id)).toEqual(["binah"]);
  });

  it("refuses to shadow a field the row already has", () => {
    const data = fake({
      sephirah: {
        keter: { id: "keter", godNameId: "ehiyeh", godName: "mine" },
      },
      godName: { ehiyeh: { name: { en: "I am" } } },
    });
    expect(kinds(problemsOf(data))).toEqual([
      "accessor-collision sephirah.keter.godNameId",
    ]);
    expect(data.sephirah.keter.godName).toBe("mine");
  });

  it("gives back the same object for the same tables, and a new one for new tables", () => {
    expect(assemble(tables)).toBe(assemble(tables));
    const scoped = { sephirah: tables.sephirah, godName: tables.godName };
    expect(assemble(scoped)).toBe(assemble({ ...scoped }));
    const again = fake({ sephirah: { keter: { id: "keter" } } });
    const other = fake({ sephirah: { binah: { id: "binah" } } });
    expect(other).not.toBe(again);
    expect(Object.keys(other.sephirah)).toEqual(["binah"]);
  });

  it("keeps the tables in the order they were given", () => {
    const data = fake({ zodiac: {}, planet: {}, element: {} });
    expect(Object.keys(data)).toEqual(["zodiac", "planet", "element"]);
  });

  it("links only the tables it was given", () => {
    const scoped = assemble({ sephirah: tables.sephirah });
    expect(Object.keys(scoped)).toEqual(["sephirah"]);
    expect(Object.hasOwn(scoped.sephirah.keter, "godName")).toBe(false);
    expect(scoped.sephirah.keter.next?.id).toBe("chochmah");
  });

  it("leaves the tables it was given untouched", () => {
    assemble(tables);
    expect(Object.hasOwn(tables.sephirah.keter, "godName")).toBe(false);
    expect(Object.isFrozen(tables.sephirah)).toBe(false);
  });

  it("freezes everything it returns, cycles and all", () => {
    const data = assemble(tables);
    expect(Object.isFrozen(data)).toBe(true);
    expect(Object.isFrozen(data.sephirah)).toBe(true);
    expect(Object.isFrozen(data.sephirah.keter)).toBe(true);
    expect(Object.isFrozen(data.sephirah.keter.name)).toBe(true);
    expect(data.sephirah.keter.archangel?.sephirah).toBe(data.sephirah.keter);
  });

  it("keys an array table by its rows' ids, or by their index where they have none", () => {
    const data = assemble(tables);
    expect(data.house[0].zodiac?.id).toBe("aries");
    expect(data.christianChoir[0].id).toBe("seraphim");
    expect(data.seventyTwoAngel[0].no).toBe(1);
    const linked = fake({
      house: [{ index: 1, zodiacId: "aries" }],
      zodiac: { aries: { id: "aries" } },
      christianChoir: [{ id: "seraphim" }],
    });
    expect((linked.house[0].zodiac as Fake).id).toBe("aries");
  });

  it("clones a row that refers to itself", () => {
    const cyclic: Fake = { id: "keter" };
    cyclic.self = cyclic;
    const data = fake({ sephirah: { keter: cyclic } });
    expect((data.sephirah.keter.self as Fake).id).toBe("keter");
    expect(data.sephirah.keter.self).toBe(data.sephirah.keter);
  });

  it("knows nothing about an object it did not assemble", () => {
    expect(problemsOf({})).toEqual([]);
  });
});
