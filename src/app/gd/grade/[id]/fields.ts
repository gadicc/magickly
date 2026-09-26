import type { EntityFields } from "@/components/entity/fields";

/** The grade page's row, as [Grade.tsx](./Grade.tsx) lays it out. */
export const fields: EntityFields = {
  table: "gdGrade",
  shown: [
    // The heading's numbers, "Theoricus 2=9".
    "id",
    // The heading, and the key the Ritual row is found by.
    "name",
    "orderId",
    "degree",
    "sephirah",
    "planet",
    "element",
    "next",
    "prev",
  ],
  omitted: [
    // Each is shown through its link's accessor, which holds the row itself:
    // `element`, `planet`, `sephirah`, `degree`, `next` and `prev`.
    "elementId",
    "planetId",
    "sephirahId",
    "degreeId",
    "nextId",
    "prevId",
  ],
};
