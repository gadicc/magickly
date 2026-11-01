// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RitualSourceEditor from "./RitualSourceEditor";
import { RITUAL_PUG_HEADER } from "./ritualPug";

// Its own file: CodeMirror warns about an unknown tag once per module, so
// an earlier render in the same file would hide the warning.
afterEach(() => vi.restoreAllMocks());

it("highlights indented Pug without an unknown-tag warning", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const source = `${RITUAL_PUG_HEADER}\nnote#a1\n  say#b2(role="hierophant") Hekas\n`;
  const { container } = render(
    <RitualSourceEditor
      value={source}
      dialect="pug"
      disabled={false}
      onChange={() => {}}
    />,
  );
  // The tag on the indented line is still highlighted.
  const indented = [...container.querySelectorAll(".cm-line")].find((line) =>
    line.textContent?.includes("say"),
  );
  expect(indented?.querySelector("span")).not.toBeNull();
  expect(warn.mock.calls.flat().join(" ")).not.toMatch(
    /Unknown highlighting tag/,
  );
});
