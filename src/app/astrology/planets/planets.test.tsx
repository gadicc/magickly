// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moonMeanInclination } from "@/components/astrology/Moon";
import { resetPlaceStore } from "@/geo/usePlace";
import { hydrateAt, renderAt } from "../../../../tests/hydration";
import Planets, { PlaceMoon } from "./planets";

// The page is prerendered at build time and viewed later.
const buildTime = new Date("2026-09-17T10:16:00Z");
const visitTime = new Date("2026-10-20T12:00:00Z"); // Waxing Gibbous

let answerGeo: (place: unknown) => void;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetPlaceStore();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          answerGeo = (place) =>
            resolve({ ok: true, json: async () => ({ place }) });
        }),
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const north = `rotate(${moonMeanInclination})`;
const south = `rotate(${180 - moonMeanInclination})`;

/**
 * Hydrates the planets page's moon, then lets `/api/geo` answer `place`
 * (unless it is undefined, which leaves the lookup loading).
 */
async function visit(place?: unknown) {
  const html = renderAt(buildTime, <PlaceMoon />);
  const view = await hydrateAt(visitTime, html, <PlaceMoon />);
  const svg = view.container.querySelector("svg");
  const hydrated = svg?.getAttribute("transform");
  if (place !== undefined) {
    await act(async () => {
      answerGeo(place);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  const result = {
    problems: view.problems,
    hydrated,
    transform: svg?.getAttribute("transform"),
    text: view.container.textContent,
  };
  await view.unmount();
  return result;
}

describe("the planets page's moon", () => {
  it("is northern while the place is loading", async () => {
    const { problems, transform } = await visit();
    expect(problems).toEqual([]);
    expect(transform).toBe(north);
  });

  it("stays northern, and silent, when the place is unknown", async () => {
    const { transform, text } = await visit(null);
    expect(transform).toBe(north);
    expect(text).toBe("Waxing Gibbous");
  });

  it("turns for a place south of the equator after hydrating", async () => {
    const capeTown = { name: "Cape Town", latitude: -33.92, longitude: 18.42 };
    const { problems, hydrated, transform } = await visit(capeTown);
    expect(problems).toEqual([]);
    expect(hydrated).toBe(north);
    expect(transform).toBe(south);
  });

  it("stays northern for a place on the equator", async () => {
    const equator = { name: "Quito", latitude: 0, longitude: -78.5 };
    expect((await visit(equator)).transform).toBe(north);
  });
});

describe("the planets table", () => {
  it("names each planet as readers search for it, as its page does", () => {
    const html = renderAt(buildTime, <Planets />);
    const links = [
      ...html.matchAll(/href="\/astrology\/planet\/([^"]+)">([^<]*)</g),
    ].map(([, id, name]) => [id, name]);
    expect(links).toContainEqual(["sol", "Sun (Sol)"]);
    expect(links).toContainEqual(["luna", "Moon (Luna)"]);
    expect(links).toContainEqual(["rahu", "North Node (Caput Draconis)"]);
    expect(links).toContainEqual(["mercury", "Mercury"]);
  });
});
