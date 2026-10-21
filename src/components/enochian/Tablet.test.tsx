import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Tablet, {
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

/** The letters drawn, in order. */
const letters = (markup: string) =>
  [...markup.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);

describe("Tablet", () => {
  // Earth and Air drew these bytes before the Water, Fire and Union tablets
  // came (plan 061, stage G): hashed from the same calls on main before
  // stage G (bd26b64). Without its accessible name (`label={false}`, as the
  // hall and the image route draw it) a tablet still draws exactly them.
  it.each([
    [
      "earth",
      false,
      true,
      "431f2c1b17ae1bb2e4201faf299200c213c807c33beb4c92de87f838cb263d43",
    ],
    [
      "earth",
      false,
      false,
      "47076de76f70a300f343b664e8b3ded13f7c55837519a633d5627b96e965b4e0",
    ],
    [
      "earth",
      true,
      true,
      "5dce9c66ff91064cbc0282e5a21d736d9405ee5365d5df36855926f07f93861c",
    ],
    [
      "earth",
      true,
      false,
      "070a31f9cf6ceac53994983a9faf23c865a7675fb0ec15107f59b9ffd9f55f7d",
    ],
    [
      "air",
      false,
      true,
      "2a3099a8193e06cceca00a72822c6d7d9bda8e733a66029f7ea6c3620c74b2e3",
    ],
    [
      "air",
      false,
      false,
      "9a45aad1fca2e60bc73bcff10037fd732ab4231b09c7c3c6fc90ea3eff04c99c",
    ],
    [
      "air",
      true,
      true,
      "16975aaedf4a723d3f2616b04b5a43ea537c6c16ce82cec78b992af8866504ac",
    ],
    [
      "air",
      true,
      false,
      "3005bd541135a93ee3c7c783c6fac4f84ff4d579ab392efe42f3a84a15671a61",
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
    expect(mirrored(draw("earth"))).toEqual([]);
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
});
