// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import RitualCreationEditor from "./RitualCreationEditor";

afterEach(cleanup);
it("recovers when source is restored to its previous visual projection", async () => {
  let latest = "";
  const valid = vi.fn();
  function Host() {
    const [source, setSource] = React.useState('ritual 1\n= "hello"\n');
    return (
      <RitualCreationEditor
        source={source}
        disabled={false}
        onValidityChange={valid}
        onChange={(next) => {
          latest = next;
          setSource(next);
        }}
      />
    );
  }
  render(<Host />);
  const dom = await screen.findByRole("textbox", {
    name: "New ritual visual editor",
  });
  act(() => {
    (dom as HTMLElement & { editor: Editor }).editor.commands.insertContent(
      "!",
    );
  });
  const emitted = latest;
  fireEvent.click(screen.getByRole("button", { name: "Ritual source" }));
  fireEvent.change(screen.getByRole("textbox", { name: "New ritual source" }), {
    target: { value: "broken" },
  });
  await screen.findByText(
    "Correct the ritual source before using visual editing.",
  );
  expect(
    screen
      .getByRole("textbox", { name: "New ritual source" })
      .getAttribute("data-diagnostic-source"),
  ).toBe("broken");
  fireEvent.change(screen.getByRole("textbox", { name: "New ritual source" }), {
    target: { value: emitted },
  });
  expect(
    screen.queryByText(
      "Correct the ritual source before using visual editing.",
    ),
  ).toBeNull();
  expect(valid).toHaveBeenLastCalledWith(true);
  expect(
    screen
      .getByRole("textbox", { name: "New ritual source" })
      .getAttribute("data-diagnostic-source"),
  ).toBeNull();
  expect(
    (screen.getByRole("button", { name: "Visual" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

vi.mock("@/doc/RitualSourceEditor", () => ({
  default: ({
    value,
    onChange,
    disabled,
    label = "Ritual semantic source",
    onCompositionChange,
    diagnostic,
  }) =>
    React.createElement("textarea", {
      "aria-label": label,
      "data-diagnostic-source": diagnostic?.source,
      value,
      disabled,
      onChange: (event) =>
        onChange((event.target as HTMLTextAreaElement).value),
      onCompositionStart: () => onCompositionChange?.(true),
      onCompositionEnd: () => onCompositionChange?.(false),
    }),
}));
