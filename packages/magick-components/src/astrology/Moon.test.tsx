// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hydrateAt, renderAt } from "../../../../tests/hydration.ts";
import MoonWidget, { moonMeanInclination, moonPath } from "./Moon.tsx";

// Pages with the widget are prerendered at build time and viewed later.
const buildTime = new Date("2026-09-17T10:16:00Z"); // phase 0.2066
const visitTime = new Date("2026-10-20T12:00:00Z"); // phase 0.3061

afterEach(() => {
  vi.useRealTimers();
});

describe("moonPath", () => {
  it("draws the terminator for each quarter", () => {
    expect(moonPath(0)).toBe("m85,5 a20,20 0 1,1 0,150 a20,20 0 1,0 0,-150");
    expect(moonPath(0.125)).toBe(
      "m85,5 a10,20 0 1,1 0,150 a20,20 0 1,0 0,-150",
    );
    expect(moonPath(0.25)).toBe("m85,5 a0,20 0 1,1 0,150 a20,20 0 1,0 0,-150");
    expect(moonPath(0.5)).toBe("m85,5 a20,20 0 1,0 0,150 a20,20 0 1,0 0,-150");
    expect(moonPath(0.75)).toBe("m85,5 a0,20 0 1,1 0,150 a20,20 0 1,1 0,-150");
    expect(moonPath(1)).toBe("m85,5 a20,20 0 1,0 0,150 a20,20 0 1,1 0,-150");
  });

  it("rejects a phase past one lunation", () => {
    expect(() => moonPath(1.01)).toThrow("Invalid phase: 1.01");
  });
});

describe("MoonWidget", () => {
  it("prerenders the unlit disc and a blank label", () => {
    const html = renderAt(buildTime, <MoonWidget />);

    expect(html).not.toContain('class="moon"');
    expect(html).toContain('class="back"');
    expect(html).toContain(">\u00a0</div>");
  });

  it("hydrates a later visit without mismatches, then draws its phase", async () => {
    const html = renderAt(buildTime, <MoonWidget />);
    const { container, problems, unmount } = await hydrateAt(
      visitTime,
      html,
      <MoonWidget />,
    );

    expect(problems).toEqual([]);
    expect(container.querySelector("path.moon")?.getAttribute("d")).toBe(
      moonPath(0.3061426907762426),
    );
    expect(container.textContent).toBe("Waxing Gibbous");
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("transform")).toBe(
      `rotate(${moonMeanInclination})`,
    );

    await unmount();
  });

  describe("the hemisphere", () => {
    const transform = (latitude?: number) => {
      const holder = document.createElement("div");
      holder.innerHTML = renderToString(<MoonWidget latitude={latitude} />);
      return holder.querySelector("svg")?.getAttribute("transform");
    };
    const north = `rotate(${moonMeanInclination})`;
    const south = `rotate(${180 - moonMeanInclination})`;

    it("is northern until the latitude is known", () => {
      expect(transform()).toBe(north);
    });

    it("is southern south of the equator, and northern on it", () => {
      expect(transform(-33.92)).toBe(south);
      expect(transform(0)).toBe(north);
      expect(transform(51.5)).toBe(north);
    });
  });
});
