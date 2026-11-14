/** Browser-safe question and prior-record hints only; validation creates no source or spending authority. */
import * as v from "valibot";
import { validResearchAnswerId } from "./answer";
export const RESEARCH_HTTP_BODY_BYTE_LIMIT = 32768;
export const RESEARCH_REQUEST_ERROR = "Private research request unavailable";
const shape = v.pipe(
  v.strictObject({
    question: v.pipe(
      v.string(),
      v.minLength(1),
      v.maxLength(4000),
      v.check((s) => s.isWellFormed() && s.trim().length > 0),
    ),
    mode: v.picklist(["passage", "inventory", "comparison"]),
    expected_catalog_revision: v.optional(
      v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$(?![\s\S])/)),
    ),
    previous_answer: v.optional(
      v.strictObject({
        permit_id: v.pipe(
          v.string(),
          v.check((s) => validResearchAnswerId(s)),
        ),
        expected_answer_id: v.pipe(
          v.string(),
          v.check((s) => validResearchAnswerId(s)),
        ),
      }),
    ),
    source_book_handles: v.optional(
      v.pipe(
        v.array(
          v.pipe(
            v.string(),
            v.check((s) => /^book([1-9]|[12][0-9]|3[0-2])$/.exec(s)?.[0] === s),
          ),
        ),
        v.maxLength(2),
        v.check((a) => new Set(a).size === a.length),
      ),
      [],
    ),
  }),
  v.check((body) =>
    body.source_book_handles.length > 0
      ? body.expected_catalog_revision !== undefined
      : body.expected_catalog_revision === undefined,
  ),
  v.check((body) =>
    body.mode === "inventory"
      ? body.source_book_handles.length === 0
      : body.mode !== "passage" || body.source_book_handles.length <= 1,
  ),
);
/** Question and local resolution hints only. Raw history, resource URLs, identities, model and policy are never accepted. */
export type ResearchQuestion = v.InferOutput<typeof shape>;
/** Copy a strictly bounded, owned plain request. The server repeats validation independently. */
export function parseResearchQuestion(input: unknown): ResearchQuestion {
  try {
    // The 4,000 UTF-16-unit question, two fixed handles and optional UUID hints encode below the
    // 32 KiB HTTP cap even when every character needs six JSON escape bytes.
    return v.parse(shape, input);
  } catch {
    throw Error(RESEARCH_REQUEST_ERROR);
  }
}
