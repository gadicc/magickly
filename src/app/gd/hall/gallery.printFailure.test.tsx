// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import HallGallery from "./gallery";

const runtime = vi.hoisted(() => ({
  rasterizeSvg: vi.fn(),
  downloadBlob: vi.fn(),
  copySvg: vi.fn(),
  copyPng: vi.fn(),
  copyText: vi.fn(),
}));
vi.mock("@/export/exportRuntime", () => runtime);
// The printer loads but cannot print the hall.
vi.mock("@/doc/gdHallPug", () => ({
  gdHallPug: () => {
    throw new Error("Invalid semantic document");
  },
}));

afterEach(cleanup);

it("tells a printer error from a refused clipboard", async () => {
  render(<HallGallery />);
  const button = screen.getByRole("button", { name: "Copy Pug source" });
  await waitFor(() => expect(button).toHaveProperty("disabled", false));
  fireEvent.click(button);
  await screen.findByText(
    "Could not copy: this hall could not be written as Pug.",
  );
  expect(runtime.copyText).not.toHaveBeenCalled();
});

it("ignores a printer that loads after the gallery is gone", async () => {
  const { unmount } = render(<HallGallery />);
  unmount();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(document.body.textContent).toBe("");
});
