import { describe, expect, it, vi } from "vitest";
import { checkListedPrices } from "./priceCheck.ts";

const pricing = {
  input: "0.000001",
  output: "0.000005",
  input_cache_read: "0.00000005",
  input_cache_write: "0.00000125",
  input_tiers: [
    { cost: "0.000001", min: 0, max: 272001 },
    { cost: "0.000002", min: 272001 },
  ],
};
const list = (data: unknown) =>
  vi.fn<typeof fetch>(async () => Response.json({ data }));

describe("the daily price check (plan 081, S10)", () => {
  it("agrees with the prices the ceiling assumes", async () => {
    expect(
      await checkListedPrices(
        list([
          { id: "other", pricing: {} },
          { id: "openai/gpt-6.1-terra", pricing },
        ]),
      ),
    ).toEqual({ state: "ok" });
  });

  it("reads numbers given as numbers or as numeric strings", async () => {
    const asNumbers = {
      input: 0.000001,
      output: 0.000005,
      input_cache_read: 0.00000005,
      input_cache_write: 0.00000125,
      input_tiers: [{ cost: 0.000001, min: 0, max: 272001 }],
    };
    const asStrings = {
      ...pricing,
      input_tiers: [{ cost: "0.000001", min: "0", max: "272001" }],
    };
    for (const one of [asNumbers, asStrings])
      expect(
        await checkListedPrices(
          list([{ id: "openai/gpt-6.1-terra", pricing: one }]),
        ),
      ).toEqual({ state: "ok" });
    // Text that isn't a number is still a drift.
    expect(
      await checkListedPrices(
        list([
          {
            id: "openai/gpt-6.1-terra",
            pricing: {
              ...pricing,
              output: "five",
              input_tiers: [{ max: "lots" }],
            },
          },
        ]),
      ),
    ).toEqual({
      state: "drift",
      drift: [
        "output: listed none, assumed 5",
        "input tier: listed below lots, assumed 272001",
      ],
    });
  });

  it("names every price that drifted", async () => {
    const drifted = {
      ...pricing,
      input: "0.0000011",
      input_cache_write: undefined,
      input_tiers: [{ cost: "0.000001", min: 0, max: 200001 }],
    };
    expect(
      await checkListedPrices(
        list([{ id: "openai/gpt-6.1-terra", pricing: drifted }]),
      ),
    ).toEqual({
      state: "drift",
      drift: [
        "input: listed 1.1, assumed 1",
        "input_cache_write: listed none, assumed 1.25",
        "input tier: listed below 200001, assumed 272001",
      ],
    });
  });

  it("drifts when the model is gone, and is unavailable when the list is", async () => {
    expect(await checkListedPrices(list([]))).toEqual({
      state: "drift",
      drift: ["openai/gpt-6.1-terra not listed"],
    });
    expect(
      await checkListedPrices(
        vi.fn(async () => new Response("", { status: 503 })),
      ),
    ).toEqual({ state: "unavailable", error: "HTTP 503" });
    expect(
      await checkListedPrices(
        vi.fn(async () => {
          throw new TypeError("fetch failed");
        }),
      ),
    ).toEqual({ state: "unavailable", error: "TypeError" });
  });
});
