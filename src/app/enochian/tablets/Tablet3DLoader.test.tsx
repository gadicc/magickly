// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import enochianTablets, { tabletVersion } from "magick-data/enochian/tablets";
import { afterEach, describe, expect, it, vi } from "vitest";
import Tablet3DLoader from "./Tablet3DLoader";

// The view's chunk fails as many times as asked, then loads a stand-in.
const chunk = vi.hoisted(() => ({ failures: 0, imports: 0 }));
vi.mock("./three/Tablet3D", () => {
  chunk.imports += 1;
  if (chunk.failures > 0) {
    chunk.failures -= 1;
    throw new Error("Loading chunk tablet3d failed");
  }
  return { default: () => <div data-testid="view3d" /> };
});

const props = () => ({
  view: tabletVersion(enochianTablets.fire, "gd") as NonNullable<
    ReturnType<typeof tabletVersion>
  >,
  mirrorReversed: true,
  label: "The Fire tablet as pyramids, in 3D",
  unavailable: vi.fn(),
});

afterEach(cleanup);

// In order: next/dynamic keeps the first test's failed import, as a
// browser's page would.
describe("the 3D view's loader (plan 101)", () => {
  it("tells the page when the view's code will not load", async () => {
    chunk.failures = Number.POSITIVE_INFINITY;
    const each = props();
    render(<Tablet3DLoader {...each} />);
    await waitFor(() => expect(each.unavailable).toHaveBeenCalledWith("load"));
    expect(screen.queryByTestId("view3d")).toBeNull();
    // Both the first import and a fresh one were tried.
    expect(chunk.imports).toBeGreaterThanOrEqual(2);
  });

  it("tries a fresh import when asked again, and shows the view", async () => {
    chunk.failures = 0;
    const each = props();
    render(<Tablet3DLoader {...each} />);
    expect(await screen.findByTestId("view3d")).toBeTruthy();
    expect(each.unavailable).not.toHaveBeenCalled();
  });
});
