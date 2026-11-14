/** Entirely synthetic Responses-format receipt; no provider call or source material. */
import { RESEARCH_MODEL_ID, RESEARCH_OUTPUT_TOKEN_LIMIT } from "./modelRequest";
import { passageDraft } from "./query.fixture";
export function gatewayResponseFixture() {
  return {
    object: "response",
    id: "gen_synthetic_receipt",
    status: "completed",
    error: null,
    incomplete_details: null,
    model: RESEARCH_MODEL_ID,
    service_tier: "default",
    store: false,
    background: false,
    max_output_tokens: RESEARCH_OUTPUT_TOKEN_LIMIT,
    reasoning: { effort: "high", summary: null },
    warnings: [],
    output: [
      { type: "reasoning", id: "rs_synthetic", summary: [] },
      {
        type: "message",
        id: "msg_synthetic",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(passageDraft()),
            annotations: [],
          },
        ],
      },
    ],
    usage: {
      input_tokens: 1000,
      output_tokens: 100,
      total_tokens: 1100,
      input_tokens_details: { cached_tokens: 50 },
      output_tokens_details: { reasoning_tokens: 30 },
    },
    provider_metadata: {
      openai: { serviceTier: "default", reasoningEffort: "high" },
      gateway: {
        cost: "0.003",
        generationId: "gen_synthetic_receipt",
        routing: {
          originalModelId: RESEARCH_MODEL_ID,
          canonicalSlug: RESEARCH_MODEL_ID,
          finalProvider: "openai",
          resolvedProvider: "openai",
          totalProviderAttemptCount: 1,
          modelAttemptCount: 1,
          fallbacksAvailable: [],
          modelAttempts: [
            {
              canonicalSlug: RESEARCH_MODEL_ID,
              success: true,
              providerAttemptCount: 1,
              providerAttempts: [
                { provider: "openai", success: true, credentialType: "system" },
              ],
            },
          ],
        },
      },
    },
  };
}
