// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { COMPONENT_EXAMPLES } from "./components";
import Explorer from "./Explorer";
import { PROPS } from "./props";

afterEach(cleanup);

function explore(name: "Chakras" | "TreeOfLife") {
  const view = render(
    <Explorer
      name={name}
      examples={COMPONENT_EXAMPLES[name].examples.map((example) => ({
        title: example.title,
        props: example.props as Record<string, unknown>,
      }))}
      props={PROPS[name].props}
      examplesUrl="https://example.com/examples"
    />,
  );
  const drawing = () =>
    view.container.querySelector('[class*="drawing"]')?.innerHTML ?? "";
  const jsx = () =>
    view.container.querySelector('pre[aria-labelledby="explorer-jsx"]')
      ?.textContent;
  return { drawing, jsx };
}

describe("Explorer", () => {
  it("redraws when a text field changes, and writes the JSX", async () => {
    const { drawing, jsx } = explore("Chakras");
    await waitFor(() => expect(drawing()).toContain("<svg"));
    const before = drawing();
    expect(before).not.toContain('opacity="0.2"');
    fireEvent.change(screen.getByLabelText("active"), {
      target: { value: "heart" },
    });
    await waitFor(() => expect(drawing()).toContain('opacity="0.2"'));
    expect(jsx()).toBe('<Chakras height={240} active="heart" />');
  });

  it("redraws when a switch changes, and unsets a prop", async () => {
    const { drawing, jsx } = explore("TreeOfLife");
    await waitFor(() => expect(drawing()).toContain("<svg"));
    const circles = () => (drawing().match(/<circle/g) ?? []).length;
    const before = circles();
    fireEvent.click(screen.getByRole("switch", { name: "showDaat" }));
    await waitFor(() => expect(circles()).toBe(before + 1));
    expect(jsx()).toBe("<TreeOfLife showDaat />");
    fireEvent.click(screen.getByRole("button", { name: "Unset showDaat" }));
    await waitFor(() => expect(circles()).toBe(before));
    expect(jsx()).toBe("<TreeOfLife />");
  });
});
