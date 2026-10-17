// @vitest-environment jsdom

import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("switches presets, compares with the drawing and shows both sizes", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Both sizes" }));
    expect(halls()).toEqual(["Zelator Temple 1", "Zelator Temple 1"]);
    const [drawing, uniform] = document.querySelectorAll("figure:has(svg)");
    expect(
      within(drawing as HTMLElement).getByText("Drawing sizes"),
    ).toBeTruthy();
    expect(
      within(uniform as HTMLElement).getByText("Uniform sizes"),
    ).toBeTruthy();
    const [a, b] = document.querySelectorAll("svg[role=img]");
    // Uniform sizes draw the officers at one common size.
    expect(a.innerHTML).not.toBe(b.innerHTML);
    expect(screen.getAllByLabelText("Download PNG")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Uniform sizes" }));
    expect(halls()).toEqual(["Zelator Temple 1"]);
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

describe("the gallery's sources", () => {
  it("find each preset's original drawing", () => {
    expect(HALL_PRESETS.map(originalDrawing)).toEqual(
      HALL_PRESETS.map((preset) => `/pics/${preset.id}.svg`),
    );
  });
});
