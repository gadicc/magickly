import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./sameOrigin";

describe("the same-origin guard (plan 081, S5)", () => {
  const request = (headers: Record<string, string>) =>
    new Request("https://magick.ly/api/enochian/read", {
      method: "POST",
      headers,
    });

  it("takes this site's own pages", () => {
    expect(isSameOrigin(request({ "sec-fetch-site": "same-origin" }))).toBe(
      true,
    );
    expect(
      isSameOrigin(request({ origin: "https://magick.ly", host: "magick.ly" })),
    ).toBe(true);
  });

  it("refuses others, and a browser that says it is cross-site", () => {
    const cases: Record<string, string>[] = [
      {},
      { "sec-fetch-site": "cross-site" },
      { "sec-fetch-site": "same-site" },
      { "sec-fetch-site": "none" },
      { "sec-fetch-site": "cross-site", origin: "https://magick.ly" },
      { origin: "https://magick.ly.example", host: "magick.ly" },
      { origin: "http://magick.ly:8080", host: "magick.ly" },
      { origin: "null", host: "magick.ly" },
      // The Origin matches the URL, but not the Host the request was made to.
      { origin: "https://magick.ly" },
      { origin: "https://magick.ly", host: "elsewhere.example" },
      // A forwarded host a client sent is never trusted.
      {
        origin: "https://elsewhere.example",
        host: "magick.ly",
        "x-forwarded-host": "elsewhere.example",
      },
    ];
    for (const headers of cases)
      expect(isSameOrigin(request(headers))).toBe(false);
  });
});
