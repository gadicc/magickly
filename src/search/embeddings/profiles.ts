/** Everything that defines a compatible embedding space and input recipe. */
export interface EmbeddingProfile {
  key: string;
  model: string;
  revision: string;
  dimensions: number;
  normalization: "l2";
  chunker: "words-180-overlap-24-v1";
  queryPrefix: string;
  documentPrefix: string;
}

// Hosted APIs expose model IDs, not weight commit hashes. Bump our recipe
// revision if the provider/model/preprocessing contract changes.
export const EMBEDDING_PROFILES: EmbeddingProfile[] = [
  {
    key: "gemini-embedding-2-768-search-v1",
    model: "google/gemini-embedding-2",
    revision: "gateway-2026-11-09-v1",
    dimensions: 768,
    normalization: "l2",
    chunker: "words-180-overlap-24-v1",
    queryPrefix: "task: search result | query: ",
    documentPrefix: "title: {title} | text: ",
  },
  {
    key: "qwen3-embedding-06b-1024-search-v1",
    model: "alibaba/qwen3-embedding-0.6b",
    revision: "gateway-2026-11-09-v1",
    dimensions: 1024,
    normalization: "l2",
    chunker: "words-180-overlap-24-v1",
    queryPrefix:
      "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery:",
    documentPrefix: "{title}\n",
  },
];

export function embeddingInput(
  profile: EmbeddingProfile,
  role: "query" | "document",
  text: string,
  title = "",
): string {
  return (
    (role === "query"
      ? profile.queryPrefix
      : profile.documentPrefix.replace("{title}", title)) + text
  );
}

/** Reject provider mismatch/nonfinite/zero vectors rather than ranking garbage. */
export function unitVector(
  vector: readonly number[],
  dimensions: number,
): number[] {
  if (
    vector.length !== dimensions ||
    vector.some((value) => !Number.isFinite(value))
  )
    throw new Error("Incompatible embedding vector");
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || !norm)
    throw new Error("Invalid embedding norm");
  return vector.map((value) => value / norm);
}
