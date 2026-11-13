// @vitest-environment jsdom
import { within } from "@testing-library/react";
import { Settings } from "luxon";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hydrateAt, renderAt } from "../../../../tests/hydration";
import MercuryWidget from "./Mercury";

const defaultLocale = Settings.defaultLocale;
const defaultZone = Settings.defaultZone;

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock("./mercuryRetrograde");
  Settings.defaultLocale = defaultLocale;
  Settings.defaultZone = defaultZone;
});

/**
 * Lets the widget's dynamic import and its state update settle. The import
 * pulls in the ephemeris, which takes longer than half a second when the
 * whole suite is running, so the wait is generous.
 */
async function settle(container: HTMLElement) {
  for (let tries = 0; tries < 300; tries++) {
    if (container.textContent?.trim()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error("The widget's label stayed blank for 3s");
}

describe("MercuryWidget", () => {
  it("hydrates a prerendered page, then fills in the dates", async () => {
    // Built by an en-US machine in New York months before the visit.
    Settings.defaultLocale = "en-US";
    Settings.defaultZone = "America/New_York";
    const html = renderAt(new Date("2026-07-01T12:00:00Z"), <MercuryWidget />);
    expect(html).not.toContain("Retro");
    expect(html).toContain(">\u00a0</div>");

    Settings.defaultLocale = "en-GB";
    Settings.defaultZone = "Europe/London";
    const { container, problems, unmount } = await hydrateAt(
      new Date("2026-10-30T12:00:00Z"),
      html,
      <MercuryWidget />,
    );

    expect(problems).toEqual([]);
    await settle(container);
    const label = within(container).getByText(/^Retro /);
    expect(label.textContent).toBe("Retro 24 Oct – 13 Nov");
    // 1rem, down to 9.5% of the tile's width, keeps it on one line.
    expect(label.style.fontSize).toBe("min(1rem, 9.5cqi)");

    await unmount();
  });

  it("says so when no retrograde comes back", async () => {
    vi.doMock("./mercuryRetrograde", () => ({
      currentOrNextRetrograde: () => undefined,
    }));

    const widget = <MercuryWidget image="/pics/mercury.webp" />;
    const html = renderAt(new Date("2026-10-30T12:00:00Z"), widget);
    const { container, problems, unmount } = await hydrateAt(
      new Date("2026-10-30T12:00:00Z"),
      html,
      widget,
    );

    expect(problems).toEqual([]);
    await settle(container);
    const label = within(container).getByText(/^Retro /);
    expect(label.textContent).toBe("Retro dates unknown");
    expect(container.querySelector("img")).not.toBeNull();

    await unmount();
  });

  it("draws the picture and background it is given, and none of its own", () => {
    const at = new Date("2026-10-30T12:00:00Z");
    const bare = renderAt(at, <MercuryWidget />);
    expect(bare).not.toContain("<img");
    expect(bare).not.toContain("url(");

    expect(
      renderAt(
        at,
        <MercuryWidget background="/sky.jpg" image="/mercury.webp" />,
      ),
    ).toContain('<img height="85" width="85" alt="" src="/mercury.webp"/>');
    // Props such as next/image's getImageProps() gives, srcSet and all.
    const responsive = renderAt(
      at,
      <MercuryWidget
        image={{ src: "/m.webp?w=256", srcSet: "/m.webp?w=96 1x", alt: "" }}
      />,
    );
    expect(responsive).toContain('srcSet="/m.webp?w=96 1x"');
    expect(renderAt(at, <MercuryWidget background="/sky.jpg" />)).toContain(
      "background:url(/sky.jpg)",
    );
  });
});
