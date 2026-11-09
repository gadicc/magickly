import { beforeAll, describe, expect, it, vi } from "vitest";
import { embedSearchInputs } from "./embeddings/provider";
import { loadSemanticIndex } from "./embeddings/store";
import { searchSiteByMeaning } from "./semantic";

vi.mock("./embeddings/provider", () => ({ embedSearchInputs: vi.fn() }));

describe("published semantic index integration", () => {
  let index: NonNullable<Awaited<ReturnType<typeof loadSemanticIndex>>>;
  beforeAll(async () => {
    const loaded = await loadSemanticIndex();
    if (!loaded)
      throw new Error(
        "Public search changed: refresh and publish its embedding artifact",
      );
    index = loaded;
  });
  it("loads a current content-matched, checksummed matrix and uses the same query profile", async () => {
    const row = index.records.findIndex(
      (record) => record.id === "/astrology/planetary-hours#page",
    );
    expect(row).toBeGreaterThanOrEqual(0);
    const vector = Array.from(
      index.vectors.slice(
        row * index.profile.dimensions,
        (row + 1) * index.profile.dimensions,
      ),
    );
    vi.mocked(embedSearchInputs).mockResolvedValueOnce({
      embeddings: [vector],
      tokens: 10,
    });
    const signal = new AbortController().signal;
    const results = await searchSiteByMeaning("שעות פלנטריות", signal);
    expect(results[0].path).toBe("/astrology/planetary-hours");
    expect(embedSearchInputs).toHaveBeenCalledWith(
      index.profile,
      [index.profile.queryPrefix + "שעות פלנטריות"],
      signal,
    );
    expect(new Set(results.map((result) => result.path)).size).toBe(
      results.length,
    );
  });
});
