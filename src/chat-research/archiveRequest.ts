/** Store-side original labels only. Parsed bytes are not completion, ownership or source authority. */
import "server-only";
import * as v from "valibot";
import { parseBoundedResearchJson } from "./boundedJson";
import { readResearchHistoryMessages } from "./historyInput";
import { RESEARCH_REQUEST_BYTE_LIMIT } from "./modelRequest";
import { parseResearchQuestion } from "./request";

function labels(bodyJson: string) {
  try {
    const body = v.parse(
      v.object({ input: v.string() }),
      parseBoundedResearchJson(bodyJson, RESEARCH_REQUEST_BYTE_LIMIT),
    );
    const input = parseBoundedResearchJson(
        body.input,
        RESEARCH_REQUEST_BYTE_LIMIT,
      ),
      packet = v.parse(
        v.object({
          schema_version: v.picklist([1, 2]),
          question: v.unknown(),
          mode: v.unknown(),
          history: v.unknown(),
        }),
        input,
      );
    if (packet.schema_version === 1)
      v.parse(v.pipe(v.array(v.unknown()), v.length(0)), packet.history);
    else readResearchHistoryMessages(input);
    const display = parseResearchQuestion({
      question: packet.question,
      mode: packet.mode,
    });
    return {
      question: display.question,
      mode: display.mode,
      input_kind:
        packet.schema_version === 1
          ? ("original_question" as const)
          : ("follow_up" as const),
    };
  } catch {
    throw Error("Private answer archive unavailable");
  }
}
/** Call only after actual paired validation. Preserve the original label-only API. */
export function readResearchArchiveQuestion(bodyJson: string) {
  const { input_kind: _kind, ...display } = labels(bodyJson);
  return display;
}
/** Original-input fact only, never permission to use it. A future history request must revalidate the actual pair and source rights. */
export function readResearchArchiveSummary(bodyJson: string) {
  return labels(bodyJson);
}
/** First follow-up version admits only an original single-turn parent; never flatten or recursively trust a chain. */
export function readResearchOriginalHistoryQuestion(bodyJson: string) {
  const value = labels(bodyJson);
  if (value.input_kind !== "original_question")
    throw Error("Private research history candidate unavailable");
  const { input_kind: _kind, ...display } = value;
  return display;
}
