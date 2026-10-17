// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { hydrateAt, renderAt } from "../../../../tests/hydration";
import { GdHall } from "./GdHall";
import type { HallNode } from "./types";

afterEach(() => {
  vi.useRealTimers();
});

const hall = {
  type: "gdHall",
  wall: "gradient",
  children: [
    {
      type: "dais",
      children: [{ type: "officer", role: "pastHierophant" }],
    },
    {
      type: "floor",
      children: [
        { type: "pillar", kind: "white", x: 12, y: 3, glow: true },
        { type: "marker", text: "Lamp of the Kerux", x: 4, y: 9 },
        { type: "hebrewLetter", letter: "resh", x: 8, y: 12 },
        { type: "unicorn", x: 2, y: 2 },
      ],
    },
    { type: "caption", text: "Hall" },
  ],
} as HallNode;

it("hydrates without a mismatch, ids included", async () => {
  const time = new Date("2026-10-17T00:00:00Z");
  const element = (
    <div>
      <GdHall hall={hall} />
      <GdHall hall={hall} fontBaseUrl="/fonts" />
    </div>
  );
  const html = renderAt(time, element);
  const { container, problems, unmount } = await hydrateAt(time, html, element);
  expect(problems).toEqual([]);
  expect(container.querySelectorAll("svg")).toHaveLength(2);
  await unmount();
});
