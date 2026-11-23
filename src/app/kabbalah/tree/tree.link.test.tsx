// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copiedImageLink } from "../../../../tests/exportControls";
import TreeOfLife, { TreeOfLifeView } from "./tree";
import { DEFAULT_TREE_SETTINGS } from "./treeSettings";

const nav = vi.hoisted(() => ({
  search: "",
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/kabbalah/tree",
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace }),
}));

afterEach(() => {
  cleanup();
  nav.search = "";
  nav.replace.mockClear();
});

// The image link is copied, never shown, so this presses Link in a DOM;
// tree.test.tsx keeps the server rendering.
describe("TreeOfLifeView's image link", () => {
  it("copies the default image's link", async () => {
    render(<TreeOfLifeView settings={DEFAULT_TREE_SETTINGS} />);
    expect(await copiedImageLink()).toBe(
      "/api/render/tree-of-life?field=name.roman&bottomText=name.en&fontSize=10",
    );
  });
});

// Share sends the address bar's page (plan 097, decision 3), so the
// settings must live there: written on each change, read back on load.
describe("the Tree's settings in its address", () => {
  it("writes a change into the query", () => {
    nav.search = "field=name.roman";
    const { container } = render(<TreeOfLife />);
    fireEvent.change(
      container.querySelector('select[name="colorScale"]') as Element,
      { target: { value: "king" } },
    );
    expect(nav.replace).toHaveBeenLastCalledWith(
      "/kabbalah/tree?field=name.roman&colorScale=king",
    );
  });

  it("opens with the settings its query holds", () => {
    nav.search = "colorScale=king";
    const { container } = render(<TreeOfLife />);
    expect(
      (
        container.querySelector(
          'select[name="colorScale"]',
        ) as HTMLSelectElement
      ).value,
    ).toBe("king");
  });
});
