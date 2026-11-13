/** Browser-safe summaries of one original private window, not conversation history or read authority. */
import * as v from "valibot";
import { validResearchAnswerId } from "./answer";
export const RESEARCH_ARCHIVE_BYTE_LIMIT = 256 * 1024;
export const RESEARCH_ARCHIVE_ERROR = "Private answer archive unavailable";
const id = v.pipe(
  v.string(),
  v.check((s) => validResearchAnswerId(s)),
);
const entry = v.strictObject({
  permit_id: id,
  answer_id: id,
  question: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(4000),
    v.check((s) => s.isWellFormed() && s.trim().length > 0),
  ),
  mode: v.picklist(["passage", "inventory", "comparison"]),
  input_kind: v.optional(v.picklist(["original_question", "follow_up"])),
  model_assessment: v.picklist(["supported", "partial", "insufficient"]),
  completed_at_ms: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
});
const shape = v.strictObject({
  contract: v.literal("magickli-private-research-archive"),
  schema_version: v.literal(1),
  scope: v.literal("original_private_research_window"),
  semantic_review: v.literal("unreviewed"),
  entries: v.pipe(v.array(entry), v.maxLength(10)),
});
export type ResearchAnswerArchive = v.InferOutput<typeof shape>;
export type ResearchArchiveEntry = ResearchAnswerArchive["entries"][number];
/** Own complete bounded metadata. IDs are correlation values, never ownership or access tokens. */
export function parseResearchAnswerArchive(
  input: unknown,
): ResearchAnswerArchive {
  try {
    if (
      new TextEncoder().encode(JSON.stringify(input)).byteLength >
      RESEARCH_ARCHIVE_BYTE_LIMIT
    )
      throw Error();
    const value = v.parse(shape, input);
    if (
      new Set(value.entries.map((e) => e.permit_id)).size !==
        value.entries.length ||
      new Set(value.entries.map((e) => e.answer_id)).size !==
        value.entries.length ||
      new TextEncoder().encode(JSON.stringify(value)).byteLength >
        RESEARCH_ARCHIVE_BYTE_LIMIT
    )
      throw Error();
    for (let i = 1; i < value.entries.length; i++) {
      const previous = value.entries[i - 1],
        next = value.entries[i];
      if (
        next.completed_at_ms > previous.completed_at_ms ||
        (next.completed_at_ms === previous.completed_at_ms &&
          next.permit_id > previous.permit_id)
      )
        throw Error();
    }
    return value;
  } catch {
    throw Error(RESEARCH_ARCHIVE_ERROR);
  }
}
