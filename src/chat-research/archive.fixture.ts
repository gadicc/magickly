/** Synthetic saved metadata only; no private history, corpus or permission. */
import type { ResearchAnswerArchive } from "./archive";
export function archiveFixture(count = 1): ResearchAnswerArchive {
  return {
    contract: "magickli-private-research-archive",
    schema_version: 1,
    scope: "original_private_research_window",
    semantic_review: "unreviewed",
    entries: Array.from({ length: count }, (_, i) => ({
      permit_id: "019aa111-0000-7000-8000-" + String(i + 10).padStart(12, "0"),
      answer_id: "019aa111-0000-7000-8000-" + String(i + 1).padStart(12, "0"),
      question: "Saved synthetic question " + (i + 1),
      mode: "passage" as const,
      model_assessment: "partial" as const,
      completed_at_ms: 1700000000000 - i * 1000,
    })),
  };
}
