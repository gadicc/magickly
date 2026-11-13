// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import SourceLink from "./SourceLink";

afterEach(cleanup);

const PAGE_URL =
  "https://archive.org/details/theomagiaortempl00heyd/page/n124/mode/1up";

/**
 * The dialog's module loads on the first click, and each wait below allows
 * 5 s for it on a loaded machine; the tests that open it allow for those.
 */
const OPENS_DIALOG = 20_000;

describe("SourceLink", () => {
  it("is a plain link to archive.org until JavaScript runs", () => {
    const html = renderToString(
      <SourceLink plain page="heydon13">
        p. 13
      </SourceLink>,
    );
    expect(html).toBe(`<a href="${PAGE_URL}" aria-haspopup="dialog">p. 13</a>`);
  });

  it(
    "opens the mirrored page in a dialog, and closes it on Escape",
    async () => {
      render(
        <p>
          See <SourceLink page="heydon13">Heydon, p. 13</SourceLink>.
        </p>,
      );
      const link = screen.getByRole("link", { name: "Heydon, p. 13" });
      expect(link.getAttribute("href")).toBe(PAGE_URL);
      link.focus();
      fireEvent.click(link);
      // The dialog's module loads on the first click; allow a loaded machine.
      const dialog = await screen.findByRole(
        "dialog",
        { name: "Heydon, Theomagia (1663/4), p. 13" },
        { timeout: 5000 },
      );
      expect(dialog.getAttribute("aria-describedby")).toBeTruthy();

      const image = screen.getByRole("img", {
        name: "Heydon, Theomagia (1663/4), p. 13, as printed; outlined: the Rulers' sigils, in the first column.",
      });
      expect(image.getAttribute("src")).toBe(
        "/sources/heydon-theomagia-1663-p13.webp",
      );
      expect(image.getAttribute("width")).toBe("1600");
      expect(image.getAttribute("height")).toBe("2729");
      // The pan and zoom surface is named for the page, not a hall.
      expect(
        screen.getByRole("group", {
          name: "Heydon, Theomagia (1663/4), p. 13, the printed page",
        }),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Zoom in" })).toBeTruthy();
      // The outline sits over the Rulers' column.
      const outline = dialog.querySelector<HTMLElement>("[data-highlight]");
      expect(outline?.getAttribute("aria-hidden")).toBe("true");

      // The caption links the page and the whole book.
      expect(
        screen.getByRole("link", { name: "this page" }).getAttribute("href"),
      ).toBe(PAGE_URL);
      expect(
        screen
          .getByRole("link", { name: "the whole book" })
          .getAttribute("href"),
      ).toBe("https://archive.org/details/theomagiaortempl00heyd");
      expect(
        screen.getByText(/Scanned from the Getty Research Institute's copy/),
      ).toBeTruthy();

      fireEvent.keyDown(dialog, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
        timeout: 5000,
      });
      // Focus goes back to the link.
      expect(document.activeElement).toBe(link);

      // It opens again, and the Close button closes it.
      fireEvent.click(link);
      await screen.findByRole("dialog");
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
        timeout: 5000,
      });
    },
    OPENS_DIALOG,
  );

  it("leaves a click with a modifier key, or another button, to the browser", () => {
    render(<SourceLink page="agrippa149">Agrippa</SourceLink>);
    const link = screen.getByRole("link", { name: "Agrippa" });
    for (const init of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { button: 1 },
    ]) {
      // `fireEvent` returns false when the default was prevented.
      expect(fireEvent.click(link, init), JSON.stringify(init)).toBe(true);
    }
    expect(fireEvent.click(link)).toBe(false);
  });

  it(
    "names Agrippa's page and the copy scanned",
    async () => {
      render(<SourceLink page="agrippa149">Agrippa</SourceLink>);
      fireEvent.click(screen.getByRole("link", { name: "Agrippa" }));
      await screen.findByRole(
        "dialog",
        { name: "Agrippa, De occulta philosophia (1533), book II, p. CXLIX" },
        { timeout: 5000 },
      );
      expect(
        screen.getByText(
          /Outlined: the Moon's intelligence of intelligences, numbered 3321\. Scanned from the Library of Congress's copy/,
        ),
      ).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "this page" }).getAttribute("href"),
      ).toBe(
        "https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n164/mode/1up",
      );
    },
    OPENS_DIALOG,
  );
});
