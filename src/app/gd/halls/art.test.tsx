import {
  defaultHallArt,
  GdHall,
  type HallArt,
  type HallArtProps,
  type HallNode,
  validateHall,
} from "@magick-components/gd/hall";
import { HALL_ROLES } from "@magick-components/gd/hall/vocabulary";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { gdHallArt } from "./art";

/**
 * The art that is not original, by registry key. Plan 061 (decision 9):
 * this list had to be empty before the project was finished; stage H
 * emptied it, and it stays so.
 */
const THIRD_PARTY_ART: string[] = [];

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
      // The app gives the tablet its Enochian font, and takes the rest.
      if (key === "tablet")
        expect(gdHallArt.get(key)?.provenance).toBe(art.provenance);
      else expect(gdHallArt.get(key), key).toBe(art);
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
    // Every hall role has its lamen now, the adepts' included (stage H,
    // part 2): a drawing each.
    for (const role of HALL_ROLES.keys()) {
      expect(draw("lamen", { type: "officer", role }), role).not.toBe(plain);
      expect(
        (gdHallArt.get("lamen") as HallArt).variant({ type: "officer", role }),
        role,
      ).toBe(role);
    }
    expect(
      (gdHallArt.get("lamen") as HallArt).variant({
        type: "officer",
        role: "constructor",
      }),
    ).toBe("?");
  });

  it("validates and draws a hall of every item without placeholders", () => {
    const hall: HallNode = {
      type: "gdHall",
      children: [
        {
          type: "floor",
          children: [
            { type: "officer", role: "keryx", x: 2, y: 2 },
            ...[...gdHallArt.keys()]
              .filter((key) => key.startsWith("item:"))
              .map((key, index) => ({
                type: "item",
                kind: key.slice(5),
                x: 1 + (index % 14),
                y: 8 + 2 * Math.floor(index / 14),
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
        { type: "officer", role: "hegemon", grade: "nonsense" },
        { type: "officer", role: "hegemon", grade: "portal" },
        { type: "officer", role: "keryx", grade: "portal" },
        { type: "officer" },
        { type: "officer", role: "" },
      ]),
    );
    // lamp (red, default and named), lamp (white), lantern (yellow,
    // default and named), Keryx (a grade changes nothing), Hegemon (an
    // unknown grade is the Outer Order's), the Portal's Hegemon, and the
    // plain circle for no role.
    expect(drawings(markup)).toBe(7);
  });
});
