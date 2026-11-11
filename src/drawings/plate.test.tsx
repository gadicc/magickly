// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, expect, it } from "vitest";
import { ImageFrame } from "@/doc/ritualBlocks/Frames";
import { plateClass } from "./plate";

/**
 * The plate must never take an image's own size (plan 076, decision 4).
 * CssBaseline makes every box border-box, so padding on an `<img>` with a
 * given height comes out of the picture: a `height: 1em` image in a ritual
 * was left a 0×0 content box in dark. jsdom does not lay out, but it does
 * cascade, so this loads the module's real rules (as Next would scope them)
 * and reads what an image and a box get.
 */
beforeAll(() => {
  const css = readFileSync(
    path.resolve("src/drawings/plate.module.css"),
    "utf8",
  )
    .replaceAll(":global(.dark)", ".dark")
    .replaceAll(".plate", `.${plateClass}`);
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
});

afterEach(() => {
  cleanup();
  document.documentElement.className = "";
});

it("gives a ritual image its plate as a ring, not padding, in dark", () => {
  document.documentElement.className = "dark";
  const { container } = render(
    <ImageFrame src="data:image/gif;base64,R0lGOD" style={{ height: "1em" }} />,
  );
  const image = container.querySelector("img");
  expect(image?.classList.contains(plateClass)).toBe(true);
  const computed = getComputedStyle(image as HTMLImageElement);
  for (const side of ["Top", "Right", "Bottom", "Left"] as const)
    expect(computed[`padding${side}`], side).toBe("0px");
  expect(computed.boxShadow).toMatch(/var\(--mui-palette-plate\)/);
  expect(computed.backgroundColor).toBe("var(--mui-palette-plate)");
});

it("keeps the padded card on a box such as the tablet's", () => {
  document.documentElement.className = "dark";
  const { container } = render(<div className={plateClass} />);
  const box = container.firstElementChild as HTMLElement;
  expect(getComputedStyle(box).paddingTop).toBe("8px");
});

it("adds nothing in light", () => {
  const { container } = render(
    <ImageFrame src="data:image/gif;base64,R0lGOD" style={{ height: "1em" }} />,
  );
  const computed = getComputedStyle(container.querySelector("img") as Element);
  expect(computed.paddingTop).not.toBe("8px");
  expect(computed.boxShadow).not.toMatch(/plate/);
});
