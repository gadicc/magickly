// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RitualLayoutSwitch } from "./RitualLayoutSwitch";

afterEach(cleanup);

const pressed = () =>
  screen
    .getAllByRole("button")
    .map((button) => [button.textContent, button.getAttribute("aria-pressed")]);

it("reads Source, Split, Visual, the chosen one pressed and filled", () => {
  const onChoose = vi.fn();
  render(
    <RitualLayoutSwitch
      label="Editor layout"
      value="split"
      onChoose={onChoose}
    />,
  );
  expect(screen.getByRole("group", { name: "Editor layout" })).toBeTruthy();
  expect(pressed()).toEqual([
    ["Source", "false"],
    ["Split", "true"],
    ["Visual", "false"],
  ]);
  expect(screen.getByRole("button", { name: "Split" }).className).toContain(
    "contained",
  );
  fireEvent.click(screen.getByRole("button", { name: "Visual" }));
  expect(onChoose).toHaveBeenCalledWith("visual");
  // Inside a form it never submits it.
  expect(
    screen.getByRole("button", { name: "Source" }).getAttribute("type"),
  ).toBe("button");
});

it("leaves Split out on a narrow screen and disables what it is told to", () => {
  render(
    <RitualLayoutSwitch
      label="Editor layout"
      value="source"
      onChoose={() => {}}
      withoutSplit
      isDisabled={(layout) => layout === "visual"}
    />,
  );
  expect(pressed()).toEqual([
    ["Source", "true"],
    ["Visual", "false"],
  ]);
  expect(
    (screen.getByRole("button", { name: "Visual" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
