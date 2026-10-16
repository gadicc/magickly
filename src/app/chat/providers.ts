import { gateway } from "ai";
import { createPineconeCorpus } from "./corpus";
import type { ChatDependencies } from "./server";

/** Bill generation through Gateway while preserving the existing corpus. */
export async function chatDependencies(): Promise<ChatDependencies> {
  const corpus = createPineconeCorpus(
    process.env.PINECONE_INDEX_NAME ?? "",
    process.env.PINECONE_NAME_SPACE ?? "",
  );
  return { model: gateway("openai/gpt-6.1-sol"), retrieve: corpus.retrieve };
}
