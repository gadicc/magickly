// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import HallPlaygroundLoader from "./HallPlaygroundLoader";

// The editor's code does not load: a chunk lost offline, or after a deploy.
vi.mock("./HallPlayground", () => {
  throw new Error("Loading chunk 1234 failed");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("says when the editor could not load, and offers to reload", async () => {
  // React reports the error it caught; that is expected here.
  vi.spyOn(console, "error").mockImplementation(() => {});
  const reload = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({
    ...window.location,
    reload,
  });
  render(<HallPlaygroundLoader />);
  expect(
    await screen.findByText(
      "The hall editor could not load, or stopped working.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText("Loading the hall editor…")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  expect(reload).toHaveBeenCalledOnce();
});
