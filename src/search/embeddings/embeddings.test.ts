import { describe, expect, it } from "vitest";
import { EMBEDDING_PROFILES, embeddingInput, unitVector } from "./profiles";
import { fuseSearchResults, rankVectors } from "./rank";
import {
  type EmbeddingRecord,
  embeddingCacheKey,
  embeddingDocumentInput,
  embeddingRowKey,
} from "./records";

describe("embedding compatibility and ranking", () => {
  it("separates model/recipe/input cache keys and query/document instructions", () => {
    const profile = EMBEDDING_PROFILES[0];
    const input = embeddingInput(profile, "document", "text", "Title");
    expect(input).toBe("title: Title | text: text");
    expect(embeddingInput(profile, "query", "text")).not.toBe(input);
    const key = embeddingCacheKey(profile, input);
    expect(embeddingCacheKey({ ...profile, dimensions: 128 }, input)).not.toBe(
      key,
    );
    expect(embeddingCacheKey({ ...profile, revision: "next" }, input)).not.toBe(
      key,
    );
    expect(embeddingCacheKey(profile, input + "changed")).not.toBe(key);
  });
  it("keeps the shipped profile's row keys (golden; plan 087)", () => {
    // A changed key here strands every committed row under search-vectors/:
    // the recipe, the profile object and the hash must all stay as they are.
    const profile = EMBEDDING_PROFILES.find(
      (entry) => entry.key === "gemini-embedding-2-768-search-v1",
    )!;
    const page = {
      title: "Planetary hours",
      section: "",
      text: "Each hour of the day is ruled by a planet.",
    };
    const passage = {
      title: "Planetary hours",
      section: "Calculating the hours",
      text: "Divide the daylight into twelve.",
    };
    expect(embeddingDocumentInput(profile, page)).toBe(
      "title: Planetary hours | text: Each hour of the day is ruled by a planet.",
    );
    expect(embeddingDocumentInput(profile, passage)).toBe(
      "title: Planetary hours · Calculating the hours | text: Divide the daylight into twelve.",
    );
    expect(embeddingRowKey(profile, page)).toBe(
      "736ebb2e2d805c7090c68023a122274ed3e4feaed844c06e4dd9ab449af48f63",
    );
    expect(embeddingRowKey(profile, passage)).toBe(
      "74b21a4dbd6521fe51a6cb9c0c44844e905aad0beb40032d0e24dbcc664efbb2",
    );
  });
  it("rejects invalid vectors and normalizes returned dimensions", () => {
    expect(unitVector([3, 4], 2)).toEqual([0.6, 0.8]);
    for (const vector of [[1], [0, 0], [NaN, 1], [Infinity, 1]])
      expect(() => unitVector(vector, 2)).toThrow();
  });
  it("ranks exact cosine neighbors and groups passages by page", () => {
    const record = (id: string, path: string): EmbeddingRecord => ({
      id,
      path,
      title: path,
      section: id,
      text: "excerpt",
      href: path + "#" + id,
    });
    const records = [
      record("a", "/one"),
      record("b", "/two"),
      record("c", "/one"),
    ];
    const results = rankVectors(
      records,
      new Float32Array([1, 0, 0, 1, 0.8, 0.6]),
      [1, 0],
      "query",
    );
    expect(results.map((result) => result.path)).toEqual(["/one", "/two"]);
    expect(results[0].href).toBe("/one#a");
    expect(() =>
      rankVectors(records, new Float32Array([1]), [1, 0], "query"),
    ).toThrow();
    const fused = fuseSearchResults(
      [{ ...results[1], score: 110, exactTitle: true, match: "page" }],
      results,
    );
    expect(fused[0].path).toBe("/two");
  });
});
