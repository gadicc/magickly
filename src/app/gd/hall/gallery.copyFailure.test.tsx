// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import HallGallery from "./gallery";

// The printer's chunk fails to load, as it may offline before it is cached.
vi.mock("@/doc/gdHallPug", () => {
  throw new Error("Loading chunk failed");
});

afterEach(cleanup);

it("leaves Copy Pug source disabled when the printer cannot load", async () => {
  render(<HallGallery />);
  const button = screen.getByRole("button", { name: "Copy Pug source" });
  // Let the failed import settle.
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(button).toHaveProperty("disabled", true);
});
