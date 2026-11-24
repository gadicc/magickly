// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExportControls from "@/export/ExportControls";
import { renderWithShare } from "../../tests/pageShare";
import { type PageShare, PageShareProvider, usePageShare } from "./pageShare";
import ShareButton from "./ShareButton";

// renderWithShare puts the app bar's Share beside the page, as SiteChrome
// does; the page draws something with the export box under it, whose
// share row is the same Share (plan 097, decision 7).
function Page({ share }: { share?: PageShare }) {
  usePageShare(share);
  const ref = React.useRef<SVGSVGElement>(null);
  return (
    <>
      <svg ref={ref} viewBox="0 0 1 1" />
      <ExportControls target={ref} filename="page" />
    </>
  );
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

/** Both Shares: the app bar's icon, and the export box's share row. */
const SHARES = [
  ["the app bar's Share", "share"],
  ["the share row", "Share this page"],
] as const;
let shareName: string = SHARES[0][1];
const tap = () =>
  fireEvent.click(screen.getByRole("button", { name: shareName }));

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

describe.each(SHARES)("%s", (_which, name) => {
  beforeEach(() => {
    shareName = name;
  });

  describe("without the browser's share sheet", () => {
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

  describe("with the browser's share sheet", () => {
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
});

describe("both Shares", () => {
  it.each(SHARES)(
    "start the sheet or the copy inside the tap: %s",
    (_which, name) => {
      browser({ share: true });
      renderWithShare(<Page share={PERSONAL} />);
      fireEvent.click(screen.getByRole("button", { name }));
      // Synchronously, before any promise settles: the user gesture.
      expect(shareSheet).toHaveBeenCalledTimes(1);
      cleanup();
      browser();
      renderWithShare(<Page share={PERSONAL} />);
      fireEvent.click(screen.getByRole("button", { name }));
      expect(writeText).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["a personal page", PERSONAL],
    [
      "a page with its choices in a link",
      { url: () => "/kabbalah/tree?colorScale=king", personal: false },
    ],
    ["a page that registers nothing", undefined],
  ])("send the same link and say the same on %s", async (_case, share) => {
    const results: {
      withSheet: boolean;
      sent: string | ShareData;
      said: string | null;
    }[] = [];
    for (const withSheet of [false, true])
      for (const [, name] of SHARES) {
        cleanup();
        writeText.mockClear();
        shareSheet.mockClear();
        browser({ share: withSheet });
        renderWithShare(<Page share={share} />);
        fireEvent.click(screen.getByRole("button", { name }));
        const said = withSheet
          ? null
          : ((await screen.findByRole("alert")).textContent ?? "");
        results.push({
          withSheet,
          sent: withSheet
            ? shareSheet.mock.calls[0][0]
            : writeText.mock.calls[0][0],
          said,
        });
      }
    expect(results[1]).toEqual(results[0]);
    expect(results[3]).toEqual(results[2]);
    expect(results[0].said).toBe(
      share?.personal
        ? "Copied link to this page. It includes what you entered here."
        : "Copied link to this page",
    );
    expect(results[2].sent).toMatchObject({
      title: "Test page - magick.ly",
      url: results[0].sent,
    });
  });
});

describe("the share sheet's title", () => {
  afterEach(() => {
    document.title = "";
  });

  it.each([
    [
      "an untitled provider",
      (ui: React.ReactElement) =>
        render(<PageShareProvider>{ui}</PageShareProvider>),
    ],
    ["no provider", (ui: React.ReactElement) => render(ui)],
  ])("names the site once with %s", async (_case, mount) => {
    browser({ share: true });
    document.title = "Rose Sigils | Magick.ly";
    mount(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Share this page" }));
    expect(shareSheet.mock.calls[0][0]).toMatchObject({
      title: "Rose Sigils | Magick.ly",
      text: 'Check out "Rose Sigils" on magick.ly, the open source magick app!',
    });
  });
});

describe("the app bar's Share", () => {
  it("is not re-rendered while a page's registration changes", () => {
    let barRenders = 0;
    function Toggle() {
      const [personal, setPersonal] = React.useState(false);
      usePageShare({ url: () => "/gd/sigils", personal });
      const ref = React.useRef<SVGSVGElement>(null);
      return (
        <>
          <button type="button" onClick={() => setPersonal(!personal)}>
            toggle
          </button>
          <svg ref={ref} viewBox="0 0 1 1" />
          <ExportControls target={ref} filename="page" shareHint={null} />
        </>
      );
    }
    render(
      <PageShareProvider title="Test page">
        <React.Profiler
          id="bar"
          onRender={() => {
            barRenders++;
          }}
        >
          <ShareButton />
        </React.Profiler>
        <Toggle />
      </PageShareProvider>,
    );
    const before = barRenders;
    const hint = () => screen.queryByText("Includes what you entered");
    expect(hint()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    // The share row heard it…
    expect(hint()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(hint()).toBeNull();
    // …and the app bar did not.
    expect(barRenders).toBe(before);
  });
});
