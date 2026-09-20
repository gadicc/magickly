import "server-only";
import { createHash } from "node:crypto";
import data from "@/../data/data";
import enochianTablet from "@/../data/enochian/Tablets";
import { readFieldPath } from "@/components/kabbalah/fieldPath";

/**
 * Hashing the data an image draws, so that a data edit moves the identity of
 * exactly the images it can change (plan 032, decision 10).
 *
 * A per-table content hash would re-identify every published Tree when a
 * `scent` typo is fixed. What is hashed here instead is the *resolved* value
 * of each field the component actually reads: the same dotted paths the
 * render passes to [readFieldPath](../components/kabbalah/fieldPath.ts),
 * resolved over the assembled barrel. Because links are resolved before
 * hashing, an edit two hops away is covered without naming the table it is
 * in — repointing `sephirah.keter.archangelId` changes the resolved
 * `archangel.name.he` the Tree prints, and so changes the hash.
 */

/**
 * The canonical form below. It is part of every rendered image's identity, so
 * it changes only when the *encoding* changes — never because the data did.
 */
export const IMAGE_INPUTS_PROFILE = "magickli-image-inputs-v1";

/**
 * The tables a spec may read: the barrel, plus the one table a registered
 * component draws that the barrel leaves out. `enochianTablet` is named in no
 * link in either direction, so the barrel does not assemble it
 * ([data.ts](../../data/data.ts)) and its rows are the raw JSON either way.
 */
export const DATA_INPUT_TABLES = { ...data, enochianTablet };

/** A table a component may declare inputs from. */
export type DataInputTable = keyof typeof DATA_INPUT_TABLES;

/**
 * Rows of one table, by id; the shape a spec is resolved against. Two tables
 * are arrays rather than objects, and their row "ids" are the indices.
 */
export type DataInputRows =
  | Readonly<Record<string, unknown>>
  | readonly unknown[];
export type DataInputSources = Readonly<Record<string, DataInputRows>>;

/** One table's contribution to a component's inputs. */
export interface DataInputGroup {
  readonly table: DataInputTable;
  /**
   * `"*"` is every row in the table's own key order, which is an input
   * wherever a component draws `Object.values(...)` positionally. A list is
   * for a component that names its rows in code.
   */
  readonly rows: "*" | readonly string[];
  /** Dotted paths, read exactly as the render reads them. */
  readonly fields: readonly string[];
}

/** Everything one registered component draws from the data. */
export type DataInputsSpec = readonly DataInputGroup[];

/**
 * A value's canonical text. Object keys are sorted so that a re-ordering of a
 * row's keys is not a change; array order is kept, because it is drawn.
 * `undefined` (an absent key, or a link that resolved to nothing) is written,
 * not dropped as `JSON.stringify` would drop it, so it is distinct from a
 * field whose value is the string `"undefined"`.
 */
function encode(value: unknown, seen: Set<object>): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return `s${JSON.stringify(value)}`;
    case "number":
      // -0 and 0 are the same JSON number; keep them apart anyway.
      return `n${Object.is(value, -0) ? "-0" : String(value)}`;
    case "boolean":
      return `b${value}`;
    case "object":
      break;
    default:
      throw new Error(`Unhashable data input of type ${typeof value}`);
  }
  const object = value as object;
  // A spec names leaf fields; a whole assembled row would walk the graph.
  if (seen.has(object)) throw new Error("Cyclic data input");
  seen.add(object);
  try {
    if (Array.isArray(object))
      return `[${object.map((item) => encode(item, seen)).join(",")}]`;
    const entries = Object.keys(object)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${encode(
            (object as Record<string, unknown>)[key],
            seen,
          )}`,
      );
    return `{${entries.join(",")}}`;
  } finally {
    seen.delete(object);
  }
}

/**
 * The canonical text a spec resolves to. Groups, rows and fields keep the
 * order the spec and the data give them; every row is named, so renaming a
 * key is a change even when no value moved.
 */
export function resolveDataInputs(
  spec: DataInputsSpec,
  sources: DataInputSources = DATA_INPUT_TABLES,
): string {
  const lines: string[] = [IMAGE_INPUTS_PROFILE];
  for (const group of spec) {
    const rows = sources[group.table] as
      | Readonly<Record<string, unknown>>
      | undefined;
    if (!rows) throw new Error(`Unknown data input table ${group.table}`);
    lines.push(`${group.table}`);
    const ids = group.rows === "*" ? Object.keys(rows) : group.rows;
    for (const id of ids) {
      if (!Object.hasOwn(rows, id))
        throw new Error(`Unknown ${group.table} row ${id}`);
      const row = rows[id];
      lines.push(`\t${JSON.stringify(id)}`);
      for (const field of group.fields)
        lines.push(
          `\t\t${JSON.stringify(field)}=${encode(
            readFieldPath(row, field),
            new Set(),
          )}`,
        );
    }
  }
  return `${lines.join("\n")}\n`;
}

/** SHA-256 of [the canonical text](#resolveDataInputs); an image's `inputs.sha256`. */
export function resolvedInputsHash(
  spec: DataInputsSpec,
  sources?: DataInputSources,
): string {
  return createHash("sha256")
    .update(resolveDataInputs(spec, sources))
    .digest("hex");
}
