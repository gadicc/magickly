// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import HallPlayground from "./HallPlayground";

// A hall too large to keep: the draft module says so.
vi.mock("./hallDraft", async (importActual) => ({
  ...(await importActual<typeof import("./hallDraft")>()),
  writeHallDraft: () => "too-large",
}));

afterEach(cleanup);

it("says when a hall is too large to keep as a draft", async () => {
  render(<HallPlayground />);
  expect(
    await screen.findByText(
      "This hall is too large to keep as a draft in this browser.",
    ),
  ).toBeTruthy();
});
