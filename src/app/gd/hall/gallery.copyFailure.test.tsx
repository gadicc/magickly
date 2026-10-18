// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import HallGallery from "./gallery";

// The printer's chunk fails to load, as it may offline before it is cached.
vi.mock("@/doc/gdHallPug", () => {
  throw new Error("Loading chunk failed");
});

afterEach(cleanup);

it("leaves Copy Pug source disabled, and says why, when the printer cannot load", async () => {
  render(<HallGallery />);
  const button = screen.getByRole("button", { name: "Copy Pug source" });
  // Let the failed import settle.
  await screen.findByText(
    "Copying Pug needs a part of the page that did not load. Reload when online.",
  );
  expect(button).toHaveProperty("disabled", true);
});

it("ignores a failed load after the gallery is gone", async () => {
  const { unmount } = render(<HallGallery />);
  unmount();
  // The failed import settles after unmounting; nothing is updated.
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(document.body.textContent).toBe("");
});
