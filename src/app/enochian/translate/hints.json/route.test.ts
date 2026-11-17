import { describe, expect, it } from "vitest";
import table from "../hints/table.json";
import { dynamic, GET } from "./route";

describe("/enochian/translate/hints.json (plan 081, S11)", () => {
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
