import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Zodiac from "./zodiac";

describe("the zodiac table", () => {
  const html = renderToString(<Zodiac />);

  it("gives each sign's dates as days of the year, each on one line", () => {
    expect(html).toContain("21\u00a0March – 19\u00a0April");
    expect(html).toContain("22\u00a0December – 19\u00a0January");
    expect(html).not.toContain("[[");
  });

  it("calls Taurus the Bull", () => {
    expect(html).toMatch(/>Bull</);
  });
});
