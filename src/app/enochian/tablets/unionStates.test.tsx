// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tabletNameLinks } from "./nameLinks";
import Tablets from "./tablets";

// Imported on the server only; the tests read it directly.
vi.mock("server-only", () => ({}));
// The downloads' file names, without saving anything.
const runtime = vi.hoisted(() => ({ downloadBlob: vi.fn() }));
vi.mock("@/export/exportRuntime", async (original) => ({
  ...(await original<typeof import("@/export/exportRuntime")>()),
  downloadBlob: runtime.downloadBlob,
}));

const PAGE = "/enochian/tablets";
const LINKS = tabletNameLinks();

beforeEach(() => {
  window.history.replaceState(null, "", PAGE);
  runtime.downloadBlob.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Goes to another page of the tablets, as Back or a link would. */
const visit = (search: string) =>
  act(() => {
    window.history.replaceState(null, "", `${PAGE}${search}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

/** The name the SVG download is saved as, once the button is free. */
const downloaded = async () => {
  const button = screen.getAllByRole("button", { name: "Download SVG" })[0];
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  const calls = runtime.downloadBlob.mock.calls.length;
  fireEvent.click(button);
  expect(runtime.downloadBlob).toHaveBeenCalledTimes(calls + 1);
  return runtime.downloadBlob.mock.lastCall?.[1];
};

const live = (container: HTMLElement) =>
  container.querySelector('[role="tabpanel"] [aria-live="polite"]')
    ?.textContent;

const imageLinked = () =>
  screen.queryAllByRole("link", { name: "Open SVG image link" }).length > 0;

describe("/enochian/tablets' chosen square across tablets", () => {
  it("lets go of a Watchtower's square when the Union is chosen", async () => {
    const { container } = render(<Tablets links={LINKS} />);
    const grid = container.querySelector('svg[viewBox="0 0 244 264"]');
    // Row 7, square 6, in six names.
    fireEvent.click(grid?.querySelector('rect[x="102"][y="122"]') as Element);
    expect(container.querySelector("[data-square-choice]")).toBeTruthy();
    expect(await downloaded()).toBe("enochian-earth-tablet-row7-square6.svg");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Tablet" }));
    fireEvent.click(screen.getByRole("option", { name: "Tablet of Union" }));
    expect(container.querySelector("[data-square-choice]")).toBeNull();
    expect(container.querySelector("[data-square]")).toBeNull();
    expect(live(container)).toBe("");
    expect(imageLinked()).toBe(true);
    expect(await downloaded()).toBe("enochian-union-tablet.svg");
  });

  it("lets go of a Union square when a Watchtower is chosen", () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=union`);
    const { container } = render(<Tablets links={LINKS} />);
    const union = container.querySelector('svg[viewBox="0 0 124 104"]');
    // Row 1, square 1: EXARP and the first column.
    fireEvent.click(union?.querySelector('rect[x="12"][y="12"]') as Element);
    expect(container.querySelector("[data-square-choice]")).toBeTruthy();
    visit("?tablet=earth");
    expect(container.querySelector("[data-square-choice]")).toBeNull();
    expect(container.querySelector("[data-square]")).toBeNull();
    expect(live(container)).toBe("");
    expect(imageLinked()).toBe(true);
  });
});

describe("/enochian/tablets' choices that draw nothing on the Union", () => {
  it("withhold no image link and rename no download", async () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=union`);
    render(<Tablets links={LINKS} />);
    // No square differs, none is reversed, none has a second letter.
    fireEvent.click(screen.getByRole("tab", { name: "Differences" }));
    fireEvent.click(screen.getByRole("switch", { name: "Reversed letters" }));
    fireEvent.click(screen.getByRole("switch", { name: "Second letters" }));
    expect(imageLinked()).toBe(true);
    expect(await downloaded()).toBe("enochian-union-tablet.svg");
    expect(screen.queryByText(/^Second letters in/)).toBeNull();
  });

  it("still count where a Watchtower draws them", async () => {
    render(<Tablets links={LINKS} />);
    fireEvent.click(screen.getByRole("switch", { name: "Second letters" }));
    fireEvent.click(screen.getByRole("switch", { name: "Reversed letters" }));
    expect(imageLinked()).toBe(false);
    expect(screen.getByText(/^Second letters in \d+ squares/)).toBeTruthy();
    expect(await downloaded()).toBe(
      "enochian-earth-tablet-second-letters-plain.svg",
    );
  });

  it("shows no second letters' list where there is no Union", () => {
    window.history.replaceState(null, "", `${PAGE}?tablet=union&version=dee`);
    render(<Tablets links={LINKS} />);
    fireEvent.click(screen.getByRole("switch", { name: "Second letters" }));
    expect(screen.queryByText(/^Second letters in/)).toBeNull();
  });
});
