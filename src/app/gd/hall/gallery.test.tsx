// @vitest-environment jsdom

import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseRitualPug, RITUAL_PUG_HEADER } from "@/doc/ritualPug";
import HallGallery, { originalDrawing } from "./gallery";
import HallPage from "./page";

const runtime = vi.hoisted(() => ({
  rasterizeSvg: vi.fn(),
  downloadBlob: vi.fn(),
  copySvg: vi.fn(),
  copyPng: vi.fn(),
  copyText: vi.fn(),
}));
vi.mock("@/export/exportRuntime", () => runtime);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const halls = () =>
  [...document.querySelectorAll("svg[role=img]")].map(
    (svg) => svg.querySelector("title")?.textContent,
  );

function choose(title: string) {
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(
    screen.getByRole("option", { name: new RegExp(`^${title}`) }),
  );
}

describe("the /gd/hall gallery", () => {
  it("declares the hall fonts once for the page, served from /fonts", () => {
    const markup = renderToStaticMarkup(<HallPage />);
    const style = markup.match(/<style>(.*?)<\/style>/s)?.[1] ?? "";
    expect(style.match(/@font-face/g)).toHaveLength(3);
    expect(style).toContain('src:url("/fonts/NotoSerif-Italic-latin1.woff2")');
    // The halls themselves carry no font rules, so SVG exports do not.
    expect(markup.match(/<style>/g)).toHaveLength(1);
  });

  it("shows the Neophyte hall first, with its export and its sources", () => {
    render(<HallGallery />);
    expect(halls()).toEqual(["Neophyte Temple"]);
    expect(screen.getAllByLabelText("Download PNG")).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "public/pics/neophyte.svg" }),
    ).toHaveProperty("href", `${location.origin}/pics/neophyte.svg`);
    expect(
      screen
        .getByRole("link", {
          name: "Regardie 1938, vol. 2, p.11 (archive.org leaf n3)",
        })
        .getAttribute("href"),
    ).toBe(
      "https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol2-1938/page/n3",
    );
    expect(screen.queryByRole("img", { name: /original drawing/ })).toBeNull();
  });

  it("switches presets and compares with the drawing", () => {
    render(<HallGallery />);
    choose("Zelator Temple 1");
    expect(halls()).toEqual(["Zelator Temple 1"]);

    fireEvent.click(screen.getByLabelText("Compare with the original drawing"));
    expect(
      screen
        .getByRole("img", {
          name: "The original drawing of the Zelator Temple 1",
        })
        .getAttribute("src"),
    ).toBe("/pics/zelator1.svg");

    expect(halls()).toEqual(["Zelator Temple 1"]);
    expect(
      within(
        document.querySelector("figure:has(svg)") as HTMLElement,
      ).getByText("From the preset"),
    ).toBeTruthy();
    expect(screen.getAllByLabelText("Download PNG")).toHaveLength(1);
    // One size of everything: no size strategies to choose between.
    expect(screen.queryByRole("button", { name: /sizes/i })).toBeNull();
  });

  it("exports the hall it shows", async () => {
    render(<HallGallery />);
    choose("Theoricus Temple 1");
    fireEvent.click(screen.getByLabelText("Download SVG"));
    expect(await screen.findByText("Downloading SVG")).toBeTruthy();
    const [blob, name] = runtime.downloadBlob.mock.calls[0] as [Blob, string];
    expect(name).toBe("gd-hall-theoricus1.svg");
    expect(await blob.text()).toContain(">Theoricus Temple 1</title>");
  });

  it("says when a book page is cited for part of a hall", () => {
    render(<HallGallery />);
    choose("Zelator Temple 2");
    expect(
      screen.getByText(/the Earth tablet, lamp and salt only/).textContent,
    ).toBe(
      "Regardie 1938, vol. 2, p.44 (archive.org leaf n38) (the Earth tablet, lamp and salt only)",
    );
  });
});

describe("the gallery's Copy Pug source", () => {
  it("copies the shown preset as Pug a ritual's source accepts", async () => {
    runtime.copyText.mockResolvedValue(undefined);
    render(<HallGallery />);
    choose("Zelator Temple 1");
    const button = screen.getByRole("button", { name: "Copy Pug source" });
    // The printer loads after the page.
    await waitFor(() => expect(button).toHaveProperty("disabled", false), {
      timeout: 30_000,
    });
    fireEvent.click(button);
    await screen.findByText("Copied. Paste it into a ritual's source.");
    const [text] = runtime.copyText.mock.calls[0];
    expect(text).toMatch(/^gdHall\(/);
    const [hall] = parseRitualPug(`${RITUAL_PUG_HEADER}\n${text}`).nodes;
    expect(JSON.stringify(hall)).toContain("Zelator Temple 1");
    // Choosing another hall clears the old status.
    choose("Neophyte Temple");
    expect(screen.queryByText(/^Copied/)).toBeNull();
  }, 60_000);

  it("says when the browser refuses the clipboard", async () => {
    runtime.copyText.mockRejectedValue(new Error("denied"));
    render(<HallGallery />);
    const button = screen.getByRole("button", { name: "Copy Pug source" });
    await waitFor(() => expect(button).toHaveProperty("disabled", false), {
      timeout: 30_000,
    });
    fireEvent.click(button);
    await screen.findByText(
      "Could not copy: the browser refused the clipboard.",
    );
  }, 60_000);
});

describe("the gallery's sources", () => {
  it("find each preset's original drawing", () => {
    expect(HALL_PRESETS.map(originalDrawing)).toEqual(
      HALL_PRESETS.map((preset) => `/pics/${preset.id}.svg`),
    );
  });
});
