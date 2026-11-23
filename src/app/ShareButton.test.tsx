// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithShare } from "../../tests/pageShare";
import { type PageShare, usePageShare } from "./pageShare";

// renderWithShare puts Share beside the page, as SiteChrome does.
function Page({ share }: { share?: PageShare }) {
  usePageShare(share);
  return null;
}

const writeText = vi.fn(async (_text: string) => {});
const shareSheet = vi.fn(async (_data: ShareData) => {});

/** A browser with or without Web Share, with a clipboard or none. */
function browser({ share = false, clipboard = true } = {}) {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share ? shareSheet : undefined,
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: clipboard ? { writeText } : undefined,
  });
}

const tap = () =>
  fireEvent.click(screen.getByRole("button", { name: "share" }));

const PERSONAL: PageShare = {
  url: () => "/gd/sigils?text=%D7%92%D7%93%D7%99",
  personal: true,
};
const sigilLink = () =>
  `${window.location.origin}/gd/sigils?text=%D7%92%D7%93%D7%99`;

beforeEach(() => {
  window.history.replaceState(null, "", "/gd/sigils");
});
afterEach(() => {
  cleanup();
  writeText.mockReset();
  shareSheet.mockReset();
  browser({ share: false, clipboard: false });
});

describe("Share without the browser's share sheet", () => {
  it("copies the address bar's page and says so", async () => {
    browser();
    renderWithShare(<Page />);
    tap();
    expect(await screen.findByText("Copied link to this page")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it("copies a registered page's link, saying it carries what was entered", async () => {
    browser();
    renderWithShare(<Page share={PERSONAL} />);
    tap();
    expect(
      await screen.findByText(
        "Copied link to this page. It includes what you entered here.",
      ),
    ).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(sigilLink());
  });

  it("says so when the link cannot be copied either", async () => {
    browser({ clipboard: false });
    renderWithShare(<Page share={PERSONAL} />);
    tap();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Could not copy the link to this page.");
    expect(alert.className).toContain("MuiAlert-colorError");
  });
});

describe("Share with the browser's share sheet", () => {
  it("sends a registered page's link through it, and says nothing", async () => {
    browser({ share: true });
    renderWithShare(<Page share={PERSONAL} />);
    tap();
    await vi.waitFor(() => expect(shareSheet).toHaveBeenCalledTimes(1));
    expect(shareSheet.mock.calls[0][0]).toMatchObject({
      title: "Test page - magick.ly",
      url: sigilLink(),
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends the address bar's page when no page registers one", async () => {
    browser({ share: true });
    window.history.replaceState(null, "", "/kabbalah/tree?colorScale=king");
    renderWithShare(<Page />);
    tap();
    await vi.waitFor(() => expect(shareSheet).toHaveBeenCalledTimes(1));
    expect(shareSheet.mock.calls[0][0].url).toBe(
      `${window.location.origin}/kabbalah/tree?colorScale=king`,
    );
    expect(writeText).not.toHaveBeenCalled();
  });

  it.each([
    ["the reader dismisses the sheet", "AbortError"],
    ["the reader taps again while it is open", "InvalidStateError"],
  ])("says nothing when %s", async (_case, name) => {
    browser({ share: true });
    shareSheet.mockRejectedValue(new DOMException("no", name));
    renderWithShare(<Page />);
    tap();
    await vi.waitFor(() => expect(shareSheet).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("falls back to copying when the sheet fails otherwise", async () => {
    browser({ share: true });
    shareSheet.mockRejectedValue(new DOMException("no", "NotAllowedError"));
    renderWithShare(<Page share={PERSONAL} />);
    tap();
    expect(
      await screen.findByText(
        "Copied link to this page. It includes what you entered here.",
      ),
    ).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(sigilLink());
  });

  it("says so when the copy after a failed sheet is refused too", async () => {
    // Outside the tap by then, which Safari and Firefox usually refuse.
    browser({ share: true });
    shareSheet.mockRejectedValue(new DOMException("no", "NotAllowedError"));
    writeText.mockRejectedValue(new DOMException("no", "NotAllowedError"));
    renderWithShare(<Page share={PERSONAL} />);
    tap();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Could not copy the link to this page.");
    expect(writeText).toHaveBeenCalledWith(sigilLink());
  });
});
