// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Render } from "./blocks";
import { parseRitualText } from "./ritualText";
import { ritualTextExamples } from "./ritualTextExamples";
import { semanticToJrt } from "./semantic";

// The image block is real; role rendering is unrelated to image attributes.
vi.mock("@/app/doc/[_id]/DocRender", () => ({ roleAliases: {} }));
afterEach(cleanup);

it("carries the guide's alternative text through the semantic reader", () => {
  const doc = semanticToJrt(parseRitualText(ritualTextExamples.image));
  render(<Render doc={doc} onChange={undefined} />);
  const image = screen.getByRole("img", { name: "Describe the image" });
  expect(image.getAttribute("src")).toBe("/image.svg");
  expect(image.getAttribute("width")).toBe("320");
});
