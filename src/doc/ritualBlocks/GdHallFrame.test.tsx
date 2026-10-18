// @vitest-environment jsdom
import type { HallNode } from "@magick-components/gd/hall/types";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.doUnmock("./GdHallDrawing");
  vi.resetModules();
  vi.restoreAllMocks();
});

const hall: HallNode = { type: "gdHall", dais: 5 };

/** The reader, with the drawing's module replaced by `factory`. */
async function reader(factory: () => Record<string, unknown>) {
  vi.resetModules();
  vi.doMock("./GdHallDrawing", factory);
  // React reports the caught error; the test checks what the reader shows.
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { Render } = await import("../blocks");
  const { default: DocContext } = await import("../context");
  const { roles } = await import("./roles");
  return render(
    <DocContext.Provider value={{ vars: {}, roles }}>
      <Render
        doc={{
          children: [
            hall,
            { type: "note", children: [{ type: "text", value: "Still read" }] },
          ],
        }}
        onChange={undefined}
      />
    </DocContext.Provider>,
  );
}

it.each([
  [
    "its chunk fails to load",
    () => {
      throw new Error("Loading chunk 123 failed");
    },
  ],
  [
    "the drawing throws",
    () => ({
      default: () => {
        throw new Error("renderer bug");
      },
    }),
  ],
])("keeps the placeholder and the ritual when %s", async (_name, factory) => {
  const view = await reader(factory);
  expect(
    await screen.findByText("The temple hall could not be drawn."),
  ).toBeTruthy();
  const figure = view.container.querySelector('[data-ritual-frame="gdHall"]');
  expect(figure?.querySelector('[aria-hidden="true"]')).toBeTruthy();
  expect(
    (figure as HTMLElement).style.getPropertyValue("--gd-hall-aspect"),
  ).toMatch(/^0\.\d{4}$/);
  expect(screen.getByText("Still read")).toBeTruthy();
});

it("draws again when a failed hall changes, not when it stays", async () => {
  vi.resetModules();
  // The drawing throws for a hall with a dais of 5 and draws any other.
  vi.doMock("./GdHallDrawing", () => ({
    default: ({ hall: drawn }: { hall: HallNode }) => {
      if (drawn.dais === 5) throw new Error("renderer bug");
      return <svg aria-label={`hall with dais ${String(drawn.dais)}`} />;
    },
  }));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { GdHallFrame } = await import("./GdHallFrame");
  const view = render(<GdHallFrame hall={hall} />);
  const failure = "The temple hall could not be drawn.";
  expect(await screen.findByText(failure)).toBeTruthy();
  // The same hall again (an unrelated re-render) stays failed.
  view.rerender(<GdHallFrame hall={hall} />);
  expect(screen.getByText(failure)).toBeTruthy();
  // An edited hall is drawn.
  view.rerender(<GdHallFrame hall={{ type: "gdHall", dais: 4 }} />);
  expect(await screen.findByLabelText("hall with dais 4")).toBeTruthy();
  expect(screen.queryByText(failure)).toBeNull();
  // And one that throws again fails again, without looping.
  view.rerender(<GdHallFrame hall={{ type: "gdHall", dais: 5 }} />);
  expect(await screen.findByText(failure)).toBeTruthy();
});
