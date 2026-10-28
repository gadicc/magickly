// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import HallPlayground from "./HallPlayground";

// A hall too large to keep: the draft module says so.
vi.mock("./hallDraft", async (importActual) => ({
  ...(await importActual<typeof import("./hallDraft")>()),
  writeHallDraft: () => "too-large",
}));

afterEach(cleanup);

// The real source panel and drawing: slow to render under load.
it("says when a hall is too large to keep as a draft", async () => {
  render(<HallPlayground />);
  // A change: the page writes only what it changed.
  const surface = screen.getByRole("application");
  fireEvent.keyDown(surface, { key: "Tab" });
  fireEvent.keyDown(surface, { key: "ArrowRight" });
  expect(
    await screen.findByText(
      "This hall is too large to keep as a draft in this browser: a draft holds at most 1,000 nodes and 96,000 characters.",
    ),
  ).toBeTruthy();
}, 20_000);
