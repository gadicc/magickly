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
import { legacyHallArt } from "./legacyArt";

/**
 * The art that is not original, by registry key. Plan 061 (decision 9):
 * this list must be empty before the project is finished (stage H).
 */
const THIRD_PARTY_ART = [
  // Lifted from the old hall drawings; icon-set signatures, source unknown.
  "item:bread",
  "item:censer",
  "item:chalice",
  "item:cup",
  "item:fan",
  "item:lamp",
  "item:lantern",
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
    unitsPerSquare: 50,
    labelSize: 0.43,
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

  it("glazes the lamp red and the lantern pale yellow, or a named colour", () => {
    expect(draw("item:lamp", { type: "item", kind: "lamp" })).toContain(
      'fill="#ff8080"',
    );
    expect(draw("item:lantern", { type: "item", kind: "lantern" })).toContain(
      'fill="#f8edb4"',
    );
    // HALL_COLOURS blue (#2050c0) mixed half and half with white.
    expect(
      draw("item:lamp", { type: "item", kind: "lamp", fill: "blue" }),
    ).toContain('fill="#90a8e0"');
    expect(
      draw("item:lamp", { type: "item", kind: "lamp", fill: "none" }),
    ).not.toContain("#ff8080");
    // Not a colour name: the default glass, never the raw value.
    const raw = draw("item:lamp", { type: "item", kind: "lamp", fill: "#123" });
    expect(raw).toContain('fill="#ff8080"');
    expect(raw).not.toContain("#123");
  });

  it("draws the lamens through Lamen, and a plain circle without a role", () => {
    expect(
      draw("lamen", { type: "officer", role: "pastHierophant" }),
    ).toContain("fill:#f2f2f2");
    const plain = draw("lamen", { type: "officer" });
    expect(plain).toContain('<circle r="47"');
    expect(draw("lamen", { type: "officer", role: "" })).toBe(plain);
    // An unknown role is Lamen's plain lamen, not the Hierophant's.
    expect(draw("lamen", { type: "officer", role: "constructor" })).toContain(
      "fill:white",
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
            { type: "item", kind: "lantern", fill: "green", x: 4, y: 12 },
          ],
        },
      ],
    };
    expect(validateHall(hall, { art: gdHallArt })).toEqual([]);
    const markup = renderToStaticMarkup(<GdHall hall={hall} art={gdHallArt} />);
    expect(markup).not.toContain(`stroke-dasharray="6 4"`);
    expect(markup).toContain('fill="#88c088"');
  });
});
