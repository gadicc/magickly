import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODEL_LIST_URL } from "@/app/enochian/translate/reading/priceCheck";

const purge = vi.hoisted(() => vi.fn());
vi.mock("@/db/neonFull", () => ({ db: { marker: "db" } }));
vi.mock("@/app/enochian/translate/reading/purge", () => ({
  purgeReadings: purge,
}));

const { GET, runtime } = await import("./route");

const call = (authorization?: string) =>
  GET(
    new Request("http://127.0.0.1/api/cron/purge-readings", {
      headers: authorization ? { authorization } : {},
    }),
  );

/** The Gateway's model list as it stood on 15 November 2026, for Terra. */
const terra = {
  id: "openai/gpt-6.1-terra",
  pricing: {
    input: "0.000001",
    output: "0.000005",
    input_cache_read: "0.00000005",
    input_cache_write: "0.00000125",
    input_tiers: [
      { cost: "0.000001", min: 0, max: 272001 },
      { cost: "0.000002", min: 272001 },
    ],
  },
};
const listing = vi.fn();

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "local-cron-secret");
  purge.mockReset().mockResolvedValue({ readings: 2, spend: 1, usage: 7 });
  listing.mockReset().mockResolvedValue(Response.json({ data: [terra] }));
  // No network: the model list is faked.
  vi.stubGlobal("fetch", listing);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the readings' daily job (plan 081, S4, S7 and S10)", () => {
  it("is a node route", () => {
    expect(runtime).toBe("nodejs");
  });

  it("never runs unconfigured or unauthorised", async () => {
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call()).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer local-cron-secret")).status).toBe(503);
    expect(purge).not.toHaveBeenCalled();
    expect(listing).not.toHaveBeenCalled();
  });

  it("deletes, checks the prices and answers with counts", async () => {
    const response = await call("Bearer local-cron-secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      readings: 2,
      spend: 1,
      usage: 7,
      prices: "ok",
    });
    expect(purge.mock.calls[0][0]).toEqual({ marker: "db" });
    expect(listing.mock.calls[0][0]).toBe(MODEL_LIST_URL);
  });

  it("fails loudly when the listed prices drift from the ceiling's", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    listing.mockResolvedValue(
      Response.json({
        data: [{ ...terra, pricing: { ...terra.pricing, output: "0.000006" } }],
      }),
    );
    const response = await call("Bearer local-cron-secret");
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      readings: 2,
      prices: "drift",
    });
    expect(error).toHaveBeenCalledWith(
      "purge-readings: the reading's prices drifted (output: listed 6, assumed 5)",
    );
  });

  it("fails loudly when the prices can't be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    listing.mockResolvedValue(new Response("down", { status: 502 }));
    const response = await call("Bearer local-cron-secret");
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ prices: "unavailable" });
    expect(error).toHaveBeenCalledWith(
      "purge-readings: the reading's prices could not be checked (HTTP 502)",
    );
  });

  it("logs a failed deletion's class only", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    purge.mockRejectedValue(new TypeError("row VORSG SONF"));
    const response = await call("Bearer local-cron-secret");
    expect(response.status).toBe(500);
    expect(error).toHaveBeenCalledWith(
      "purge-readings: run failed (TypeError)",
    );
  });
});
