// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { COMPONENT_EXAMPLES, type ComponentName } from "./components";
import Explorer from "./Explorer";
import { PROPS } from "./props";

afterEach(cleanup);

function explore(name: ComponentName) {
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
  const jsx = () => view.container.querySelector("pre")?.textContent;
  const image = () =>
    screen.queryByRole("link", { name: "SVG" })?.getAttribute("href") ?? null;
  return { drawing, jsx, image };
}

/** Picks `option` from the MUI select labelled `label`. */
function choose(label: string, option: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
  fireEvent.click(
    within(screen.getByRole("listbox")).getByRole("option", { name: option }),
  );
}

describe("Explorer", () => {
  it("redraws when a text field changes, and unsets it when cleared", async () => {
    const { drawing, jsx } = explore("Chakras");
    await waitFor(() => expect(drawing()).toContain("<svg"));
    expect(drawing()).not.toContain('opacity="0.2"');
    const active = screen.getByLabelText("active");
    fireEvent.change(active, { target: { value: "heart" } });
    await waitFor(() => expect(drawing()).toContain('opacity="0.2"'));
    expect(jsx()).toBe('<Chakras height={240} active="heart" />');
    fireEvent.change(active, { target: { value: "" } });
    await waitFor(() => expect(drawing()).not.toContain('opacity="0.2"'));
    expect(jsx()).toBe("<Chakras height={240} />");
  });

  it("redraws when a switch changes, and unsets a prop", async () => {
    const { drawing, jsx } = explore("TreeOfLife");
    await waitFor(() => expect(drawing()).toContain("<svg"));
    const circles = () => (drawing().match(/<circle/g) ?? []).length;
    const before = circles();
    const first = jsx();
    fireEvent.click(screen.getByRole("switch", { name: "showDaat" }));
    await waitFor(() => expect(circles()).toBe(before + 1));
    expect(jsx()).toContain("showDaat");
    fireEvent.click(screen.getByRole("button", { name: "Unset showDaat" }));
    await waitFor(() => expect(circles()).toBe(before));
    expect(jsx()).toBe(first);
  });

  it("sets a choice, and unsets it again", async () => {
    const { drawing, jsx } = explore("Kamea");
    await waitFor(() => expect(drawing()).toContain("<svg"));
    const cells = () => (drawing().match(/<text/g) ?? []).length;
    expect(cells()).toBe(9);
    choose("planet", "jupiter");
    await waitFor(() => expect(cells()).toBe(16));
    expect(jsx()).toContain('planet="jupiter"');
  });

  it("parses a number field and a text field of string | number", async () => {
    const moon = explore("Moon");
    fireEvent.change(screen.getByLabelText("latitude"), {
      target: { value: "12.5" },
    });
    await waitFor(() =>
      expect(moon.jsx()).toBe(
        '<Moon background="/night-sky.jpg" latitude={12.5} />',
      ),
    );
    cleanup();
    const tree = explore("TreeOfLife");
    const fontSize = screen.getByLabelText("fontSize");
    fireEvent.change(fontSize, { target: { value: "12" } });
    await waitFor(() => expect(tree.jsx()).toContain("fontSize={12}"));
    fireEvent.change(fontSize, { target: { value: "1em" } });
    await waitFor(() => expect(tree.jsx()).toContain('fontSize="1em"'));
  });

  it("switches examples, marks edits, and picks the same one to undo them", async () => {
    const { jsx } = explore("Tablet");
    const picker = () => screen.getByRole("combobox", { name: "Example" });
    expect(picker().textContent).toBe("Earth, the Golden Dawn's");
    choose("Example", "Fire in Dee's version");
    await waitFor(() =>
      expect(jsx()).toBe('<Tablet id="fire" version="dee" />'),
    );
    fireEvent.click(screen.getByRole("switch", { name: "alt" }));
    await waitFor(() =>
      expect(picker().textContent).toBe("Fire in Dee's version (edited)"),
    );
    choose("Example", "Fire in Dee's version");
    await waitFor(() =>
      expect(jsx()).toBe('<Tablet id="fire" version="dee" />'),
    );
    expect(picker().textContent).toBe("Fire in Dee's version");
  });

  it("links the image while the image can draw the props, and not after", async () => {
    const { image } = explore("Tablet");
    expect(image()).toBe("/api/render/enochian-tablet");
    fireEvent.click(screen.getByRole("switch", { name: "alt" }));
    await waitFor(() => expect(image()).toBeNull());
  });
});
