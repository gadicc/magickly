import keys from "magick-data/enochian/keys";
import { describe, expect, it } from "vitest";
import { dynamic, GET } from "./route";

describe("/enochian/translate/keys.json (plan 081, decision 19)", () => {
  it("is built once, as a static file", () => {
    expect(dynamic).toBe("force-static");
  });

  it("serves every row of every Key, slim", async () => {
    const response = GET();
    expect(response.headers.get("content-type")).toContain("application/json");
    const table = await response.json();
    expect(table.keys.map((one: { key: number }) => one.key)).toEqual(
      keys.map((one) => one.key),
    );
    expect(table.keys[0].rows[0]).toEqual(["OL", "OL", "I"]);
    // ZOL: Crowley joins it to SOBRA.
    expect(table.keys[0].rows[10]).toEqual(["ZOL", "", "hands", "j"]);
    expect(table.aethyrs[0]).toEqual(["LIL", "LIL"]);
    expect(table.aethyrs).toHaveLength(30);
  });
});
