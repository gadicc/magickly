import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeVectorArtifact,
  parseVectorArtifact,
  VECTOR_ARTIFACT,
} from "./embeddings/artifact";
import { decodeRow } from "./embeddings/rowBytes";

// Hoisted, so the factories hand every fresh import (vi.resetModules) the
// same functions.
const mocks = vi.hoisted(() => ({ embed: vi.fn(), reserve: vi.fn() }));
vi.mock("./embeddings/provider", () => ({ embedSearchInputs: mocks.embed }));
vi.mock("./usage", () => ({ reserveSearchUsage: mocks.reserve }));

/**
 * `/search/index` and `/api/search` follow one coverage rule (plan 087):
 * meaning search is available when the selected profile's artifact covers
 * at least one record. Each case writes an artifact derived from the real
 * one into a scratch root that both routes read through `process.cwd()`.
 */
const real = parseVectorArtifact(
  readFileSync(join(process.cwd(), VECTOR_ARTIFACT)),
);
const row = (i: number) =>
  real.matrix.subarray(i * real.dimensions * 4, (i + 1) * real.dimensions * 4);
const variants: [name: string, bytes: () => Buffer, available: boolean][] = [
  [
    "every row",
    () =>
      encodeVectorArtifact(
        real.profile,
        real.dimensions,
        real.keys.map((key, i) => [key, row(i)] as const),
      ),
    true,
  ],
  [
    "half the rows",
    () =>
      encodeVectorArtifact(
        real.profile,
        real.dimensions,
        real.keys.flatMap((key, i) => (i % 2 ? [] : [[key, row(i)] as const])),
      ),
    true,
  ],
  [
    "no rows",
    () => encodeVectorArtifact(real.profile, real.dimensions, []),
    false,
  ],
  [
    "another profile's rows",
    () =>
      encodeVectorArtifact(
        "another-profile",
        real.dimensions,
        real.keys.map((key, i) => [key, row(i)] as const),
      ),
    false,
  ],
];

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "magickli-search-availability-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.resetModules();
  mocks.reserve.mockReset().mockResolvedValue({
    allowed: true,
    resetAt: new Date("2026-11-24T00:00:00Z"),
  });
  mocks.embed.mockReset().mockResolvedValue({
    embeddings: [Array.from(decodeRow(row(0), real.dimensions))],
    tokens: 1,
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe("meaning search availability", () => {
  it.each(variants)(
    "agrees between /search/index and /api/search with %s",
    async (_name, bytes, available) => {
      mkdirSync(join(root, VECTOR_ARTIFACT, ".."), { recursive: true });
      writeFileSync(join(root, VECTOR_ARTIFACT), bytes());
      const index = await import("@/app/search/index/route");
      const api = await import("@/app/api/search/route");
      const body = (await (await index.GET()).json()) as {
        semanticAvailable: boolean;
      };
      expect(body.semanticAvailable).toBe(available);
      const response = await api.POST(
        new Request("https://magick.test/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "planetary hours" }),
        }),
      );
      expect(response.status).toBe(available ? 200 : 503);
      // Unavailable spends no quota and makes no provider call.
      expect(mocks.reserve).toHaveBeenCalledTimes(available ? 1 : 0);
      expect(mocks.embed).toHaveBeenCalledTimes(available ? 1 : 0);
    },
  );

  it("treats a missing artifact as an error in both, not as unavailable", async () => {
    const index = await import("@/app/search/index/route");
    const api = await import("@/app/api/search/route");
    await expect(index.GET()).rejects.toThrow(/ENOENT/);
    const response = await api.POST(
      new Request("https://magick.test/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "planetary hours" }),
      }),
    );
    // http.ts answers any failure with the same 503, before any quota.
    expect(response.status).toBe(503);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
});
