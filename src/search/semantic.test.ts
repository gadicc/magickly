import { beforeAll, describe, expect, it, vi } from "vitest";
import { GET as searchIndex } from "@/app/search/index/route";
import { buildSearchCatalogue } from "./catalogue";
import { embedSearchInputs } from "./embeddings/provider";
import { loadSemanticIndex, semanticAvailable } from "./embeddings/store";
import { searchSiteByMeaning } from "./semantic";

vi.mock("./embeddings/provider", () => ({ embedSearchInputs: vi.fn() }));

const PAGE = "/astrology/planetary-hours";

describe("published semantic index integration", () => {
  let index: NonNullable<Awaited<ReturnType<typeof loadSemanticIndex>>>;
  beforeAll(async () => {
    const loaded = await loadSemanticIndex();
    // Null only when no record has a row: a profile or recipe change with
    // no republish, never an ordinary content edit (plan 087).
    if (!loaded)
      throw new Error(
        "No search record has an embedding row: run search:publish",
      );
    index = loaded;
  });

  it("ranks by the covered records' own vectors, with the query profile", async () => {
    // The page's summary if it has a row, else any covered passage of it,
    // else any covered record: a content edit with no republish only
    // narrows the choice (plan 087, decision 2).
    const row = [
      index.records.findIndex((record) => record.id === `${PAGE}#page`),
      index.records.findIndex((record) => record.path === PAGE),
      0,
    ].find((at) => at >= 0)!;
    const record = index.records[row];
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
    // Lexical and dense both find the planetary hours page first; another
    // page found only by meaning still fuses near the top.
    if (record.path === PAGE) expect(results[0].path).toBe(PAGE);
    else
      expect(results.slice(0, 2).map(({ path }) => path)).toContain(
        record.path,
      );
    expect(embedSearchInputs).toHaveBeenCalledWith(
      index.profile,
      [index.profile.queryPrefix + "שעות פלנטריות"],
      signal,
    );
    expect(new Set(results.map((result) => result.path)).size).toBe(
      results.length,
    );
  });

  it("is advertised by /search/index exactly when /api/search serves it", async () => {
    // /api/search's available() is Boolean(await loadSemanticIndex()).
    const catalogue = await buildSearchCatalogue();
    expect(semanticAvailable(catalogue)).toBe(true);
    const body = (await (await searchIndex()).json()) as {
      semanticAvailable: boolean;
    };
    expect(body.semanticAvailable).toBe(Boolean(index));
  });
});
