import { describe, expect, it } from "vitest";
import { sameOriginPath } from "./sameOriginPath";

describe("a path on this site", () => {
  it.each([
    "/gd/halls/neophyte",
    "/pics/candidate-hexagram.svg",
    "/a?b=c#d",
    // Percent-encoded slashes and backslashes are not separators.
    "/%2f/evil.example/",
    "/%5c/evil.example/",
  ])("accepts %j", (href) => expect(sameOriginPath(href)).toBe(true));

  it.each([
    "/\t/evil.example/",
    "/\n/evil.example/",
    "/\r/evil.example/",
    " /gd/halls",
    "/gd/ halls",
    "/\u007f",
    "/\\evil.example/",
    "/gd\\halls",
    "//evil.example/",
    "https://evil.example/",
    "javascript:alert(1)",
    "data:text/html,x",
    "gd/halls",
    "",
    undefined,
    7,
  ])("refuses %j", (href) => expect(sameOriginPath(href)).toBe(false));
});
