/** Synthetic-only request artifact fixtures; no private corpus, credentials, rows or network. */
import { ANSWER_ID } from "./answer.fixture";
import { prepareResearchEvidence } from "./answerProvenance";
import { freezeResearchModelRequest } from "./modelRequest";
import { prepareResearchQuery } from "./query";
import { queryFixture } from "./query.fixture";
export function artifactRequestFixture(
  expiresAtMs = Date.now() + 60000,
  question = "Synthetic question?",
) {
  const f = queryFixture({ question });
  const evidence = prepareResearchEvidence(f.catalog, {
    ...f.evidenceInput,
    expires_at_ms: expiresAtMs,
  });
  const query = prepareResearchQuery(evidence, f.mode),
    request = freezeResearchModelRequest(query, ANSWER_ID);
  return { ...f, evidence, query, request };
}
