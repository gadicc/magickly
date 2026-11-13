import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { defaultHallArt } from "./art";
import { tabletArt } from "./art/symbols";
import { GdHall, GdHallSvg, hallRoot, hallViewBox } from "./GdHall";
import { resolveHall } from "./layout";
import { HALL_PRESETS } from "./presets";

/**
 * Every hook these modules can reach through "react", recorded as it is
 * called and then run, as `symbolIds.test.tsx` does for the Shewbread:
 * the image routes render with a React that has no hook dispatcher, so a
 * hook anywhere under `GdHallSvg` would break the build (plan 062).
 */
const hooksCalled = vi.hoisted(() => [] as string[]);
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const original = actual.default as Record<string, unknown>;
  const guarded: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(original))
    if (/^use(?:[A-Z]|$)/.test(name) && typeof value === "function")
      guarded[name] = (...args: unknown[]) => {
        hooksCalled.push(name);
        return (value as (...a: unknown[]) => unknown)(...args);
      };
  return { ...actual, ...guarded, default: { ...original, ...guarded } };
});

// The tablets as the image route draws them: in the bundled Enochian font.
const art = new Map([
  ...defaultHallArt,
  ["tablet", tabletArt({ fontFamily: "Enochian" })],
]);

describe("GdHallSvg", () => {
  it.each(HALL_PRESETS.map((preset) => [preset.id, preset] as const))(
    "draws %s without hooks",
    (_, preset) => {
      hooksCalled.length = 0;
      const resolved = resolveHall(hallRoot(preset.hall), { art });
      const markup = renderToStaticMarkup(
        <GdHallSvg resolved={resolved} art={art} idPrefix="gdhall" image />,
      );
      expect(hooksCalled).toEqual([]);
      expect(markup).toContain('id="gdhall-checker"');
    },
  );

  it("sees the hooks GdHall calls, so the check above can fail", () => {
    hooksCalled.length = 0;
    renderToStaticMarkup(<GdHall hall={HALL_PRESETS[0].hall} art={art} />);
    expect(hooksCalled).toContain("useId");
    expect(hooksCalled).toContain("useMemo");
  });

  it("draws an image's viewBox in whole units, rounded outward", () => {
    for (const preset of HALL_PRESETS) {
      const resolved = resolveHall(hallRoot(preset.hall), { art });
      const exact = hallViewBox(resolved);
      const [x, y, width, height] = hallViewBox(resolved, true);
      for (const value of [x, y, width, height])
        expect(Number.isInteger(value), preset.id).toBe(true);
      expect(x).toBeLessThanOrEqual(exact[0]);
      expect(y).toBeLessThanOrEqual(exact[1]);
      expect(x + width).toBeGreaterThanOrEqual(exact[0] + exact[2]);
      expect(y + height).toBeGreaterThanOrEqual(exact[1] + exact[3]);
      // Under one unit (a hundredth of a square) on each side.
      expect(exact[0] - x).toBeLessThan(1);
      expect(x + width - (exact[0] + exact[2])).toBeLessThan(1);
      const markup = renderToStaticMarkup(
        <GdHallSvg resolved={resolved} art={art} idPrefix="gdhall" image />,
      );
      expect(markup).toContain(`viewBox="${x} ${y} ${width} ${height}"`);
    }
  });

  it("leaves out the title and its accessible name in an image", () => {
    const resolved = resolveHall(hallRoot(HALL_PRESETS[0].hall), { art });
    const image = renderToStaticMarkup(
      <GdHallSvg resolved={resolved} art={art} idPrefix="gdhall" image />,
    );
    expect(image).not.toMatch(/<title|role=|aria-labelledby/);
    const inline = renderToStaticMarkup(
      <GdHallSvg resolved={resolved} art={art} idPrefix="gdhall" />,
    );
    expect(inline).toContain(
      'role="img" aria-labelledby="gdhall-title"><title id="gdhall-title">Neophyte Temple</title>',
    );
  });

  it("is what GdHall draws, with GdHall's id", () => {
    for (const preset of HALL_PRESETS) {
      const drawn = renderToStaticMarkup(
        <GdHall hall={preset.hall} art={art} />,
      );
      const id = drawn.match(/id="([^"]+)-checker"/)?.[1] as string;
      const resolved = resolveHall(hallRoot(preset.hall), { art });
      expect(
        renderToStaticMarkup(
          <GdHallSvg resolved={resolved} art={art} idPrefix={id} />,
        ),
      ).toBe(drawn);
    }
  });

  it("draws anything but a gdHall node as an empty hall", () => {
    expect(hallRoot({ type: "paragraph" })).toEqual({ type: "gdHall" });
    const hall = { type: "gdHall", children: [] };
    expect(hallRoot(hall)).toBe(hall);
  });
});
