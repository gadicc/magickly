// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { GdHall } from "@magick-components/gd/hall";
import type { HallNode } from "@magick-components/gd/hall/types";
import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { prerender } from "react-dom/static";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { gdHallArt } from "@/app/gd/halls/art";
import "../../tests/hydration";
import { Render } from "./blocks";
import DocContext from "./context";
import { prepare } from "./prepare";
import { roles } from "./ritualBlocks/roles";
import { parseRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
import { semanticToJrt } from "./semantic";

// The hall chunk is a large module graph; load it once, so the tests time
// the drawing rather than its first transform on a busy machine.
beforeAll(async () => {
  await import("./ritualBlocks/GdHallDrawing");
}, 60_000);
afterEach(() => {
  cleanup();
  document.head.querySelector('style[data-href="gd-hall-fonts"]')?.remove();
});

const legacyPug = readFileSync("src/doc/fixtures/gdHallNeophyte.pug", "utf8");
const compiled = () =>
  semanticToJrt(parseRitualPug(`${RITUAL_PUG_HEADER}\n${legacyPug}`)) as {
    children: HallNode[];
  };

/** The reader as `DocRender` mounts it. */
const reader = (doc: unknown) => (
  <DocContext.Provider value={{ vars: {}, roles }}>
    <Render doc={doc} onChange={undefined} />
  </DocContext.Provider>
);

async function html(
  element: React.ReactElement,
  progressiveChunkSize?: number,
) {
  const { prelude } = await prerender(element, { progressiveChunkSize });
  return new Response(prelude).text();
}

it("draws a compiled hall in the reader once its chunk loads", async () => {
  const view = render(reader(compiled()));
  const figure = view.container.querySelector('[data-ritual-frame="gdHall"]');
  expect(figure).toBeTruthy();
  const svg = await screen.findByRole("img", { name: "Neophyte Temple" });
  expect(figure?.contains(svg)).toBe(true);
  expect(svg.querySelectorAll("use").length).toBeGreaterThan(20);
  // The rows are drawn, never rendered as ritual content.
  expect(view.container.textContent).not.toContain("officer");
  expect(screen.getByText("Let the hall be prepared.")).toBeTruthy();
  // One hoisted `@font-face` sheet for the page.
  const fonts = document.head.querySelectorAll(
    'style[data-href="gd-hall-fonts"]',
  );
  expect(fonts).toHaveLength(1);
  expect(fonts[0].textContent).toContain(
    'src:url("/fonts/NotoSerif-Italic-latin1.woff2")',
  );
});

it("draws prepare.js rows, numbers as strings, as it draws compiled rows", () => {
  const legacy = (prepare(legacyPug) as { children: HallNode[] }).children[2];
  const semantic = compiled().children[2];
  expect(legacy.dais).toBe("4");
  expect(semantic.dais).toBe(4);
  const svg = (hall: HallNode) =>
    renderToStaticMarkup(<GdHall hall={hall} art={gdHallArt} />);
  expect(svg(legacy)).toBe(svg(semantic));
  expect(svg(legacy)).toContain(">Dadouchos</text>");
});

it("server-renders the hall and hydrates it without a mismatch", async () => {
  const element = reader(compiled());
  // The drawing is larger than React's progressive chunk (12.8 KB), so the
  // server sends the placeholder and the drawing after it in the same
  // response, with the inline script that swaps them.
  const streamed = await html(element);
  expect(streamed).toMatch(
    /hallPlaceholder.*<svg.*>Neophyte Temple<\/title>.*\$RC\(/s,
  );
  // The placeholder takes the hall's estimated shape (the drawing: 0.752).
  expect(streamed).toMatch(
    /data-ritual-frame="gdHall"[^>]*style="--gd-hall-aspect:0\.74\d\d"/,
  );
  // Inlined, as a browser has it once that script ran.
  const markup = await html(element, Number.POSITIVE_INFINITY);
  expect(markup).toContain(">Neophyte Temple</title>");
  expect(markup).toContain('data-href="gd-hall-fonts"');
  expect(markup).not.toMatch(/hallPlaceholder|<template/);

  const container = document.createElement("div");
  container.innerHTML = markup;
  document.body.append(container);
  const problems: string[] = [];
  // As `tests/hydration.ts` does: server and client renderers share this
  // process, which React reports for context providers; only hydration
  // problems count.
  const error = vi.spyOn(console, "error").mockImplementation((...args) => {
    const message = args.join(" ");
    if (/hydrat|did not match/i.test(message)) problems.push(message);
  });
  const root = await act(async () =>
    hydrateRoot(container, element, {
      onRecoverableError: (cause) => problems.push(String(cause)),
    }),
  );
  await screen.findByRole("img", { name: "Neophyte Temple" });
  await act(async () => {});
  error.mockRestore();
  expect(problems).toEqual([]);
  expect(container.querySelectorAll("svg[role=img]")).toHaveLength(1);
  await act(async () => root.unmount());
  container.remove();
});

it.each(["note", "summary", "li", "todo"])(
  "draws a hall inside a %s",
  async (type) => {
    const hall = compiled().children[2];
    const view = render(
      reader({
        children: [
          {
            type,
            ...(type === "summary" ? { summary: "The hall" } : {}),
            children: [hall],
          },
        ],
      }),
    );
    const svg = await screen.findByRole("img", { name: "Neophyte Temple" });
    const frame = view.container.querySelector(`[data-ritual-frame="${type}"]`);
    expect(
      frame?.querySelector('[data-ritual-frame="gdHall"]')?.contains(svg),
    ).toBe(true);
  },
);

it("leaves a ritual without a hall as it was", async () => {
  const markup = await html(
    reader({
      children: [
        { type: "note", children: [{ type: "text", value: "Plain" }] },
      ],
    }),
  );
  expect(markup).not.toMatch(/gdHall|gd-hall-fonts|<svg/);
});
