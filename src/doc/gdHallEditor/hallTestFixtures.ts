import { readFileSync } from "node:fs";
import { parseRitualPug, RITUAL_PUG_HEADER } from "../ritualPug";
import type { HallElement } from "./hallModel";

/**
 * Test fixtures for the visual hall editor: the Neophyte hall of plan
 * 061's decision 3 as ritual source parses it (IDs on every node, the
 * comment in the floor kept as an annotation), and deterministic IDs.
 */

/** The Neophyte hall from `src/doc/fixtures/gdHallNeophyte.pug`. */
export function neophyteHall(): HallElement {
  const doc = parseRitualPug(
    `${RITUAL_PUG_HEADER}\n${readFileSync("src/doc/fixtures/gdHallNeophyte.pug", "utf8")}`,
  );
  const hall = doc.nodes.find(
    (node): node is HallElement =>
      node.kind === "element" && node.tag === "gdHall",
  );
  if (!hall) throw new Error("no hall in the fixture");
  return hall;
}

/** A hall from Pug lines (without the header). */
export function hallFromPug(...lines: string[]): HallElement {
  const [hall] = parseRitualPug(
    `${RITUAL_PUG_HEADER}\n${lines.join("\n")}\n`,
  ).nodes;
  if (hall?.kind !== "element" || hall.tag !== "gdHall")
    throw new Error("not a hall");
  return hall;
}

/** Valid ritual node IDs in sequence: `Test000000000001`, … */
export function sequentialIds(prefix = "Test"): () => string {
  let next = 0;
  return () => `${prefix}${String(++next).padStart(16 - prefix.length, "0")}`;
}

/** The element in a hall whose attributes match, depth first. */
export function findNode(
  hall: HallElement,
  match: (node: HallElement) => boolean,
): HallElement | undefined {
  if (match(hall)) return hall;
  for (const child of hall.children ?? [])
    if (child.kind === "element") {
      const found = findNode(child, match);
      if (found) return found;
    }
  return undefined;
}

/** The element with this role or kind (the first, depth first). */
export const byAttr = (hall: HallElement, name: string, value: unknown) =>
  findNode(hall, (node) => node.attrs[name] === value) as HallElement;
