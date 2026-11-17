import { describe, expect, it } from "vitest";
import {
  batchTokens,
  conservativeTokens,
  embedWithinCap,
  listedPrice,
  refuseOverCap,
} from "./spend.ts";

const MODEL = "google/gemini-embedding-2";

describe("the paid run's price and cap (plan 081, S11)", () => {
  it("reads the model's price from the Gateway's listing", () => {
    const listing = {
      data: [
        { id: "other/model", pricing: { input: "0.000001" } },
        { id: MODEL, pricing: { input: "0.0000002" } },
      ],
    };
    expect(listedPrice(listing, MODEL)).toBe(0.0000002);
  });

  it("refuses a listing it can't read a positive price from", () => {
    for (const listing of [
      null,
      {},
      { data: "x" },
      { data: [{ id: MODEL }] },
      { data: [{ id: MODEL, pricing: { input: "free" } }] },
      { data: [{ id: MODEL, pricing: { input: "0" } }] },
      { data: [{ id: MODEL, pricing: { input: "-1" } }] },
    ])
      expect(() => listedPrice(listing, MODEL)).toThrow(/Cannot verify/);
  });

  it("refuses an estimate over the cap, or one that isn't a number", () => {
    expect(() => refuseOverCap(0.175)).not.toThrow();
    expect(() => refuseOverCap(0.25)).not.toThrow();
    expect(() => refuseOverCap(0.2501)).toThrow(/over the \$0.25 cap/);
    expect(() => refuseOverCap(Number.NaN)).toThrow(/cap/);
  });

  it("counts a reply without a usable token count at its conservative estimate", () => {
    expect(batchTokens(512, 900)).toBe(512);
    expect(batchTokens(0, 900)).toBe(0);
    for (const reported of [undefined, null, "512", Number.NaN, -1, Infinity])
      expect(batchTokens(reported, 900)).toBe(900);
    expect(conservativeTokens("abcd")).toBe(2);
    expect(conservativeTokens("abcde")).toBe(3);
  });
});

describe("embedding within the cap", () => {
  /** 200 inputs of 100 bytes: 50 tokens each, conservatively. */
  const inputs = Array.from({ length: 200 }, (_, at) =>
    String(at).padStart(100, "x"),
  );
  const reply = (batch: string[], tokens?: unknown) => ({
    embeddings: batch.map(() => [1, 0]),
    tokens,
  });

  it("embeds every batch when the counted spend stays under the cap", async () => {
    const kept: number[] = [];
    const result = await embedWithinCap({
      inputs,
      price: 1e-6,
      batchSize: 64,
      embed: async (batch) => reply(batch, batch.length * 10),
      keep: (batch, _, tokens) => kept.push(batch.length, tokens),
    });
    expect(kept).toEqual([64, 640, 64, 640, 64, 640, 8, 80]);
    expect(result).toEqual({ tokens: 2000, spent: 0.002 });
  });

  it("stops before a batch that could pass the cap, keeping what came before", async () => {
    const kept: string[][] = [];
    let calls = 0;
    // At $0.0001 a token a 64-input batch is $0.32 conservatively: with a
    // $0.50 cap the first is allowed; it reports 3,000 tokens ($0.30), so
    // the second, which could reach $0.62, is not.
    await expect(
      embedWithinCap({
        inputs,
        price: 1e-4,
        batchSize: 64,
        cap: 0.5,
        embed: async (batch) => {
          calls++;
          return reply(batch, 3000);
        },
        keep: (batch) => kept.push(batch),
      }),
    ).rejects.toThrow(
      /Stopped before passing the \$0.50 cap: \$0.3000 counted/,
    );
    expect(calls).toBe(1);
    expect(kept).toHaveLength(1);
  });

  it("counts missing token counts conservatively, so the stop still trips", async () => {
    let calls = 0;
    const counted: number[] = [];
    // Each batch of 10 is 500 tokens conservatively, $0.05 at $0.0001; the
    // cap allows three, and the fourth would pass it.
    await expect(
      embedWithinCap({
        inputs,
        price: 1e-4,
        batchSize: 10,
        cap: 0.16,
        embed: async (batch) => {
          calls++;
          return reply(batch, calls % 2 ? undefined : Number.NaN);
        },
        keep: (_, __, tokens) => counted.push(tokens),
      }),
    ).rejects.toThrow(/cap/);
    expect(counted).toEqual([500, 500, 500]);
    expect(counted.every(Number.isFinite)).toBe(true);
  });

  it("refuses a reply with the wrong number of vectors", async () => {
    await expect(
      embedWithinCap({
        inputs: inputs.slice(0, 3),
        price: 1e-6,
        embed: async () => ({ embeddings: [[1, 0]], tokens: 3 }),
        keep: () => {},
      }),
    ).rejects.toThrow(/wrong number/);
  });
});
