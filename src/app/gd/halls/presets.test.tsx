import {
  GdHall,
  type ResolvedObject,
  resolveHall,
  validateHall,
} from "@magick-components/gd/hall";
import { estimateHallAspect } from "@magick-components/gd/hall/aspect";
import {
  compassBox,
  FLOOR_SIZE,
  FLOOR_STROKE,
  type Rect,
  WALL_GAP,
} from "@magick-components/gd/hall/layout";
import {
  HALL_PRESETS,
  HALL_SOURCE_WORKS,
  neophyte,
  zelator1,
  zelator2,
} from "@magick-components/gd/hall/presets";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { inventoryRitualAssets } from "@/offline/ritualAssetInventory";
import { gdHallArt } from "./art";

/** The presets ported from the old drawings in `public/pics`. */

const render = (hall: (typeof HALL_PRESETS)[number]["hall"]) =>
  renderToStaticMarkup(<GdHall hall={hall} art={gdHallArt} />);

describe.each(HALL_PRESETS.map((preset) => [preset.id, preset] as const))(
  "the %s preset",
  (id, preset) => {
    it("validates with no errors or warnings against the app's art", () => {
      expect(validateHall(preset.hall, { art: gdHallArt })).toEqual([]);
    });

    it("sizes the reader's placeholder within 2 % of the drawing", () => {
      const { viewBox } = resolveHall(preset.hall, { art: gdHallArt });
      const drawn = (viewBox.x1 - viewBox.x0) / (viewBox.y1 - viewBox.y0);
      expect(
        Math.abs(estimateHallAspect(preset.hall) / drawn - 1),
      ).toBeLessThan(0.02);
    });

    it("says where its layout comes from: book pages only", () => {
      // Only primary sources are cited (Gadi, 28 October 2026); the site's
      // own hand drawings were made from these diagrams and are none.
      expect(preset.sources.length).toBeGreaterThan(0);
      for (const source of preset.sources) {
        expect(source.kind).toBe("book");
        expect(Object.hasOwn(HALL_SOURCE_WORKS, source.work)).toBe(true);
        expect(Number.isInteger(source.page) && source.page > 0).toBe(true);
        expect(Number.isInteger(source.leaf) && source.leaf > 0).toBe(true);
      }
      expect(JSON.stringify(preset)).not.toContain("public/pics");
    });

    it("draws the same SVG every time, with the app's art", async () => {
      const markup = render(preset.hall);
      expect(render(preset.hall)).toBe(markup);
      // Every tag drawn: no placeholder for missing art.
      expect(markup).not.toContain('stroke-dasharray="6 4"');
      expect(markup).toContain(`>${preset.title}</title>`);
      // One tag per line, so a change reads as a small diff.
      await expect(markup.replaceAll("><", ">\n<")).toMatchFileSnapshot(
        `./__snapshots__/${id}.svg`,
      );
    });

    it("loads nothing: no images, and references only within itself", () => {
      const markup = render(preset.hall);
      expect(markup).not.toMatch(/<image|<img|xlink:href/i);
      const ids = new Set(
        [...markup.matchAll(/\sid="([^"]+)"/g)].map(([, value]) => value),
      );
      for (const [, href] of markup.matchAll(/\shref="([^"]*)"/g)) {
        expect(href.startsWith("#"), href).toBe(true);
        expect(ids.has(href.slice(1)), href).toBe(true);
      }
      for (const [, url] of markup.matchAll(/url\(([^)]*)\)/g))
        expect(ids.has(url.replace(/^#/, "")), url).toBe(true);
      expect(
        markup.replaceAll('xmlns="http://www.w3.org/2000/svg"', ""),
      ).not.toMatch(/https?:|\/\//);
    });

    it("passes the offline asset inventory as a compiled ritual", () => {
      // A ritual whose only content is the hall, as the reader holds it.
      const inventory = inventoryRitualAssets(
        { children: [preset.hall] },
        { knownAppOrigins: ["https://magick.ly"], staticPaths: [] },
      );
      expect(inventory.issues).toEqual([]);
      expect(inventory.occurrences).toEqual([]);
      expect(inventory.enumerationComplete).toBe(true);
    });
  },
);

describe("the presets", () => {
  it("have unique ids and titles, each its caption", () => {
    const ids = HALL_PRESETS.map((preset) => preset.id);
    expect(ids).toEqual([
      "neophyte",
      "zelator1",
      "zelator2",
      "theoricus1",
      "theoricus2",
      "practicus1",
      "practicus2",
      "practicus3",
      "philosophus1",
      "philosophus2",
      "philosophus3",
      "philosophus4",
      "portal1",
      "portal2",
    ]);
    expect(new Set(HALL_PRESETS.map((preset) => preset.title)).size).toBe(
      HALL_PRESETS.length,
    );
    for (const preset of HALL_PRESETS) {
      const caption = preset.hall.children?.find(
        (child) => child.type === "caption",
      );
      expect(caption?.text, preset.id).toBe(preset.title);
    }
  });
});

describe("the neophyte Dadouchos", () => {
  it("keeps its label clear of the floor's South outline", () => {
    // "Dadouchos" is one word wider than its cell, so only the officer's
    // place can keep it inside: at x = 14.95 and 14.9 its "s" lay on the
    // outline, whose inner edge is half a stroke inside the floor's edge.
    const dadouchos = resolveHall(neophyte.hall, {
      art: gdHallArt,
    }).objects.find(
      (object) => object.node.role === "dadouchos",
    ) as ResolvedObject;
    const [label] = dadouchos.labels;
    expect(label.lines.map((line) => line.text)).toEqual(["Dadouchos"]);
    expect(label.bounds.x1).toBeLessThan(FLOOR_SIZE - FLOOR_STROKE / 2);
  });
});

describe.each([zelator1, zelator2].map((preset) => [preset.id, preset]))(
  "the %s Earth tablet",
  (_id, preset) => {
    // Plan 061, conflict 7: as the book draws it (p.44), inside the hall
    // with its outer edge on the North wall line, the lamp at its East end
    // and the salt at its West end, all clear of everything else.
    const { objects, compass } = resolveHall(preset.hall, {
      art: gdHallArt,
    });
    const find = (artKey: string) =>
      objects.find(
        (object) => object.artKey === artKey && object.cx < 2,
      ) as ResolvedObject;
    const tablet = find("tablet");
    const lamp = find("item:lantern");
    const salt = find("item:salt");
    const edges = (o: ResolvedObject) => ({
      north: o.cx - o.width / 2,
      south: o.cx + o.width / 2,
      east: o.cy - o.height / 2,
      west: o.cy + o.height / 2,
    });

    it("stands inside with its outer edge on the wall line", () => {
      expect(edges(tablet).north).toBeCloseTo(-WALL_GAP, 6);
      // The board's long side runs along the wall, about 2 squares long.
      expect(tablet.height).toBeGreaterThan(tablet.width);
      expect(tablet.height).toBeLessThan(3);
      expect(tablet.cy).toBeCloseTo(8, 6);
    });

    it("has the lamp at its East end and the salt at its West end", () => {
      expect(edges(lamp).west).toBeLessThan(edges(tablet).east);
      expect(edges(salt).east).toBeGreaterThan(edges(tablet).west);
      for (const item of [lamp, salt])
        expect(edges(item).north).toBeGreaterThan(0);
    });

    it("overlaps nothing else: objects, labels or compass words", () => {
      const north = [tablet, lamp, salt];
      const box = (rect: Rect) => ({
        north: rect.x0,
        south: rect.x1,
        east: rect.y0,
        west: rect.y1,
      });
      const labels = (object: ResolvedObject) =>
        [...object.labels, ...(object.text ? [object.text] : [])].map((label) =>
          box(label.bounds),
        );
      const mine = north.flatMap((object) =>
        [edges(object), ...labels(object)].map(
          (rect) => [object.artKey, rect] as const,
        ),
      );
      const others = [
        ...objects
          .filter((object) => !north.includes(object))
          .flatMap((object) =>
            [edges(object), ...labels(object)].map(
              (rect) => [object.artKey, rect] as const,
            ),
          ),
        ...compass.map(
          (label) => [label.text, box(compassBox(label))] as const,
        ),
      ];
      expect(others.some(([name]) => name === "North")).toBe(true);
      for (const [name, a] of mine)
        for (const [otherName, b] of others) {
          const apart =
            a.south <= b.north ||
            b.south <= a.north ||
            a.west <= b.east ||
            b.west <= a.east;
          expect(apart, `${name} and ${otherName}`).toBe(true);
        }
    });
  },
);

describe("the Enochian tablets of the Philosophus and Portal halls", () => {
  // Stage G drew the tablets these halls had as markers: Fire on the South
  // wall, Water on the West, the Tablet of Union beyond the East wall.
  const expected: Record<string, readonly string[]> = {
    philosophus1: ["fire"],
    philosophus2: ["fire"],
    philosophus3: ["fire"],
    philosophus4: ["fire"],
    portal1: ["air", "earth", "fire", "union", "water"],
    portal2: ["air", "earth", "fire", "water"],
  };
  const presets = HALL_PRESETS.filter((preset) =>
    Object.hasOwn(expected, preset.id),
  );

  it.each(presets.map((preset) => [preset.id, preset] as const))(
    "%s draws its tablets, and names none in a marker",
    (id, preset) => {
      const { objects } = resolveHall(preset.hall, { art: gdHallArt });
      const tablets = objects.filter((object) => object.artKey === "tablet");
      expect(tablets.map((object) => object.node.element).sort()).toEqual(
        [...expected[id]].sort(),
      );
      for (const object of objects)
        if (object.artKey === "marker")
          expect(String(object.node.text)).not.toMatch(/tablet/i);
      const edges = (o: ResolvedObject) => ({
        north: o.cx - o.width / 2,
        south: o.cx + o.width / 2,
        east: o.cy - o.height / 2,
        west: o.cy + o.height / 2,
      });
      for (const tablet of tablets) {
        const element = tablet.node.element;
        // On the wall line, inside, as the Earth tablet stands (conflict 7).
        if (element === "fire")
          expect(edges(tablet).south).toBeCloseTo(FLOOR_SIZE + WALL_GAP, 6);
        if (element === "water")
          expect(edges(tablet).west).toBeCloseTo(FLOOR_SIZE + WALL_GAP, 6);
        // Beyond the East wall, past the dais.
        if (element === "union") expect(edges(tablet).west).toBeLessThan(-5);
        // Clear of every other object, and of every label and marker text
        // (an officer's name included).
        const rects = (object: ResolvedObject) => [
          ...(object.artKey === "label" ? [] : [edges(object)]),
          ...[
            ...object.labels,
            ...(object.text ? [object.text] : []),
            ...(object.inner ? [object.inner] : []),
          ].map(({ bounds }) => ({
            north: bounds.x0,
            south: bounds.x1,
            east: bounds.y0,
            west: bounds.y1,
          })),
        ];
        for (const other of objects) {
          if (other === tablet) continue;
          for (const b of rects(other)) {
            const a = edges(tablet);
            const apart =
              a.south <= b.north ||
              b.south <= a.north ||
              a.west <= b.east ||
              b.west <= a.east;
            expect(apart, `${element} tablet and ${other.artKey}`).toBe(true);
          }
        }
      }
    },
  );
});
