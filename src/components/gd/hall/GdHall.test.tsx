import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultHallArt } from "./art";
import {
  GD_HALL_FONT_FILES,
  GD_HALL_FONT_STACKS,
  gdHallFontFaceCss,
} from "./fonts";
import { GdHall } from "./GdHall";
import { MAX_HALL_LABEL_LINES } from "./layout";
import type { HallArt, HallNode } from "./types";
import { CROSS_FORMS } from "./vocabulary";

const hall = (attrs: Record<string, unknown>, ...children: unknown[]) =>
  ({ type: "gdHall", ...attrs, children }) as HallNode;
const floor = (...children: unknown[]) => ({ type: "floor", children });
const render = (node: HallNode, props = {}) =>
  renderToStaticMarkup(<GdHall hall={node} {...props} />);

/** A small hall touching every part of the chrome and the default art. */
const small = hall(
  { dais: 4, wall: "gradient" },
  {
    type: "dais",
    children: [
      { type: "officer", role: "hierophant" },
      { type: "officer", role: "pastHierophant" },
    ],
  },
  {
    type: "banners",
    children: [{ type: "hebrewLetter", letter: "shin" }],
  },
  floor(
    { type: "banner", kind: "east", x: 9.4, y: 0 },
    { type: "pillar", kind: "black", x: 4, y: 3, glow: true },
    { type: "officer", role: "hegemon", x: 8, y: 3, labelPos: "top" },
    {
      type: "altar",
      at: "centre",
      children: [
        { type: "item", kind: "cross", y: -0.4 },
        { type: "item", kind: "triangle", y: 0.3 },
      ],
    },
    {
      type: "platform",
      x: 8,
      y: 14.5,
      w: 4,
      h: 3,
      children: [{ type: "officer", role: "hiereus", labelPos: "top" }],
    },
    { type: "door", x: 14, width: 2 },
  ),
  { type: "caption", text: "Neophyte Temple" },
);

describe("GdHall", () => {
  it("renders a stable SVG for a small hall", async () => {
    // One tag per line, so a change reads as a small diff.
    await expect(render(small).replaceAll("><", ">\n<")).toMatchFileSnapshot(
      "./__snapshots__/smallHall.svg",
    );
  });

  it("is an image titled by its caption", () => {
    const markup = render(small);
    expect(markup).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(markup).toContain('role="img"');
    const [, titleId] = markup.match(/aria-labelledby="([^"]+)"/) ?? [];
    expect(markup).toContain(`<title id="${titleId}">Neophyte Temple</title>`);
    expect(render(hall({}))).toContain(">Temple hall</title>");
  });

  it("lays text out at a large size with ligatures off", () => {
    const markup = render(small);
    expect(markup).toContain(
      'style="font-variant-ligatures:none;font-kerning:normal"',
    );
    expect(markup).toContain('font-size="43"');
    expect(markup).not.toContain("geometricPrecision");
    const sizes = [...markup.matchAll(/font-size="([^"]+)"/g)].map(([, size]) =>
      Number(size),
    );
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
  });

  it("draws unknown and reserved tags as named placeholders", () => {
    const markup = render(
      hall(
        {},
        floor(
          { type: "unicorn" },
          { type: "text", value: "hidden" },
          { type: "item", kind: "cup" },
        ),
      ),
    );
    expect(markup.match(/stroke-dasharray="6 4"/g)).toHaveLength(3);
    for (const name of ["unicorn", "text", "item:cup"])
      expect(markup).toContain(`>${name}</text>`);
    expect(markup).not.toContain("hidden");
  });

  it("puts untrusted strings only in text, never in references", () => {
    const evil = '"><image href="https://evil.example/x.png"/><script>';
    const markup = render(
      hall(
        { wall: evil },
        floor(
          { type: "officer", role: evil, label: evil },
          { type: "item", kind: evil, fill: "url(https://evil.example)" },
          { type: "item", kind: "cross", stroke: "url(#x)", form: evil },
          { type: "marker", text: evil },
          { type: "label", text: evil },
          { type: evil },
          { type: "hebrewLetter", letter: evil },
          { type: "pillar", kind: evil, href: "https://evil.example" },
        ),
        { type: "caption", text: evil },
      ),
    );
    // Text is escaped, so every "<" in the markup opens a real tag.
    const tags = markup.match(/<[^>]+>/g) ?? [];
    expect(tags.length).toBeGreaterThan(20);
    for (const tag of tags) {
      expect(tag).not.toMatch(/\s(?:xlink:)?href=/);
      expect(tag).not.toMatch(/^<\/?(?:image|script|foreignObject|a|use)\b/);
      for (const [, reference] of tag.matchAll(/url\(([^)]*)\)/g))
        expect(reference).toMatch(/^#_R_[A-Za-z0-9_-]+$/);
    }
    expect(markup).toContain("&lt;image href=");
  });

  it("gives each hall on a page its own gradient and pattern ids", () => {
    const markup = renderToStaticMarkup(
      <div>
        <GdHall hall={small} />
        <GdHall hall={small} />
      </div>,
    );
    const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id);
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, id] of markup.matchAll(/url\(#([^)]+)\)/g))
      expect(ids).toContain(id);
  });

  it("draws an empty hall for anything that is not a gdHall", () => {
    const empty = render(hall({}));
    for (const input of [null, "x", { type: "floor" }])
      expect(render(input as unknown as HallNode)).toBe(empty);
  });

  it("embeds the font faces when given where the fonts are served", () => {
    const markup = render(small, { fontBaseUrl: "/fonts/" });
    expect(markup).toContain(
      'src:url("/fonts/NotoSerif-Italic-latin1.woff2") format("woff2")',
    );
    expect(render(small)).not.toContain("<style>");
    expect(() => render(small, { fontBaseUrl: 'x") ; y' })).toThrow(
      "Unsafe font base URL",
    );
  });

  it("passes size and class through", () => {
    const markup = render(hall({}), {
      className: "hall",
      width: 400,
      style: { maxWidth: "100%" },
    });
    expect(markup).toContain('class="hall"');
    expect(markup).toContain('width="400"');
    expect(markup).toContain('style="max-width:100%"');
  });

  it("draws plain walls without a gradient", () => {
    const markup = render(hall({ wall: "plain" }));
    expect(markup).not.toContain("linearGradient");
    expect(markup).toContain('fill="#ffffff" stroke="#000000"');
  });

  it("cuts doors through every wall", () => {
    const markup = render(
      hall(
        { compass: false },
        floor(
          { type: "door", x: 14, width: 2 },
          { type: "door", side: "east", x: 8 },
          { type: "door", side: "north", y: 8 },
          { type: "door", side: "south", y: 8 },
        ),
      ),
    );
    expect(
      markup.match(
        /<rect x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+" fill="#ffffff"><\/rect>/g,
      ),
    ).toHaveLength(5);
  });

  it("cuts an East door through the floor's edge when there is no dais", () => {
    const band = (dais: number) => {
      const markup = render(
        hall({ dais }, floor({ type: "door", side: "east", x: 8 })),
      );
      const [, y, height] =
        markup.match(
          /<rect x="700" y="([^"]+)" width="200" height="([^"]+)" fill="#ffffff"><\/rect>/,
        ) ?? [];
      return [Number(y), Number(y) + Number(height)];
    };
    // Behind a dais only the wall line; with none, the wall, the gap and
    // the floor's outline, as on the other sides.
    expect(band(4)).toEqual([-416, -384]);
    expect(band(0)).toEqual([-47, 16]);
  });

  it("draws every variant of the package's art", () => {
    const markup = render(
      hall(
        {},
        floor(
          { type: "pillar", kind: "white" },
          { type: "pillar", kind: "white", glow: true },
          { type: "pillar" },
          { type: "banner", kind: "west" },
          { type: "hebrewLetter", letter: "omega" },
          { type: "marker", text: "Lamp of the Kerux", shape: "circle" },
          { type: "marker" },
          { type: "throne" },
          { type: "board", w: 3 },
          { type: "lamen", role: "keryx" },
          ...CROSS_FORMS.map((form) => ({ type: "item", kind: "cross", form })),
          { type: "item", kind: "triangle", dir: "down", fill: "yellow" },
          { type: "item", kind: "pentagram", dir: "down", stroke: "black" },
          { type: "item", kind: "pentagram" },
          { type: "label", text: "Free text", x: 8, y: 12 },
        ),
      ),
    );
    expect(markup).not.toContain("stroke-dasharray");
    expect(markup).toContain(">Lamp</text>");
    expect(markup).toContain(">of the</text>");
    expect(markup).toContain(">Free text</text>");
    expect(markup).toContain('fill="#ffe000"');
  });

  it("composes app art over the defaults", () => {
    const cup: HallArt = {
      Component: () => <circle r={10} data-art="cup" />,
      box: { width: 20, height: 20 },
      provenance: { origin: "thirdParty", author: "test", licence: "test" },
    };
    const markup = render(hall({}, floor({ type: "item", kind: "cup" })), {
      art: new Map([...defaultHallArt, ["item:cup", cup]]),
    });
    expect(markup).toContain('data-art="cup"');
    expect(markup).not.toContain("stroke-dasharray");
  });
});

describe("GdHall with hostile labels", () => {
  // The A1 review's amplification: under 1.2 MB of source drew 125,000
  // label lines (9.5 MB of SVG) from label children the node bound did not
  // count, and 3,990 shrunken officers with one-letter labels drew 399,000
  // lines (28 MB).
  const text = "a ".repeat(100);
  const textLines = (markup: string) => (markup.match(/<text /g) ?? []).length;

  it("bounds the output of label children", () => {
    const markup = render(
      hall(
        {},
        floor({
          type: "officer",
          role: "keryx",
          children: Array.from({ length: 5000 }, () => ({
            type: "label",
            text,
          })),
        }),
      ),
    );
    // The compass words are the other four text elements.
    expect(textLines(markup)).toBe(MAX_HALL_LABEL_LINES + 4);
    expect(markup.length).toBeLessThan(100_000);
  });

  it("bounds the output of many small labelled officers", () => {
    const markup = render(
      hall(
        {},
        floor(
          ...Array.from({ length: 3990 }, () => ({
            type: "officer",
            role: "keryx",
            scale: 0.05,
            label: text,
          })),
        ),
      ),
    );
    expect(textLines(markup)).toBe(MAX_HALL_LABEL_LINES + 4);
    // Mostly the 3,990 lamens, which the node bound limits.
    expect(markup.length).toBeLessThan(1_000_000);
  });
});

describe("fonts", () => {
  it("builds @font-face rules from a caller's base URL", () => {
    const css = gdHallFontFaceCss("https://cdn.example/fonts");
    expect(css.split("\n")).toHaveLength(GD_HALL_FONT_FILES.length);
    expect(css).toContain(
      'font-family:"GdHall Noto Serif";font-style:italic;font-weight:700',
    );
    expect(css).toContain("unicode-range:U+5D0-5EA");
    for (const bad of ["a b", "x'", "<x>", "a&b", "a\\b", "a(b"])
      expect(() => gdHallFontFaceCss(bad)).toThrow();
    expect(GD_HALL_FONT_STACKS.serif).toBe(
      '"GdHall Noto Serif", "Noto Serif", serif',
    );
  });

  it("names files that exist in public/fonts", () => {
    for (const font of GD_HALL_FONT_FILES)
      expect(
        readFileSync(path.join("public/fonts", font.file)).length,
      ).toBeGreaterThan(1000);
  });
});

describe("art provenance", () => {
  it("ships only original MIT art in the package", () => {
    for (const [kind, art] of defaultHallArt) {
      expect(art.provenance.origin, kind).toBe("original");
      expect(art.provenance.licence, kind).toBe("MIT");
      expect(art.provenance.author, kind).toContain("Gadi Cohen");
    }
  });

  it("has every art module export its provenance", async () => {
    const directory = path.join(__dirname, "art");
    const modules = readdirSync(directory).filter(
      (file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"),
    );
    expect(modules.length).toBeGreaterThan(8);
    for (const file of modules) {
      const module = await import(`./art/${file.replace(/\.tsx$/, "")}`);
      expect(module.provenance, file).toBeDefined();
    }
  });
});
