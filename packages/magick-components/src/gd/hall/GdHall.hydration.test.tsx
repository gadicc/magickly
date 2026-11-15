// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { hydrateAt, renderAt } from "../../../../../tests/hydration.ts";
import { GdHall } from "./GdHall.tsx";
import * as Hall from "./tags.ts";
import type { HallNode } from "./types.ts";

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
  // The two halls (their officers' lamens are SVGs of their own).
  expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(2);
  await unmount();
});

it("hydrates a hall written as tags without a mismatch", async () => {
  const time = new Date("2026-10-17T00:00:00Z");
  const roles = ["keryx", "stolistes"] as const;
  const tags = (
    <GdHall wall="gradient">
      <Hall.Dais>
        <Hall.Officer role="pastHierophant" />
      </Hall.Dais>
      <Hall.Floor>
        <Hall.Pillar kind="white" x={12} y={3} glow />
        <Hall.Marker text="Lamp of the Kerux" x={4} y={9} />
        {roles.map((role, index) => (
          <Hall.Officer key={role} role={role} x={6 + 4 * index} y={12} />
        ))}
      </Hall.Floor>
      <Hall.Caption text="Hall" />
    </GdHall>
  );
  const element = (
    <div>
      {tags}
      <GdHall hall={Hall.hallFromTags(tags).hall} />
    </div>
  );
  const html = renderAt(time, element);
  const { container, problems, unmount } = await hydrateAt(time, html, element);
  expect(problems).toEqual([]);
  const halls = container.querySelectorAll('svg[role="img"]');
  expect(halls).toHaveLength(2);
  // The same drawing, but for the ids useId gives each.
  const [tagged, data] = [...halls].map((svg) => {
    const prefix = svg.querySelector("title")?.id.replace(/-title$/, "");
    expect(prefix).toBeTruthy();
    return svg.outerHTML.replaceAll(`${prefix}-`, "ID-");
  });
  expect(tagged).toBe(data);
  await unmount();
});

it("keys two doors in one place apart", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const door = { type: "door", x: 14, width: 2 };
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () =>
      root.render(
        <GdHall
          hall={{
            type: "gdHall",
            children: [{ type: "floor", children: [door, door] }],
          }}
        />,
      ),
    );
    expect(error).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    error.mockRestore();
  }
});
