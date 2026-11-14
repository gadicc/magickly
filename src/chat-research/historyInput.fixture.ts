/** Synthetic protocol data only. This fixture is not a completed SQL job, source grant or dispatch capability. */
import { createHash } from "node:crypto";
import { createUuidV7 } from "../lib/ids";
import { prepareResearchEvidence } from "./answerProvenance";
import { RESEARCH_ARTIFACT_RETENTION_MS } from "./artifactRetention";
import { formatResearchHistoryCandidate } from "./historyCandidate";
import type { ResearchHistoryPreparation } from "./historyInput";
import {
  freezeResearchModelRequest,
  inspectFrozenResearchModelRequest,
  RESEARCH_MODEL_ID,
  RESEARCH_PROCESSOR_PROFILE,
} from "./modelRequest";
import {
  assertResearchQueryAnswer,
  prepareResearchQuery,
  projectResearchQueryAnswer,
} from "./query";
import { passageDraft, queryFixture } from "./query.fixture";
import {
  inspectResearchRequestArtifact,
  prepareResearchRequestArtifact,
} from "./requestArtifact";

export const historySha = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function historyInputFixture(
  now = Date.now(),
  options: Parameters<typeof queryFixture>[0] = {},
) {
  const base = queryFixture({
      ...options,
      question: "Synthetic original question?",
    }),
    parentEvidence = prepareResearchEvidence(base.catalog, {
      ...base.evidenceInput,
      expires_at_ms: now + 60000,
    }),
    parentQuery = prepareResearchQuery(parentEvidence, { mode: "passage" }),
    parent = {
      ...base,
      query: parentQuery,
      request: freezeResearchModelRequest(
        parentQuery,
        "019aa111-0000-7000-8000-000000000001",
      ),
    },
    original = inspectFrozenResearchModelRequest(parent.request),
    draft = passageDraft(),
    answer = assertResearchQueryAnswer(
      parent.query,
      projectResearchQueryAnswer(parent.query, original.answer_id, draft),
      draft,
    ),
    qualified = formatResearchHistoryCandidate(
      "Synthetic original question?",
      answer.payload,
    )!;
  const scope: ResearchHistoryPreparation["scope"] = {
    windowId: createUuidV7(),
    approvalSha256: historySha("synthetic-approval"),
    actorId: original.context.subject.user_id,
    corpusVersion: original.context.corpus_version,
    model: RESEARCH_MODEL_ID,
    processorProfile: RESEARCH_PROCESSOR_PROFILE,
    beginsAtMs: now - 1000,
    expiresAtMs: now + 3599000,
    maxRequests: 3,
    perRequestPico: 10000000000,
    totalPico: 30000000000,
  };
  const packet = inspectResearchRequestArtifact(
    prepareResearchRequestArtifact(
      parent.request,
      scope.windowId,
      createUuidV7(),
    ),
  );
  const candidate: ResearchHistoryPreparation["candidate"] = {
    ...qualified,
    window_id: scope.windowId,
    permit_id: createUuidV7(),
    answer_id: original.answer_id,
    mode: "passage",
    model: scope.model,
    processor_profile: scope.processorProfile,
    context: original.context,
    reserved_at_ms: now,
    retain_until_ms: now + RESEARCH_ARTIFACT_RETENTION_MS,
    retention_deadline: performance.now() + 60000,
    request_artifact_sha256: packet.packet_sha256,
    request_revision: original.request_revision,
    query_revision: original.query_revision,
    answer_sha256: historySha(JSON.stringify(answer.payload)),
    response_artifact_sha256: historySha(
      "synthetic-response-sidecar-not-a-completion",
    ),
    history_text_sha256: historySha(qualified.text),
  };
  const evidence = prepareResearchEvidence(parent.catalog, {
      ...parent.evidenceInput,
      question: "What does that mean?",
      expires_at_ms: now + 120000,
      subject: { ...parent.evidenceInput.subject, session_id: createUuidV7() },
    }),
    query = prepareResearchQuery(evidence, { mode: "passage" });
  const history: ResearchHistoryPreparation = { candidate, scope },
    childId = createUuidV7();
  const request = freezeResearchModelRequest(query, childId, history);
  return { parent, answer, original, history, query, childId, request };
}
