// @vitest-environment jsdom
import { DateTime, Settings } from "luxon";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moonMeanInclination } from "@/components/astrology/Moon";
import { resetPlaceStore } from "@/geo/usePlace";
import { hydrateAt, renderAt } from "../../../../tests/hydration";
import Moon from "./moon";

// The page is prerendered at build time and viewed in a later lunation.
const buildTime = new Date("2026-09-17T10:16:00Z");
const visitTime = new Date("2026-10-20T12:00:00Z");
const { defaultLocale } = Settings;

const dates = (container: HTMLElement) =>
  [...container.querySelectorAll(".date")].map((date) => date.textContent);
const pastTitles = (container: HTMLElement) =>
  [...container.querySelectorAll(".past .title")].map(
    (title) => title.textContent,
  );

let answerGeo: (place: unknown) => void;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetPlaceStore();
  // The place lookup answers only when a test calls `answerGeo`.
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
  Settings.defaultLocale = "en-GB";
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Settings.defaultZone = "system";
  Settings.defaultLocale = defaultLocale;
});

describe("Moon page", () => {
  it("prerenders the lunation without dates", () => {
    Settings.defaultZone = "UTC";
    const html = renderAt(buildTime, <Moon />);

    expect(html).toContain("Last New Moon");
    expect(html).not.toContain("2026");
    expect(html).not.toContain(" past");
  });

  it("hydrates a later visit in another time zone without mismatches", async () => {
    Settings.defaultZone = "UTC";
    const html = renderAt(buildTime, <Moon />);

    Settings.defaultZone = "Pacific/Auckland";
    const { container, problems, unmount } = await hydrateAt(
      visitTime,
      html,
      <Moon />,
    );

    expect(problems).toEqual([]);
    expect(dates(container)).toEqual(
      [
        "2026-10-10T15:50:11.601Z",
        "2026-10-18T16:13:37.090Z",
        "2026-10-26T04:13:07.602Z",
        "2026-11-01T20:30:02.522Z",
        "2026-11-09T07:02:30.192Z",
        "2026-11-24T14:55:02.514Z",
      ].map((iso) =>
        DateTime.fromISO(iso).toLocaleString(DateTime.DATETIME_FULL),
      ),
    );
    expect(dates(container)[0]).toContain("11 October 2026");
    expect(pastTitles(container)).toEqual([
      "🌑 Last New Moon 🌑",
      "🌓 First Quarter 🌓",
    ]);

    await unmount();
  });
});

describe("the Moon page's drawing", () => {
  it("turns for a place south of the equator", async () => {
    const html = renderAt(buildTime, <Moon />);
    const { container, problems, unmount } = await hydrateAt(
      visitTime,
      html,
      <Moon />,
    );
    const transform = () =>
      container.querySelector("svg")?.getAttribute("transform");
    expect(problems).toEqual([]);
    expect(transform()).toBe(`rotate(${moonMeanInclination})`);

    await act(async () => {
      answerGeo({ name: "Cape Town", latitude: -33.92, longitude: 18.42 });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(transform()).toBe(`rotate(${180 - moonMeanInclination})`);
    await unmount();
  });
});
