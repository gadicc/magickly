// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RitualRow } from "@/doc/ritualHalls";
import type { DocNode } from "@/schemas";
import { DocView } from "./[_id]/DocRender";
import DocPageShell from "./DocPageShell";
import ReaderShell from "./ReaderShell";

// The halls' drawings load their own chunk; the anchor is on the figure.
vi.mock("@/doc/ritualBlocks/GdHallDrawing", () => ({ default: () => null }));
// The built-in sources are pug text; DocLoader's own drawing is DocView's.
vi.mock("./[_id]/DocLoader", () => ({
  default: ({ id, prerender }: { id: string; prerender?: boolean }) => (
    <output data-prerender={String(Boolean(prerender))}>{id}</output>
  ),
}));

afterEach(cleanup);

const doc = {
  children: [
    {
      type: "declareVar",
      name: "myRole",
      label: "My Role",
      default: "member",
      varType: "select",
      children: [{ type: "option", value: "member", label: "Member" }],
    },
    { type: "title", text: "Opening" },
    { type: "gdHall", children: [{ type: "caption", text: "Temple" }] },
  ] satisfies RitualRow[],
} as unknown as DocNode;

const areas = (container: HTMLElement) =>
  [
    ...container.querySelectorAll<HTMLElement>(
      "[data-reader-shell] > [data-reader-area]",
    ),
  ].map((area) => area.dataset.readerArea);

describe("the reader shell", () => {
  it("puts the title, the variables and the ritual in its areas, in order", () => {
    const { container } = render(
      <ReaderShell title={<h1>Synthetic Opening</h1>}>
        <DocView doc={doc} searchParams={null} />
      </ReaderShell>,
    );
    expect(areas(container)).toEqual(["title", "controls", "body"]);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(
      heading.closest("[data-reader-area]")?.getAttribute("data-reader-area"),
    ).toBe("title");
    expect(
      screen
        .getByRole("combobox", { name: "My Role" })
        .closest("[data-reader-area]")
        ?.getAttribute("data-reader-area"),
    ).toBe("controls");
    // Both anchors are in the body, under its app-bar scroll margin.
    const body = container.querySelector('[data-reader-area="body"]')!;
    expect(body.querySelector("#Opening")).not.toBeNull();
    expect(body.querySelector("#hall-1")).not.toBeNull();
    // The ritual stays ltr and language-neutral; the title is outside it.
    const ritual = body.querySelector(".docBody")!;
    expect(ritual.getAttribute("dir")).toBe("ltr");
    expect(ritual.contains(heading)).toBe(false);
  });

  it("scales the variables and the ritual with the text size, not the title", () => {
    const { container } = render(
      <ReaderShell title={<h1>Synthetic Opening</h1>}>
        <DocView doc={doc} searchParams={null} />
      </ReaderShell>,
    );
    for (const area of ["controls", "body"])
      expect(
        container.querySelector<HTMLElement>(`[data-reader-area="${area}"]`)
          ?.style.fontSize,
      ).toBe("100%");
    expect(
      container.querySelector<HTMLElement>('[data-reader-area="title"]')?.style
        .fontSize,
    ).toBe("");
  });

  it("draws the editor's preview without it", () => {
    const { container } = render(
      <DocView
        doc={doc}
        searchParams={null}
        hallNavigation={false}
        chrome={false}
      />,
    );
    expect(container.querySelector("[data-reader-area]")).toBeNull();
    expect(container.querySelector("[data-reader-shell]")).toBeNull();
    expect(container.querySelector(".docBody")).not.toBeNull();
    // The floating button stays.
    expect(
      screen.getByRole("button", { name: "SpeedDial basic example" }),
    ).toBeTruthy();
  });

  it("server-renders a message on the surface without a title", () => {
    const html = renderToString(
      <ReaderShell>
        <p>Loading ritual...</p>
      </ReaderShell>,
    );
    expect(html).toContain("data-reader-shell");
    expect(html).not.toContain("data-reader-area");
    expect(html).toContain("Loading ritual...");
  });

  it("gives fragment targets in the ritual a margin for the app bar", () => {
    const css = readFileSync("src/app/doc/readerShell.module.css", "utf8");
    expect(css).toMatch(
      /\.body :global\(\[id\]\) \{\s*scroll-margin-block-start: calc\(var\(--app-bar, 56px\) \+ 8px\);/,
    );
  });
});

describe("a built-in ritual's page", () => {
  it("prerenders its h1 in the shell, above the ritual's fallback", () => {
    const page = document.createElement("div");
    page.innerHTML = renderToString(
      <DocPageShell id="neophyte" title="Neophyte Ritual" />,
    );
    const shell = page.querySelector("[data-reader-shell]")!;
    const heading = shell.querySelector("h1")!;
    expect(heading.textContent).toBe("Neophyte Ritual");
    expect(heading.parentElement?.dataset.readerArea).toBe("title");
    // The loader is the shell's, after the title.
    const loader = shell.querySelector("output")!;
    expect(loader.textContent).toBe("neophyte");
    expect(heading.compareDocumentPosition(loader)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
