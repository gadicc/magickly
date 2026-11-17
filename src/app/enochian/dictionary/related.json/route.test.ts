import { describe, expect, it } from "vitest";
import table from "../related/table.json";
import { dynamic, GET } from "./route";

describe("/enochian/dictionary/related.json (plan 081, S11, step 2G)", () => {
  it("is built once, as a static file", () => {
    expect(dynamic).toBe("force-static");
  });

  it("serves the committed table, compact", async () => {
    const response = GET();
    expect(response.headers.get("content-type")).toContain("application/json");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual(table);
    expect(text).not.toContain("\n");
  });
});
