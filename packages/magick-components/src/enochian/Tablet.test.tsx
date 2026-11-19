import { createHash } from "node:crypto";
import tablets, { tabletVersion } from "magick-data/enochian/tablets";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Tablet, {
  REGION_TINTS,
  regionFromPosition,
  type TabletHighlights,
  tabletGround,
  tabletName,
  tabletViewBox,
  UNION_VIEWBOX,
  WATCHTOWER_VIEWBOX,
} from "./Tablet.tsx";
import { EquinoxSigils, Sigils } from "./tabletSigils.tsx";
import { TabletSvg } from "./tabletSvg.tsx";

const draw = (
  id: string,
  enochian = false,
  frame = true,
  label?: string | false,
) =>
  renderToStaticMarkup(
    <Tablet
      tablet={id}
      enochianStyle={enochian ? { fontFamily: "Enochian" } : undefined}
      frame={frame}
      width={210}
      height={297}
      label={label}
    />,
  );

/** A tablet as the hall's art draws it: the drawing alone, unnamed. */
const drawPlain = (id: string, enochian: boolean, frame: boolean) =>
  renderToStaticMarkup(
    <TabletSvg
      tablet={id}
      enochianStyle={enochian ? { fontFamily: "Enochian" } : undefined}
      frame={frame}
      width={210}
      height={297}
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
  // versions came (plan 061, "Tablet versions"); unnamed, as the hall
  // draws them (`TabletSvg`) and the image route serves them (`label={false}`
  // with its `aria-hidden` taken off; hashed as `label={false}` until
  // that marked the tablet decorative). Until then they drew
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
    // Air's four moved when its sigil was redrawn after the Equinox's
    // Plate X, in place of two fonts' glyphs (plan 080, "The sigils'
    // sources"); 8b12dffc…, 657b0c6f…, c597afb2… and a14408e1… before.
    // They moved again when its four Yods were refined to the plate's
    // slim lozenges (plan 080, "The sigils' sources"); 924e6792…,
    // d56aa4ee…, 0c0c0214… and b92ebc33… before, the Yods' paths alone;
    // again when the lozenges became the plate's sinuous flames:
    // f2376705…, f89ff742…, 11a0bb4f… and 2b0bc2ed… before; and again when
    // the flames' left sides and lower ends were brought closer to the
    // plate: 78e363ff…, adc7e8f1…, a0de5c79… and d37c4131… before.
    [
      "air",
      false,
      true,
      "6c91cf57accac61ff2a8474db7071b27f166ca728ed7b38a314789f129508cf5",
    ],
    [
      "air",
      false,
      false,
      "97bd1a3ee76de7b982d5fcc6981b69ffd4083217be8cb1103a2b6aad5ee33136",
    ],
    [
      "air",
      true,
      true,
      "00f7cadf159da1cac960ba0db71869161ef161c7b5b4ae5d842cabe79208ed13",
    ],
    [
      "air",
      true,
      false,
      "213aad4e19ab14304423ffa24e0ce8a598486541b1c367651b1334be75c2e834",
    ],
  ] as const)(
    "draws %s (Enochian %s, frame %s) as it did",
    (id, enochian, frame, hash) => {
      expect(sha256(drawPlain(id, enochian, frame))).toBe(hash);
      // label={false} is the same drawing, marked decorative.
      expect(draw(id, enochian, frame, false)).toBe(
        drawPlain(id, enochian, frame).replace(
          /^(<svg [^>]*)>/,
          '$1 aria-hidden="true">',
        ),
      );
    },
  );

  it("draws no frame unless asked", () => {
    expect(renderToStaticMarkup(<Tablet tablet="earth" />)).not.toContain(
      "border",
    );
    expect(renderToStaticMarkup(<Tablet tablet="earth" frame />)).toContain(
      'style="border:1px solid black"',
    );
  });

  it("names each tablet as an image, and is decorative when told", () => {
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
      expect(draw(id, false, true, undefined)).toBe(markup);
      expect(draw(id, false, true, "Shown here")).toContain(
        'aria-label="Shown here"',
      );
      const unnamed = draw(id, false, true, false);
      expect(unnamed).not.toContain("aria-label");
      expect(unnamed).not.toContain('role="img"');
      expect(unnamed).toMatch(/^<svg [^>]*aria-hidden="true"/);
    }
  });

  it.each(["water", "fire"] as const)(
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
    for (const color of ["#d4a000", "#2255cc", "black", "#e22"])
      expect(markup).toContain(`fill:${color}`);
    expect(draw("union", true)).toContain("font-family:Enochian");
  });

  it("outlines the squares it is given, the selected one more boldly", () => {
    const markup = renderToStaticMarkup(
      <Tablet
        tablet="water"
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
      options: { mirrorReversed?: boolean; showSecondLetters?: boolean } = {},
    ) =>
      renderToStaticMarkup(
        <Tablet tablet={id} version={version} {...options} />,
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

    // The Equinox's Air sigil, drawn after its Plate X (plan 080, "The
    // sigils' sources"), which the hashes above, all in the Golden Dawn's
    // version, do not reach. e2793a22… before its Yods were refined, then
    // 74105d5e… before they became sinuous flames, then f885fbfd… before
    // the flames' left sides and lower ends were brought closer to the
    // plate (the Yods' paths alone moved each time).
    it("draws the Equinox's Air sigil as it did", () => {
      expect(sha256(renderToStaticMarkup(EquinoxSigils.air()))).toBe(
        "bd8082f1abbe2af49d82e33057433433d71c437e53b282061c2780b3f0b04070",
      );
    });

    it("mirrors its own reversed letters, unless told not to", () => {
      expect(mirrored(drawIn("water", "equinox"))).toEqual(["N", "L"]);
      expect(mirrored(drawIn("water", "regardie"))).toEqual([]);
      expect(mirrored(drawIn("water", "dee"))).toEqual(["N", "L"]);
      expect(mirrored(drawIn("earth", "dee"))).toEqual(["R", "A"]);
      expect(mirrored(drawIn("earth", "raphael"))).toEqual(["a"]);
      expect(mirrored(drawIn("fire", "raphael"))).toEqual(["p", "a"]);
      for (const version of ["gd", "equinox", "dee", "raphael"])
        expect(
          mirrored(drawIn("water", version, { mirrorReversed: false })),
        ).toEqual([]);
    });

    it("draws second letters small in a corner when asked", () => {
      expect(corner(drawIn("water", "gd"))).toEqual([]);
      const water = drawIn("water", "gd", { showSecondLetters: true });
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
      expect(
        corner(drawIn("fire", "dee", { showSecondLetters: true })),
      ).toEqual(expect.arrayContaining(["a", "v"]));
      expect(
        corner(drawIn("water", "equinox", { showSecondLetters: true })),
      ).toEqual([]);
    });

    it("names a version other than the Golden Dawn's", () => {
      expect(tabletName("fire", "dee")).toBe(
        "Enochian Watchtower of Fire, Dee's table of 1584",
      );
      expect(tabletName("fire", "gd")).toBe("Enochian Watchtower of Fire");
      expect(tabletName("spirit", "dee")).toBe("Enochian tablet");
      expect(
        renderToStaticMarkup(<Tablet tablet="air" version="equinox" />),
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

describe("Tablet's highlight kinds", () => {
  // Earth's Laidrom, row 7 leftward from square 7 (counted from 1).
  const senior = Array.from({ length: 7 }, (_, step) => ({
    row: 6,
    column: 6 - step,
  }));
  /** Drawn with these highlights, and no squares outlined unless given. */
  const drawWith = (
    highlights: Omit<TabletHighlights, "squares"> & {
      squares?: TabletHighlights["squares"];
    },
    id = "earth",
  ) =>
    renderToStaticMarkup(
      <Tablet tablet={id} highlights={{ squares: [], ...highlights }} />,
    );
  /** A highlight's layer, up to the next one or the end. */
  const layer = (markup: string, kind: string) => {
    const start = markup.indexOf(`<g data-highlight="${kind}">`);
    if (start < 0) return "";
    const next = markup.indexOf("<g data-highlight=", start + 1);
    return markup.slice(start, next < 0 ? undefined : next);
  };

  it("leaves the drawing as it was when nothing is asked for", () => {
    for (const highlights of [
      { squares: [] },
      { squares: [], regions: false, name: undefined, preview: undefined },
      { squares: [], anySquare: true, onSelect: () => {} },
    ])
      expect(drawWith(highlights)).toBe(
        renderToStaticMarkup(<Tablet tablet="earth" />),
      );
  });

  it("dims every other square for a chosen name, outlines and flags it", () => {
    const markup = drawWith({ name: { squares: senior } });
    const chosen = layer(markup, "name");
    // One veil over the 149 other squares, as one path.
    const veil = chosen.match(
      /<path d="([^"]*)" style="fill:white;fill-opacity:0.72"/,
    );
    expect(veil?.[1].match(/M/g)).toHaveLength(156 - 7);
    expect(veil?.[1]).not.toContain("M102 122h20"); // row 7, square 6
    // Each square outlined in the dark violet, the first flagged.
    expect(chosen.match(/stroke:#4a0072;stroke-width:1.4/g)).toHaveLength(7);
    expect(chosen.match(/data-start=""/g)).toHaveLength(1);
    expect(chosen).toContain('d="M122.6 122.6h8L122.6 130.6Z"');
    // No numbers unless asked for.
    expect(chosen).not.toContain("data-order");
    // Over the letters, after the last square's.
    expect(markup.indexOf('data-highlight="name"')).toBeGreaterThan(
      markup.lastIndexOf("</text>", markup.indexOf('data-highlight="name"')),
    );
    expect(markup).not.toContain("dasharray");
  });

  it("numbers a chosen name's squares in its bottom left corners when asked", () => {
    const markup = drawWith({
      name: { squares: senior, numbers: senior.map((_, index) => index + 1) },
    });
    const numbers = [
      ...markup.matchAll(
        /<g data-order="(\d+)"><circle cx="([\d.]+)" cy="([\d.]+)"/g,
      ),
    ];
    expect(numbers.map((match) => Number(match[1]))).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    // Square 7 of row 7: x 122 to 142, y 122 to 142; the corner, not the
    // top right where second letters go.
    expect(numbers[0]?.slice(2).map(Number)).toEqual([126.8, 137.2]);
  });

  it("rings a previewed name without dimming the rest", () => {
    const markup = drawWith({ preview: { squares: senior } });
    const preview = layer(markup, "preview");
    expect(preview.match(/stroke:white;stroke-width:4/g)).toHaveLength(7);
    expect(preview.match(/stroke:#c0f;stroke-width:2.4/g)).toHaveLength(7);
    expect(preview.match(/data-start=""/g)).toHaveLength(1);
    expect(markup).not.toContain("fill-opacity:0.72");
    expect(markup).not.toContain("dasharray");
  });

  it("draws a chosen name and a previewed one together", () => {
    const markup = drawWith({
      name: { squares: senior },
      preview: { squares: [{ row: 0, column: 0 }] },
    });
    expect(markup.indexOf('data-highlight="name"')).toBeLessThan(
      markup.indexOf('data-highlight="preview"'),
    );
  });

  it("tints the crosses under the letters and hatches the top rows over them", () => {
    const markup = drawWith({ regions: true });
    const tints = markup.indexOf('data-regions="tints"');
    const firstLetter = markup.indexOf(
      "<text",
      markup.indexOf('viewBox="0 0 244 264"'),
    );
    const lastGround = markup.lastIndexOf("stroke-width:1.2", tints);
    expect(tints).toBeGreaterThan(lastGround);
    expect(tints).toBeLessThan(firstLetter);
    // Every square's ground before the tints, every letter after them.
    expect(markup.slice(tints).match(/stroke-width:1.2/g)).toBeNull();
    expect(markup.slice(0, tints)).not.toContain("<text");
    const region = (name: string) =>
      markup.match(new RegExp(`data-region="${name}" d="([^"]*)"`))?.[1] ?? "";
    expect(region("greatCross").match(/M/g)).toHaveLength(36);
    expect(region("calvaryCross").match(/M/g)).toHaveLength(40);
    expect(markup).toContain(
      `fill:${REGION_TINTS.greatCross.fill};fill-opacity:${REGION_TINTS.greatCross.opacity}`,
    );
    // The hatch: lines over the 16 top-row squares, after the letters.
    const hatch = markup.indexOf('data-region="topRow"');
    expect(hatch).toBeGreaterThan(markup.lastIndexOf("<text", hatch));
    expect(region("topRow").match(/M/g)?.length).toBeGreaterThan(16 * 3);
    expect(markup).not.toContain("<pattern");
    expect(markup).not.toContain("dasharray");
    // The same letters, in the same order.
    expect(letters(markup)).toEqual(letters(drawWith({})));
  });

  it("places the regions as the names' paths do", () => {
    const counts: Record<string, number> = {};
    for (let row = 0; row < 13; row++)
      for (let column = 0; column < 12; column++) {
        const region = regionFromPosition(row, column);
        counts[region] = (counts[region] ?? 0) + 1;
      }
    expect(counts).toEqual({
      greatCross: 36,
      calvaryCross: 40,
      topRow: 16,
      servient: 64,
    });
    expect(regionFromPosition(0, 0)).toBe("topRow");
    expect(regionFromPosition(7, 0)).toBe("topRow");
    expect(regionFromPosition(8, 0)).toBe("calvaryCross");
    expect(regionFromPosition(12, 11)).toBe("servient");
  });

  it("names each Watchtower's ground", () => {
    expect(tabletGround("earth")).toBe("black");
    expect(tabletGround("air")).toBe("#fff100");
    expect(tabletGround("water")).toBe("#59f");
    expect(tabletGround("fire")).toBe("#f33");
    expect(tabletGround("union")).toBeUndefined();
    expect(tabletGround("constructor")).toBeUndefined();
  });

  it("keeps clicks off every layer it draws over the squares", () => {
    const markup = drawWith({
      regions: true,
      name: { squares: senior, numbers: [1, 2, 3, 4, 5, 6, 7] },
      preview: { squares: [{ row: 0, column: 0 }] },
    });
    // The tints under the letters, and the hatch, veil, outlines, rings,
    // flags and numbers over them.
    expect(markup).toContain(
      '<g data-regions="tints" style="pointer-events:none">',
    );
    const over = markup.indexOf('<g style="pointer-events:none">');
    expect(over).toBeGreaterThan(-1);
    for (const layer of [
      'data-region="topRow"',
      'data-highlight="name"',
      'data-highlight="preview"',
      "data-start",
      "data-order",
    ])
      expect(markup.indexOf(layer), layer).toBeGreaterThan(over);
    // Nothing clickable follows but the outlined squares and the frame.
    expect(markup.slice(over).match(/<g data-regions/)).toBeNull();
  });
});
