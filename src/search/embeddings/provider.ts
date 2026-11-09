import { embedMany, gateway } from "ai";
import { type EmbeddingProfile, unitVector } from "./profiles";

/** Same Gateway authentication as chat; no provider keys or automatic retries. */
export async function embedSearchInputs(
  profile: EmbeddingProfile,
  values: string[],
  signal?: AbortSignal,
) {
  const result = await embedMany({
    model: gateway.embeddingModel(profile.model),
    values,
    dimensions: profile.dimensions,
    maxRetries: 0,
    maxParallelCalls: 1,
    abortSignal: signal,
  });
  if (result.embeddings.length !== values.length)
    throw new Error("Incomplete search embeddings");
  return {
    embeddings: result.embeddings.map((vector) =>
      unitVector(vector, profile.dimensions),
    ),
    tokens: result.usage.tokens,
  };
}
