// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Tablets from "./tablets";

// Whether three.js has been imported: the flat page must never import it,
// and the 3D view only once the loader renders.
const three = vi.hoisted(() => ({ imported: 0 }));
vi.mock("three", async (original) => {
  three.imported += 1;
  return original();
});

const PAGE = "/enochian/tablets";
const at = (query: string) => {
  window.history.replaceState(null, "", `${PAGE}${query}`);
  return render(<Tablets />);
};
const LOADING = "Loading the 3D view…";
const NO_WEBGL =
  "This browser cannot show the 3D view, so the tablet is drawn flat.";
const saveButtons = () => screen.queryAllByRole("button", { name: /^Save/ });

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", PAGE);
  vi.restoreAllMocks();
});

// In order: three's import is counted across the file.
describe("the tablets page's 3D view (plan 101, stage 3)", () => {
  it("is not there without pyramids or without 3d=1, and three is not loaded", () => {
    for (const query of [
      "?tablet=fire&3d=1",
      "?tablet=fire&pyramids=1",
      "?tablet=fire&version=dee&pyramids=1&3d=1",
    ]) {
      const { container } = at(query);
      expect(screen.queryByText(LOADING)).toBeNull();
      expect(container.querySelector("[aria-roledescription]")).toBeNull();
      expect(saveButtons().length).toBeGreaterThan(0);
      cleanup();
    }
    expect(three.imported).toBe(0);
  });

  it("takes the flat drawing's place with pyramids and 3d=1, without the export box", () => {
    const { container } = at("?tablet=fire&pyramids=1&symbols=1&3d=1");
    expect(screen.getByText(LOADING)).toBeTruthy();
    expect(container.querySelector("[data-pyramid]")).toBeNull();
    expect(saveButtons()).toHaveLength(0);
    // The loader renders; three comes only with the view's own chunk.
    expect(three.imported).toBe(0);
  });

  it("draws the tablet flat again, and says why, where WebGL cannot be made", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = at("?tablet=fire&pyramids=1&3d=1");
    expect(await screen.findByText(NO_WEBGL)).toBeTruthy();
    expect(three.imported).toBe(1);
    expect(screen.queryByText(LOADING)).toBeNull();
    expect(container.querySelector("[data-pyramid]")).not.toBeNull();
    expect(saveButtons().length).toBeGreaterThan(0);
  });
});
