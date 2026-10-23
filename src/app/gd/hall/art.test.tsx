import {
  defaultHallArt,
  GdHall,
  type HallArtProps,
  type HallNode,
  validateHall,
} from "@magick-components/gd/hall";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { gdHallArt } from "./art";
import { lamenArt } from "./lamenArt";
import { legacyHallArt } from "./legacyArt";

/**
 * The art that is not original, by registry key. Plan 061 (decision 9):
 * this list must be empty before the project is finished (stage H).
 */
const THIRD_PARTY_ART = [
  // Lifted from the old hall drawings; icon-set signatures, source unknown.
  "item:bread",
  "item:fan",
  "item:rose",
  "item:salt",
  // Lamen: the Kerux's caduceus and the Sentinel's Eye of Horus.
  "lamen",
];

const draw = (key: string, node: HallNode) => {
  const art = gdHallArt.get(key);
  if (!art) throw new Error(`no art for ${key}`);
  const box = typeof art.box === "function" ? art.box(node) : art.box;
  const props: HallArtProps = {
    node,
    box,
    defId: (name) => `test-${name}`,
  };
  return renderToStaticMarkup(
    <svg aria-hidden="true">
      <art.Component {...props} />
    </svg>,
  );
};

describe("the app's hall art", () => {
  it("declares where every drawing comes from", () => {
    for (const [key, art] of gdHallArt) {
      const { provenance } = art;
      expect(["original", "thirdParty"], key).toContain(provenance.origin);
      expect(provenance.author, key).not.toBe("");
      expect(provenance.licence, key).not.toBe("");
      if (provenance.origin === "thirdParty")
        expect(provenance.source, key).toBeTruthy();
    }
  });

  it("lists every third-party drawing, and only those", () => {
    const thirdParty = [...gdHallArt]
      .filter(([, art]) => art.provenance.origin === "thirdParty")
      .map(([key]) => key)
      .sort();
    expect(thirdParty).toEqual(THIRD_PARTY_ART);
  });

  it("keeps the package's own art original and MIT", () => {
    for (const [key, art] of defaultHallArt) {
      expect(art.provenance.origin, key).toBe("original");
      expect(art.provenance.licence, key).toBe("MIT");
      // The app replaces the lamen, and gives the tablet its Enochian font.
      if (key === "tablet")
        expect(gdHallArt.get(key)?.provenance).toBe(art.provenance);
      else if (key !== "lamen") expect(gdHallArt.get(key), key).toBe(art);
    }
  });

  it("names its legacy sources in the public drawings", () => {
    for (const [key, art] of legacyHallArt) {
      expect(art.provenance.source, key).toMatch(
        /^public\/pics\/(neophyte|zelator[12]|theoricus[12])\.svg#/,
      );
      expect(art.provenance.licence, key).toBe("unknown");
    }
  });

  it("draws every legacy item as plain paths", () => {
    for (const key of legacyHallArt.keys()) {
      const markup = draw(key, { type: "item", kind: key.slice(5) });
      expect(markup, key).toMatch(/<path d="M/);
      expect(markup, key).not.toMatch(/\sid=|href|<image|filter|url\(/);
    }
  });

  it("draws the lamens through Lamen, and a plain circle without a role", () => {
    // The Hierophant's striped ring; the Past Hierophant's white one.
    expect(draw("lamen", { type: "officer", role: "hierophant" })).toContain(
      'fill="white"',
    );
    const past = draw("lamen", { type: "officer", role: "pastHierophant" });
    expect(past).toContain("fill:white");
    expect(past).toContain("fill:green");
    expect(past).not.toContain('fill="white"');
    const plain = draw("lamen", { type: "officer" });
    expect(plain).toContain('<circle r="47"');
    expect(draw("lamen", { type: "officer", role: "" })).toBe(plain);
    // An unknown role is Lamen's plain lamen, not the Hierophant's.
    expect(draw("lamen", { type: "officer", role: "constructor" })).toContain(
      "fill:white",
    );
    // The adepts have no lamens yet: labelled circles, one drawing.
    for (const role of ["chiefAdept", "secondAdept", "thirdAdept"]) {
      expect(draw("lamen", { type: "officer", role }), role).toBe(plain);
      expect(lamenArt.variant({ type: "officer", role }), role).toBe("");
    }
    expect(lamenArt.variant({ type: "officer", role: "constructor" })).toBe(
      "?",
    );
  });

  it("validates and draws a hall of legacy items without placeholders", () => {
    const hall: HallNode = {
      type: "gdHall",
      children: [
        {
          type: "floor",
          children: [
            { type: "officer", role: "keryx", x: 2, y: 2 },
            ...[...legacyHallArt.keys()].map((key, index) => ({
              type: "item",
              kind: key.slice(5),
              x: 1 + index,
              y: 8,
            })),
          ],
        },
      ],
    };
    expect(validateHall(hall, { art: gdHallArt })).toEqual([]);
    const markup = renderToStaticMarkup(<GdHall hall={hall} art={gdHallArt} />);
    expect(markup).not.toContain(`stroke-dasharray="6 4"`);
  });
});

describe("the app's hall art in a hostile hall", () => {
  // The final review of stage A: with this art, 200 chalices drew 22.4 MB
  // of SVG from 6.7 KB of source, and 4,000 (the node bound) 448 MB. Each
  // drawing is now in the hall's <defs> once per variant.
  const floorOf = (children: unknown[]): HallNode =>
    ({ type: "gdHall", children: [{ type: "floor", children }] }) as HallNode;
  const render = (hall: HallNode) =>
    renderToStaticMarkup(<GdHall hall={hall} art={gdHallArt} />);
  const drawings = (markup: string) =>
    (markup.match(/ id="[^"]+-art\d+"/g) ?? []).length;

  it("draws 4,000 chalices in under 1 MB, the chalice once", () => {
    const one = render(floorOf([{ type: "item", kind: "chalice" }]));
    const markup = render(
      floorOf(
        Array.from({ length: 4000 }, (_, i) => ({
          type: "item",
          kind: "chalice",
          x: i % 16,
          y: Math.floor(i / 250),
        })),
      ),
    );
    expect(drawings(markup)).toBe(1);
    expect((markup.match(/<use /g) ?? []).length).toBe(3998);
    expect(markup.length).toBeLessThan(1_000_000);
    // The drawing itself is counted once.
    expect(markup.length - one.length).toBeLessThan(3998 * 100);
  });

  it("draws one drawing per variant, however the attributes are spelled", () => {
    const kinds = [...gdHallArt.keys()]
      .filter((key) => key.startsWith("item:"))
      .map((key) => key.slice(5));
    const markup = render(
      floorOf(
        Array.from({ length: 3990 }, (_, i) =>
          i % 3 === 0
            ? {
                type: "item",
                kind: kinds[(i / 3) % kinds.length],
                fill: `c${i}`,
                stroke: `s${i}`,
                light: `l${i}`,
              }
            : i % 3 === 1
              ? { type: "officer", role: `role${i}`, label: "" }
              : { type: "officer", role: "keryx", label: "" },
        ),
      ),
    );
    // Each item kind once (an unknown colour is the default), one lamen
    // for the unknown roles and the Keryx's.
    expect(drawings(markup)).toBe(kinds.length + 2);
    expect(markup.length).toBeLessThan(1_000_000);
  });

  it("tells drawings apart by what they draw", () => {
    const markup = render(
      floorOf([
        { type: "item", kind: "lamp" },
        { type: "item", kind: "lamp", light: "nonsense" },
        { type: "item", kind: "lamp", light: "red" },
        { type: "item", kind: "lamp", light: "white" },
        { type: "item", kind: "lantern" },
        { type: "item", kind: "lantern", light: "yellow" },
        { type: "officer", role: "keryx" },
        { type: "officer", role: "hegemon" },
        { type: "officer" },
        { type: "officer", role: "" },
      ]),
    );
    // lamp (red, default and named), lamp (white), lantern (yellow,
    // default and named), Keryx, Hegemon, and the plain circle for no role.
    expect(drawings(markup)).toBe(6);
  });
});
