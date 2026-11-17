/**
 * The meaning spike's winning recipe for gap hints (plan 081, S11),
 * "similarity/bare": the bare English word and each gloss embedded with
 * the same sentence-similarity prompt by the site's embedding model, the
 * word's best gloss by cosine, and how far that best stands out, as a
 * z-score against the word's similarity to every gloss.
 */
import { createHash } from "node:crypto";
import {
  EMBEDDING_PROFILES,
  type EmbeddingProfile,
} from "../../src/search/embeddings/profiles.ts";

/** The model and prompt a vector was made with. */
export interface HintRecipe {
  /** Names the recipe in the table and the gloss hash. */
  id: string;
  profile: EmbeddingProfile;
  /** Put before every text, word or gloss alike (a symmetric task). */
  prefix: string;
}

const PROFILE = EMBEDDING_PROFILES.find(
  (one) => one.key === "gemini-embedding-2-768-search-v1",
);
if (!PROFILE) throw new Error("The site's embedding profile is missing");

/**
 * The site's embedding model and dimensions (plan 070) with the
 * sentence-similarity prompt of its prompt family, which the spike
 * found better than search's asymmetric one for a word against a gloss.
 */
export const HINT_RECIPE: HintRecipe = {
  id: `${PROFILE.model}/${PROFILE.dimensions}/${PROFILE.revision}/similarity-bare-v1`,
  profile: PROFILE,
  prefix: "task: sentence similarity | query: ",
};

/** The text sent to the model for a word or a gloss. */
export const embeddingText = (recipe: HintRecipe, text: string) =>
  recipe.prefix + text;

/**
 * A vector's cache key: the exact input and everything about the model
 * that makes a vector, as site search keys its cache.
 */
export function cacheKey(recipe: HintRecipe, input: string): string {
  const { model, revision, dimensions, normalization } = recipe.profile;
  return createHash("sha256")
    .update(JSON.stringify([model, revision, dimensions, normalization, input]))
    .digest("hex");
}

/** A word's best gloss: its index, cosine and z-score. */
export interface Best {
  gloss: number;
  cosine: number;
  z: number;
}

/**
 * The best of `count` gloss vectors (unit length, `dimensions` each, end
 * to end in `glosses`) for a unit query vector, and its z-score: the
 * best cosine less the mean of all, over their standard deviation (the
 * population's, as the spike computed it).
 */
export function bestGloss(
  query: Float32Array,
  glosses: Float32Array,
  dimensions: number,
): Best {
  const count = glosses.length / dimensions;
  if (!count) throw new Error("No glosses to compare");
  let best = 0;
  let top = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let squares = 0;
  for (let row = 0; row < count; row++) {
    let dot = 0;
    const at = row * dimensions;
    for (let i = 0; i < dimensions; i++) dot += query[i] * glosses[at + i];
    sum += dot;
    squares += dot * dot;
    if (dot > top) {
      top = dot;
      best = row;
    }
  }
  const mean = sum / count;
  const sd = Math.sqrt(Math.max(0, squares / count - mean * mean)) || 1;
  return { gloss: best, cosine: top, z: (top - mean) / sd };
}
