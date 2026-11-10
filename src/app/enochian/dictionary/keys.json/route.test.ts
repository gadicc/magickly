import { describe, expect, it } from "vitest";
import { dynamic, GET } from "./route";

describe("/enochian/dictionary/keys.json (plan 074, decision 9)", () => {
  it("is built once, as a static file", () => {
    expect(dynamic).toBe("force-static");
  });

  it("serves where the Keys say each word", async () => {
    const response = GET();
    expect(response.headers.get("content-type")).toContain("application/json");
    const uses = await response.json();
    expect(uses.OLPIRT[0]).toMatchObject({ key: 18, english: "light," });
    expect(uses.LIL[0]).toMatchObject({ key: 19, aethyr: 1 });
  });
});
