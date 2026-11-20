// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import Tablet, { type TabletSquare } from "./Tablet.tsx";

let container: HTMLDivElement | undefined;
let root: ReturnType<typeof createRoot> | undefined;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

function mount(element: React.ReactElement) {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  const created = createRoot(container);
  root = created;
  act(() => created.render(element));
  return container;
}

const click = (element: Element | null | undefined) =>
  act(() => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

describe("Tablet's squares chosen by pointer", () => {
  it("calls onSelect for any square with anySquare, from its ground or its letter", () => {
    const onSelect = vi.fn<(square: TabletSquare) => void>();
    const page = mount(
      <Tablet
        tablet="earth"
        showSecondLetters
        highlights={{
          squares: [],
          anySquare: true,
          onSelect,
          // Drawn over or under the letters, it lets clicks through.
          name: { squares: [{ row: 6, column: 6 }] },
          regions: true,
        }}
      />,
    );
    const grid = page.querySelector('svg[viewBox="0 0 244 264"]');
    // Every drawn layer takes no clicks, so a browser hands a click on a
    // tint, the veil or a flag to the square beneath: jsdom does no hit
    // testing, so that is checked here as the style that does it.
    const layers = grid?.querySelectorAll(
      "[data-regions], [data-region], [data-highlight], [data-start], [data-order]",
    );
    expect(layers?.length).toBeGreaterThan(4);
    for (const layer of layers ?? [])
      expect(
        layer.closest(
          '[style*="pointer-events:none"],[style*="pointer-events: none"]',
        ),
        layer.outerHTML.slice(0, 60),
      ).toBeTruthy();
    // Row 7, square 6's ground (x 102, y 122) and Earth's first letter.
    click(grid?.querySelector('rect[x="102"][y="122"]'));
    expect(onSelect).toHaveBeenLastCalledWith({ row: 6, column: 5 });
    click(grid?.querySelector("text"));
    expect(onSelect).toHaveBeenLastCalledWith({ row: 0, column: 0 });
    // A second letter in a corner is its square's too.
    const corner = grid?.querySelector("text[data-alt]");
    click(corner);
    const x = Number(corner?.getAttribute("x"));
    expect(onSelect.mock.lastCall?.[0].column).toBe(Math.floor((x - 2) / 20));
    // The frame round the grid is no square.
    const calls = onSelect.mock.calls.length;
    click(grid?.querySelector("rect:last-child"));
    expect(onSelect).toHaveBeenCalledTimes(calls);
  });

  it("calls onSelect for an outlined square once, and for no other without anySquare", () => {
    const onSelect = vi.fn();
    const page = mount(
      <Tablet
        tablet="earth"
        highlights={{
          squares: [{ row: 0, column: 0 }],
          onSelect,
          anySquare: true,
        }}
      />,
    );
    click(page.querySelector('[data-square="0,0"]'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    act(() => root?.unmount());
    root = undefined;
    const plain = mount(
      <Tablet tablet="earth" highlights={{ squares: [], onSelect }} />,
    );
    click(plain.querySelector('svg[viewBox="0 0 244 264"] text'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("takes the same choices on the Tablet of Union, which draws in its root", () => {
    const onSelect = vi.fn<(square: TabletSquare) => void>();
    const page = mount(
      <Tablet
        tablet="union"
        highlights={{
          squares: [{ row: 3, column: 4 }],
          anySquare: true,
          onSelect,
          name: { squares: [{ row: 0, column: 0 }] },
          preview: { squares: [{ row: 1, column: 0 }] },
        }}
      />,
    );
    const svg = page.querySelector('svg[viewBox="0 0 124 104"]');
    for (const layer of svg?.querySelectorAll(
      "[data-highlight], [data-start]",
    ) ?? [])
      expect(
        layer.closest(
          '[style*="pointer-events:none"],[style*="pointer-events: none"]',
        ),
      ).toBeTruthy();
    // NANTA's second square (row 3, square 2): its ground, then its letter.
    click(svg?.querySelector('rect[x="32"][y="52"]'));
    expect(onSelect).toHaveBeenLastCalledWith({ row: 2, column: 1 });
    click(svg?.querySelectorAll("text")[19]);
    expect(onSelect).toHaveBeenLastCalledWith({ row: 3, column: 4 });
    // The outlined square calls once; the frame and the margin not at all.
    const calls = onSelect.mock.calls.length;
    click(svg?.querySelector('[data-square="3,4"]'));
    expect(onSelect).toHaveBeenCalledTimes(calls + 1);
    click(svg?.querySelector('rect[width="100"]'));
    click(svg);
    expect(onSelect).toHaveBeenCalledTimes(calls + 1);
  });
});
