import type { EntityFields } from "@/components/entity/fields";

/** The sephirah page's row, as [Sephirah.tsx](./Sephirah.tsx) lays it out. */
export const fields: EntityFields = {
  table: "sephirah",
  shown: [
    // The lede's ordinal: "the sixth Sephirah".
    "index",
    "name.he",
    "name.roman",
    "name.en",
    "tenHeavens.he",
    "tenHeavens.roman",
    "tenHeavens.en",
    // The four worlds, Atziluth to Assiah.
    "godName",
    "archangel",
    "angelicOrder",
    "planet",
    // The two swatches: each scale's colour, its web colour and its text's.
    "color.king",
    "color.kingWeb",
    "color.kingWebText",
    "color.queen",
    "color.queenWeb",
    "color.queenWebText",
    "soul",
    "chakra",
    "body",
    "stone",
    "scent",
    "gdGrade",
    // The Paths list.
    "pathsFrom",
    "pathsTo",
    // The arrows and the nav; with neither, the sphere is the hidden one.
    "next",
    "prev",
  ],
  omitted: [
    // The route's own key, which the links and the Tree's `active` carry.
    "id",
    // The links' ids: the rows they name are shown through their accessors.
    "chakraId",
    "godNameId",
    "planetId",
    "archangelId",
    "soulId",
    "angelicOrderId",
    "gdGradeId",
    "nextId",
    "prevId",
    // A slug for the Tree's body labels; the Body row says it in words.
    "bodyPos",
    // Da'at's dashed outline on the Tree, which is drawing, not a colour.
    "color.strokeColor",
    "color.strokeDasharray",
  ],
};
