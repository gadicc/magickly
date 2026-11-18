import { describe, expect, it } from "vitest";
import { sigilFromSearchParams } from "./sigilState";

describe("shared sigil links", () => {
  it("restores validated text and the rose setting", () => {
    expect(
      sigilFromSearchParams(new URLSearchParams("text=שלום&rose=false")),
    ).toEqual({ text: "שלומ", rose: false, version: "gd" });
    expect(sigilFromSearchParams(new URLSearchParams("text=גדי"))).toEqual({
      text: "גדי",
      rose: true,
      version: "gd",
    });
  });

  it("restores the rose's version, and ignores one it does not have", () => {
    expect(
      sigilFromSearchParams(
        new URLSearchParams("text=כתר&version=regardie1939"),
      ),
    ).toEqual({ text: "כתר", rose: true, version: "regardie1939" });
    for (const version of ["regardie", "gd", ""])
      expect(
        sigilFromSearchParams(
          new URLSearchParams(`text=כתר&version=${version}`),
        ),
      ).toEqual({ text: "כתר", rose: true, version: "gd" });
  });

  it("restores several words, as the image contract keeps them", () => {
    expect(
      sigilFromSearchParams(new URLSearchParams("text=יהוה  אלהים")),
    ).toEqual({ text: "יהוה אלהימ", rose: true, version: "gd" });
  });

  it("falls back to the page default for missing or invalid text", () => {
    for (const query of ["", "rose=false", "text=", "text=abc", "text=a&x=1"])
      expect(sigilFromSearchParams(new URLSearchParams(query))).toEqual({
        text: "גדי",
        rose: true,
        version: "gd",
      });
    // Unrelated keys such as campaign tags do not invalidate the shared text.
    expect(sigilFromSearchParams(new URLSearchParams("text=א&x=1"))).toEqual({
      text: "א",
      rose: true,
      version: "gd",
    });
  });
});
