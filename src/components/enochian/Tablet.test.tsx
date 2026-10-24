import { createHash } from "node:crypto";
import tablets, { tabletVersion } from "magick-data/enochian/tablets";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Tablet, {
  EquinoxSigils,
  Sigils,
  tabletName,
  tabletViewBox,
  UNION_VIEWBOX,
  WATCHTOWER_VIEWBOX,
} from "./Tablet";

const draw = (
  id: string,
  enochian = false,
  frame = true,
  label: boolean | string = true,
) =>
  renderToStaticMarkup(
    <Tablet
      id={id}
      enochianStyle={enochian ? { fontFamily: "Enochian" } : undefined}
      frame={frame}
      width={210}
      height={297}
      label={label}
    />,
  );

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

/** The letters drawn, in order, not counting a note in the sigil's place. */
const letters = (markup: string) =>
  [
    ...markup
      .replace(/<g data-sigil-note="">.*?<\/g>/g, "")
      .matchAll(/<text[^>]*>([^<]*)<\/text>/g),
  ].map((match) => match[1]);

describe("Tablet", () => {
  // Earth and Air in the Golden Dawn's version, the default since the
  // versions came (plan 061, "Tablet versions"); unnamed (`label={false}`),
  // as the hall and the image route draw them. Until then they drew
  // Raphael's 1587 letters with capital Ps (431f2c1b…, 47076de7…,
  // 5dce9c66…, 070a31f9…; 2a3099a8…, 9a45aad1…, 16975aae…, 3005bd54…,
  // hashed on main before stage G, bd26b64): only their letters and
  // mirroring moved, as the tests below read them.
  it.each([
    [
      "earth",
      false,
      true,
      "f178668e5b9e20242c1441b59b0c1d6ef978b4329e00d39773724ee5c303a7e3",
    ],
    [
      "earth",
      false,
      false,
      "e2cd835e9c5ca2ec8d4e1e3d52e310a836a1bcb1f8ef0d14a9b6bf925ec6dd8d",
    ],
    [
      "earth",
      true,
      true,
      "1b742202cca7180caa298e8dc7eb013dda61121bee82895a34a6463be7d2c55f",
    ],
    [
      "earth",
      true,
      false,
      "5d047bcf70775ffc79ce745119e6d7c3f7413604ce68739df454547c7ce8d297",
    ],
    [
      "air",
      false,
      true,
      "8b12dffcf86b0c9553c1b3f629eca465981dd771a455fe7ed189c788598e9faf",
    ],
    [
      "air",
      false,
      false,
      "657b0c6f35931f955bdb6a47dd95116082fe92df58472703ca8c18925eec9f4d",
    ],
    [
      "air",
      true,
      true,
      "c597afb22b7138fd0b6d37cd8a516e31f104f81beab78c85a1940fa293d092b6",
    ],
    [
      "air",
      true,
      false,
      "a14408e150da608907af43cff9f552700f81169d7f3edca402c64fc57476105f",
    ],
  ] as const)(
    "draws %s (Enochian %s, frame %s) as it did",
    (id, enochian, frame, hash) => {
      expect(sha256(draw(id, enochian, frame, false))).toBe(hash);
    },
  );

  it("names each tablet as an image, and is unnamed when told", () => {
    const named = {
      earth: "Enochian Watchtower of Earth",
      air: "Enochian Watchtower of Air",
      water: "Enochian Watchtower of Water",
      fire: "Enochian Watchtower of Fire",
      union: "Tablet of Union",
      spirit: "Enochian tablet",
    };
    for (const [id, name] of Object.entries(named)) {
      expect(tabletName(id)).toBe(name);
      const markup = draw(id);
      expect(markup).toMatch(
        new RegExp(`^<svg [^>]*role="img" aria-label="${name}"`),
      );
      // No <title>: it would show a tooltip over every square.
      expect(markup).not.toContain("<title>");
      expect(draw(id, false, true, "Shown here")).toContain(
        'aria-label="Shown here"',
      );
      const unnamed = draw(id, false, true, false);
      expect(unnamed).not.toContain("aria-label");
      expect(unnamed).not.toContain('role="img"');
    }
  });

  it.each(["water", "fire"])(
    "draws %s's sigil above its 13 rows of 12",
    (id) => {
      const markup = draw(id);
      expect(markup).toContain(`viewBox="${WATCHTOWER_VIEWBOX.join(" ")}"`);
      expect(letters(markup)).toHaveLength(156);
      // The sigil is its own <svg> inside the page, before the grid's.
      const sigil = renderToStaticMarkup(Sigils[id]());
      expect(markup).toContain(sigil);
      expect(markup.indexOf(sigil)).toBeLessThan(markup.lastIndexOf("<text"));
    },
  );

  it("draws the Golden Dawn's letters by default", () => {
    const grid = (id: "earth" | "air") =>
      (tabletVersion(tablets[id], "gd")?.grid ?? []).flat().join("");
    for (const id of ["earth", "air"] as const)
      expect(letters(draw(id)).join("")).toBe(grid(id));
    expect(letters(draw("earth")).slice(84, 96).join("")).toBe("RCanchiisomt");
  });

  it("draws the sigils from geometry alone", () => {
    for (const Sigil of Object.values(Sigils)) {
      const markup = renderToStaticMarkup(<Sigil />);
      expect(markup).not.toMatch(/<text|<image|href=|id=/);
    }
  });

  it("mirrors the letters the data prints reversed, and only those", () => {
    const mirrored = (markup: string) =>
      [
        ...markup.matchAll(
          /<text[^>]*transform="[^"]*scale\(-1 1\)"[^>]*>([^<]*)</g,
        ),
      ].map((match) => match[1]);
    expect(mirrored(draw("water"))).toEqual(["N", "L"]);
    expect(mirrored(draw("fire"))).toEqual(["P", "A"]);
    expect(mirrored(draw("earth"))).toEqual(["R", "A"]);
    expect(mirrored(draw("air"))).toEqual(["O", "A"]);
    // Mirrored about its own square's centre: Fire's last row, seventh square.
    expect(draw("fire")).toContain('transform="translate(264 0) scale(-1 1)"');
  });

  it("draws the Tablet of Union on its own page, a line to an element", () => {
    const markup = draw("union");
    expect(tabletViewBox("union")).toBe(UNION_VIEWBOX);
    expect(markup).toContain(`viewBox="${UNION_VIEWBOX.join(" ")}"`);
    expect(letters(markup).join("")).toBe("EXARPHCOMANANTABITOM");
    // No sigil; each line in its element's colour, white squares.
    expect(markup).not.toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100',
    );
    for (const colour of ["#d4a000", "#2255cc", "black", "#e22"])
      expect(markup).toContain(`fill:${colour}`);
    expect(draw("union", true)).toContain("font-family:Enochian");
  });

  it("outlines the squares it is given, the selected one more boldly", () => {
    const markup = renderToStaticMarkup(
      <Tablet
        id="water"
        highlights={{
          squares: [
            { row: 4, column: 11 },
            { row: 0, column: 5 },
          ],
          selected: { row: 0, column: 5 },
        }}
      />,
    );
    expect(markup.match(/data-square=/g)).toHaveLength(2);
    expect(markup).toContain(
      'data-square="4,11" x="223" y="83" width="18" height="18"',
    );
    expect(markup).toMatch(/data-square="0,5"[^>]*stroke-width:3/);
    expect(markup).toMatch(/data-square="4,11"[^>]*stroke-dasharray:3 2/);
    expect(draw("water")).not.toContain("data-square");
  });

  it("draws an empty page for a key the data does not have", () => {
    for (const id of ["spirit", "constructor", "__proto__", ""]) {
      const markup = draw(id);
      expect(tabletViewBox(id)).toBe(WATCHTOWER_VIEWBOX);
      expect(markup).not.toContain("<text");
      expect(markup).not.toContain("<rect");
    }
  });

  describe("in a version", () => {
    const drawIn = (
      id: string,
      version: string,
      options: { reversed?: boolean; alt?: boolean } = {},
    ) =>
      renderToStaticMarkup(
        <Tablet id={id} version={version} frame={false} {...options} />,
      );
    const mirrored = (markup: string) =>
      [
        ...markup.matchAll(
          /<text[^>]*transform="[^"]*scale\(-1 1\)"[^>]*>([^<]*)</g,
        ),
      ].map((match) => match[1]);
    const grid = (id: "fire" | "water", version: string) =>
      (tabletVersion(tablets[id], version)?.grid ?? [])
        .flat()
        .filter((letter) => letter !== null)
        .join("");
    const corner = (markup: string) =>
      [...markup.matchAll(/<text[^>]*data-alt=""[^>]*>([^<]*)</g)].map(
        (match) => match[1],
      );

    it("draws its letters, leaving an empty square blank", () => {
      for (const version of ["gd", "regardie", "equinox", "dee", "raphael"])
        expect(letters(drawIn("fire", version)).join(""), version).toBe(
          grid("fire", version),
        );
      // Dee's two empty Fire squares draw no letter at all.
      expect(letters(drawIn("fire", "dee"))).toHaveLength(154);
      expect(drawIn("fire", "nonesuch")).toBe(drawIn("fire", "gd"));
    });

    it("draws Regardie's sigils, the Equinox's, or none", () => {
      for (const id of ["earth", "air", "water", "fire"] as const) {
        const regardie = renderToStaticMarkup(Sigils[id]());
        const equinox = renderToStaticMarkup(EquinoxSigils[id]());
        expect(regardie).not.toBe(equinox);
        expect(drawIn(id, "gd")).toContain(regardie);
        expect(drawIn(id, "regardie")).toContain(regardie);
        expect(drawIn(id, "equinox")).toContain(equinox);
        // In black alone, as the Equinox prints them.
        expect(equinox).not.toMatch(/#(?!000)[0-9a-f]{3}\b/);
        for (const version of ["dee", "raphael"]) {
          const markup = drawIn(id, version);
          expect(markup).not.toContain('viewBox="-100 -100 200 200"');
          // A note in the sigil's place says why there is none.
          expect(markup).toContain("data-sigil-note");
          expect(markup).toContain("Sigillum Dei Aemeth");
        }
        for (const version of ["gd", "regardie", "equinox"])
          expect(drawIn(id, version)).not.toContain("data-sigil-note");
      }
    });

    it("mirrors its own reversed letters, unless told not to", () => {
      expect(mirrored(drawIn("water", "equinox"))).toEqual(["N", "L"]);
      expect(mirrored(drawIn("water", "regardie"))).toEqual([]);
      expect(mirrored(drawIn("water", "dee"))).toEqual(["N", "L"]);
      expect(mirrored(drawIn("earth", "dee"))).toEqual(["R", "A"]);
      expect(mirrored(drawIn("earth", "raphael"))).toEqual(["a"]);
      expect(mirrored(drawIn("fire", "raphael"))).toEqual(["p", "a"]);
      for (const version of ["gd", "equinox", "dee", "raphael"])
        expect(mirrored(drawIn("water", version, { reversed: false }))).toEqual(
          [],
        );
    });

    it("draws second letters small in a corner when asked", () => {
      expect(corner(drawIn("water", "gd"))).toEqual([]);
      const water = drawIn("water", "gd", { alt: true });
      const marks = tabletVersion(tablets.water, "gd")?.marks ?? [];
      expect(corner(water)).toEqual(
        marks.filter((mark) => mark.alt).map((mark) => mark.alt?.join("")),
      );
      expect(corner(water)).toContain("ylh");
      // The squares' own letters are drawn as before.
      expect(
        letters(water.replace(/<text[^>]*data-alt=""[^>]*>[^<]*<\/text>/g, "")),
      ).toEqual(letters(drawIn("water", "gd")));
      // Row 5, square 12's corner: the top right of its square.
      expect(water).toMatch(
        /<text x="240.5" y="88" data-alt="" style="font-size:6px;text-anchor:end[^"]*">ylh</,
      );
      // Dee's empty Fire squares show Raphael's letters there.
      expect(corner(drawIn("fire", "dee", { alt: true }))).toEqual(
        expect.arrayContaining(["a", "v"]),
      );
      expect(corner(drawIn("water", "equinox", { alt: true }))).toEqual([]);
    });

    it("names a version other than the Golden Dawn's", () => {
      expect(tabletName("fire", "dee")).toBe(
        "Enochian Watchtower of Fire, Dee's table of 1584",
      );
      expect(tabletName("fire", "gd")).toBe("Enochian Watchtower of Fire");
      expect(tabletName("spirit", "dee")).toBe("Enochian tablet");
      expect(
        renderToStaticMarkup(<Tablet id="air" version="equinox" />),
      ).toContain(
        'aria-label="Enochian Watchtower of Air, the Equinox&#x27;s version"',
      );
    });

    it("says so on the page of a tablet the version lacks", () => {
      for (const [version, name] of [
        ["dee", "Dee's table of 1584"],
        ["raphael", "Raphael's table of 1587"],
      ]) {
        const markup = drawIn("union", version);
        expect(markup).toContain(`viewBox="${UNION_VIEWBOX.join(" ")}"`);
        expect(markup).toContain("data-missing");
        expect(letters(markup)).toEqual([
          "No Tablet of Union",
          `in ${name.replace("'", "&#x27;")}`,
        ]);
      }
      expect(letters(drawIn("union", "equinox")).join("")).toBe(
        "EXARPHCOMANANTABITOM",
      );
    });
  });
});
