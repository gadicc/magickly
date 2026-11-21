import { describe, expect, it } from "vitest";
import {
  DEFAULT_KAMEA_SIGIL,
  kameaSigilFromSearchParams,
  kameaSigilPagePath,
} from "./kameaSigilState";

const read = (query: string) =>
  kameaSigilFromSearchParams(new URLSearchParams(query));

describe("the kamea sigil generator's shared links", () => {
  it("opens Agiel on Saturn's square by default", () => {
    expect(read("")).toEqual(DEFAULT_KAMEA_SIGIL);
    expect(DEFAULT_KAMEA_SIGIL).toEqual({
      planet: "saturn",
      text: "אגיאל",
      finals: false,
    });
  });

  it("reads a planet, a text and finals as the image contract does", () => {
    expect(read("planet=luna&text= אלים  עד &finals=true")).toEqual({
      planet: "luna",
      text: "אלים עד",
      finals: true,
    });
    // A text alone is traced on the default's square.
    expect(read("text=זאזל")).toEqual({
      planet: "saturn",
      text: "זאזל",
      finals: false,
    });
    expect(read("planet=venus&text=הגיאל&finals=1").finals).toBe(false);
  });

  it("opens a planet's bare square for a text the contract refuses", () => {
    expect(read("planet=mars")).toEqual({
      planet: "mars",
      text: "",
      finals: false,
    });
    expect(read("planet=mars&text=Graphiel")).toEqual({
      planet: "mars",
      text: "",
      finals: false,
    });
    expect(read("planet=pluto&text=Graphiel")).toEqual(DEFAULT_KAMEA_SIGIL);
    expect(read("planet=constructor&text=א")).toEqual({
      planet: "saturn",
      text: "א",
      finals: false,
    });
  });

  it("writes the page link the state reads back", () => {
    const state = { planet: "luna" as const, text: "אלים", finals: true };
    const path = kameaSigilPagePath(state);
    expect(path).toBe(
      `/astrology/kamea/sigils?${new URLSearchParams({ planet: "luna", text: "אלים", finals: "true" })}`,
    );
    expect(read(path.split("?")[1])).toEqual(state);
    expect(
      kameaSigilPagePath({ planet: "sol", text: "סורת", finals: false }),
    ).not.toContain("finals");
  });
});
