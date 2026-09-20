import { setProperty } from "dot-prop";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { COMPONENT_IMAGE_SLUGS } from "./contracts";
import {
  DATA_INPUT_TABLES,
  type DataInputSources,
  type DataInputsSpec,
  IMAGE_INPUTS_PROFILE,
  resolveDataInputs,
  resolvedInputsHash,
} from "./dataInputs";
import { COMPONENT_IMAGE_REGISTRY } from "./registry";

const sources = (tables: Record<string, Record<string, unknown>>) =>
  tables as DataInputSources;
const spec = (...groups: DataInputsSpec[number][]): DataInputsSpec =>
  groups as DataInputsSpec;

describe("the canonical form of resolved inputs", () => {
  const zodiac = {
    aries: { symbol: "♈︎", no: 1 },
    taurus: { symbol: "♉︎", no: 2 },
  };
  const one = sources({ zodiac });

  it("names the encoding, every table, every row and every field", () => {
    expect(
      resolveDataInputs(
        spec({ table: "zodiac" as never, rows: "*", fields: ["symbol"] }),
        one,
      ),
    ).toBe(
      `${IMAGE_INPUTS_PROFILE}\nzodiac\n\t"aries"\n\t\t"symbol"=s"♈︎"\n\t"taurus"\n\t\t"symbol"=s"♉︎"\n`,
    );
  });

  it("keeps the table's own row order, which components draw by position", () => {
    const reordered = sources({
      zodiac: { taurus: zodiac.taurus, aries: zodiac.aries },
    });
    const group = spec({
      table: "zodiac" as never,
      rows: "*",
      fields: ["symbol"],
    });
    expect(resolvedInputsHash(group, reordered)).not.toBe(
      resolvedInputsHash(group, one),
    );
  });

  it("changes when a row is renamed, even though no value moved", () => {
    const renamed = sources({
      zodiac: { aries: zodiac.aries, bull: zodiac.taurus },
    });
    const group = spec({
      table: "zodiac" as never,
      rows: "*",
      fields: ["symbol"],
    });
    expect(resolvedInputsHash(group, renamed)).not.toBe(
      resolvedInputsHash(group, one),
    );
  });

  it("reads a listed row set in the order the spec gives", () => {
    const group = (...rows: string[]) =>
      spec({ table: "zodiac" as never, rows, fields: ["symbol"] });
    expect(resolvedInputsHash(group("aries", "taurus"), one)).not.toBe(
      resolvedInputsHash(group("taurus", "aries"), one),
    );
    expect(resolvedInputsHash(group("aries"), one)).not.toBe(
      resolvedInputsHash(group("aries", "aries"), one),
    );
  });

  it("tells an absent field from a value that spells itself", () => {
    const absent = resolveDataInputs(
      spec({ table: "t" as never, rows: ["a"], fields: ["x"] }),
      sources({ t: { a: {} } }),
    );
    const present = resolveDataInputs(
      spec({ table: "t" as never, rows: ["a"], fields: ["x"] }),
      sources({ t: { a: { x: "undefined" } } }),
    );
    const nulled = resolveDataInputs(
      spec({ table: "t" as never, rows: ["a"], fields: ["x"] }),
      sources({ t: { a: { x: null } } }),
    );
    expect(absent).toContain('"x"=undefined');
    expect(present).toContain('"x"=s"undefined"');
    expect(nulled).toContain('"x"=null');
    expect(new Set([absent, present, nulled]).size).toBe(3);
  });

  it("sorts object keys, keeps array order, and separates the scalars", () => {
    const text = (value: unknown) =>
      resolveDataInputs(
        spec({ table: "t" as never, rows: ["a"], fields: ["x"] }),
        sources({ t: { a: { x: value } } }),
      );
    expect(text({ b: 1, a: 2 })).toBe(text({ a: 2, b: 1 }));
    expect(text([1, 2])).not.toBe(text([2, 1]));
    expect(text([["a"], ["b"]])).toContain('"x"=[[s"a"],[s"b"]]');
    expect(text(0)).not.toBe(text(-0));
    expect(text(true)).toContain('"x"=btrue');
    expect(text(1)).not.toBe(text("1"));
  });

  it("refuses a value it cannot write down, and a row that walks itself", () => {
    const field = spec({ table: "t" as never, rows: ["a"], fields: ["x"] });
    expect(() =>
      resolveDataInputs(field, sources({ t: { a: { x: () => 1 } } })),
    ).toThrow("Unhashable data input of type function");
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic.self = cyclic;
    expect(() =>
      resolveDataInputs(field, sources({ t: { a: { x: cyclic } } })),
    ).toThrow("Cyclic data input");
    // The same object twice is not a cycle; only an enclosing one is.
    const shared = { he: "א" };
    expect(() =>
      resolveDataInputs(
        field,
        sources({ t: { a: { x: { one: shared, two: shared } } } }),
      ),
    ).not.toThrow();
  });

  it("refuses a spec naming a table or a row the data does not have", () => {
    expect(() =>
      resolveDataInputs(
        spec({ table: "nope" as never, rows: "*", fields: [] }),
        one,
      ),
    ).toThrow("Unknown data input table nope");
    expect(() =>
      resolveDataInputs(
        spec({ table: "zodiac" as never, rows: ["nope"], fields: ["symbol"] }),
        one,
      ),
    ).toThrow("Unknown zodiac row nope");
  });
});

describe("what each registered component declares it draws", () => {
  it("names only tables the barrel and the tablets hold", () => {
    for (const slug of COMPONENT_IMAGE_SLUGS)
      for (const group of COMPONENT_IMAGE_REGISTRY[slug].inputs)
        expect(Object.hasOwn(DATA_INPUT_TABLES, group.table)).toBe(true);
  });

  // The other direction — that nothing a component draws is missing from its
  // spec — is the sweep in dataInputs.sweep.test.ts.
  it("moves every component's hash when any listed field changes", () => {
    for (const slug of COMPONENT_IMAGE_SLUGS) {
      const inputs = COMPONENT_IMAGE_REGISTRY[slug].inputs;
      const base = resolvedInputsHash(inputs);
      for (const group of inputs) {
        const table = DATA_INPUT_TABLES[group.table] as Record<string, unknown>;
        const ids = group.rows === "*" ? Object.keys(table) : group.rows;
        for (const id of ids)
          for (const field of group.fields) {
            const changed = structuredClone(
              DATA_INPUT_TABLES,
            ) as unknown as Record<string, Record<string, unknown>>;
            // dot-prop builds the intermediate objects, so a field that is
            // absent today — Da'at's soul, Keter's dash pattern — is still
            // proved to be read.
            setProperty(
              changed[group.table][id] as Record<string, unknown>,
              field,
              `swept ${slug} ${group.table}.${id}.${field}`,
            );
            expect(
              `${slug} ${group.table}.${id}.${field} ${resolvedInputsHash(
                inputs,
                sources(changed),
              )}`,
            ).not.toBe(`${slug} ${group.table}.${id}.${field} ${base}`);
          }
      }
    }
  }, 120_000);
});
