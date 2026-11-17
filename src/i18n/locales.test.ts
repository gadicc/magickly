import { describe, expect, it } from "vitest";
import {
  localizedPath,
  matchLanguage,
  preferredLocale,
  privacyPath,
} from "./locales";
import { publicAlternates, publicEdition } from "./publications";
import { ROUTE_PLACEMENT } from "./routePlacement";

describe("locale policy", () => {
  it("negotiates only supported preferences, including regional language tags", () => {
    expect(matchLanguage("fr, he-IL;q=0.9,en;q=0.8")).toBe("he");
    expect(matchLanguage("he;q=0,en;q=0.8")).toBe("en");
    expect(matchLanguage("he;q=garbage,en")).toBe("en");
    expect(preferredLocale("he", "en")).toBe("he");
    expect(preferredLocale("invalid", "he")).toBe("he");
  });
  it("preserves existing sections and reserves the Hebrew namespace", () => {
    expect(localizedPath("/gd/rituals")).toEqual({
      locale: "en",
      path: "/gd/rituals",
    });
    expect(localizedPath("/he/about")).toEqual({
      locale: "he",
      path: "/about",
    });
    expect(
      Object.keys(ROUTE_PLACEMENT).some((p) => /^\/he(?:\/|$)/.test(p)),
    ).toBe(false);
    expect(privacyPath("/zz/he/temples/join/slug/password")).toBe(
      "/temples/join/slug/password",
    );
    expect(privacyPath("/gd/rituals")).toBe("/gd/rituals");
  });
  it("publishes only actual editions and shares their canonical alternates", () => {
    expect(publicEdition("/about", "he")).toBe("/he/about");
    expect(publicEdition("/temples", "he")).toBeNull();
    expect(publicEdition("/doc/private-id", "he")).toBeNull();
    expect(publicAlternates("/he/about")).toEqual({
      en: "/about",
      he: "/he/about",
      "x-default": "/about",
    });
  });
});
