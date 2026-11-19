// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocaleProvider from "@/i18n/LocaleProvider";
import { messages as hebrew } from "@/locales/he/messages.js";
import { TaskBody, TaskFrame } from "./Frames";
import { roles } from "./roles";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

afterEach(cleanup);

// jsdom's import.meta.url is not a file URL; vitest runs from the root.
const frameCss = () =>
  readFileSync("src/doc/ritualBlocks/frames.module.css", "utf8");

const frameOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-ritual-frame="task"]')!;

function Task({
  kind,
  role = "hierophant",
  audience,
  continues,
}: {
  kind: "say" | "do";
  role?: string;
  audience?: "self" | "other" | "author";
  continues?: "say" | "do";
}) {
  return (
    <TaskFrame
      role={role}
      roles={roles}
      kind={kind}
      audience={audience}
      continues={continues}
      page={7}
    >
      <TaskBody action={kind === "do"}>
        <span data-testid="slot">Body</span>
      </TaskBody>
    </TaskFrame>
  );
}

describe("the task frame (plan 089, decision 1)", () => {
  it("marks its kind and audience on one positioned root", () => {
    const view = render(<Task kind="do" audience="self" />);
    const frame = frameOf(view.container);
    expect(frame.tagName).toBe("DIV");
    expect(frame.getAttribute("data-kind")).toBe("do");
    expect(frame.getAttribute("data-audience")).toBe("self");
    expect(frame.hasAttribute("data-continues")).toBe(false);
    expect(frame.querySelector(".do")).toBeTruthy();
    expect(frame.querySelector(".say")).toBeNull();
    view.rerender(<Task kind="say" audience="author" />);
    expect(frameOf(view.container).getAttribute("data-kind")).toBe("say");
    expect(frameOf(view.container).getAttribute("data-audience")).toBe(
      "author",
    );
    expect(frame.querySelector(".say")).toBeTruthy();
  });

  it("keeps its root and content slot when the kind switches", () => {
    const view = render(<Task kind="say" />);
    const frame = frameOf(view.container);
    const slot = view.getByTestId("slot");
    view.rerender(<Task kind="do" />);
    expect(frameOf(view.container)).toBe(frame);
    expect(view.getByTestId("slot")).toBe(slot);
    view.rerender(<Task kind="say" />);
    expect(frameOf(view.container)).toBe(frame);
    expect(view.getByTestId("slot")).toBe(slot);
  });

  it("draws the line number before the role line, outside the editable content", () => {
    const view = render(<Task kind="do" />);
    const frame = frameOf(view.container);
    const page = frame.firstElementChild!;
    expect(page.textContent).toBe("7");
    expect(page.getAttribute("contenteditable")).toBe("false");
  });

  it("gives a single officer's colours to the frame, for its rule and name", () => {
    const view = render(<Task kind="do" role="hierophant" />);
    const frame = frameOf(view.container);
    expect(frame.style.getPropertyValue("--ritual-role")).toBe(
      roles.hierophant.color,
    );
    expect(frame.style.getPropertyValue("--ritual-role-dark")).toBe("#ff7a7a");
    const name = [...frame.querySelectorAll("span")].find(
      (span) => span.textContent === "Hierophant",
    )!;
    expect(name.getAttribute("style")).toBeNull();
  });

  it.each(["all", "all-officers", "all-except-hierophant", "hierophant,keryx"])(
    "gives %s a neutral rule, not its first role's colour",
    (role) => {
      const view = render(<Task kind="do" role={role} />);
      const frame = frameOf(view.container);
      // `initial` makes the CSS fall back to text.secondary, and stops a
      // nested frame inheriting an outer officer's colour.
      expect(frame.style.getPropertyValue("--ritual-role")).toBe("initial");
      expect(frame.style.getPropertyValue("--ritual-role-dark")).toBe(
        "initial",
      );
    },
  );

  it("keeps each name's own colour on a multi-role line", () => {
    const view = render(<Task kind="say" role="hierophant,keryx" />);
    const names = [
      ...frameOf(view.container).querySelectorAll<HTMLElement>("span[style]"),
    ];
    expect(
      names.map((name) => name.style.getPropertyValue("--ritual-role")),
    ).toEqual([roles.hierophant.color, roles.keryx.color]);
  });

  it("draws the rule from the officer's colour with a neutral fallback", () => {
    const css = frameCss();
    expect(css).toContain(
      "border-left: 3px solid var(--ritual-role, var(--mui-palette-text-secondary));",
    );
    expect(css).toMatch(
      /:global\(\.dark\) \.task\[data-kind="do"\] \{\s*border-left-color: var\(\s*--ritual-role-dark,\s*var\(--mui-palette-text-secondary\)\s*\);/,
    );
  });

  it.each([
    ["say", "say"],
    ["say", "do"],
    ["do", "say"],
    ["do", "do"],
  ] as const)(
    "continues a %s with a %s without a role line",
    (previous, kind) => {
      const view = render(<Task kind={kind} continues={previous} />);
      const frame = frameOf(view.container);
      expect(frame.getAttribute("data-continues")).toBe(previous);
      expect(frame.getAttribute("data-kind")).toBe(kind);
      expect(frame.textContent).not.toContain("Hierophant");
    },
  );
});

describe("a direction's kind label", () => {
  it("is carried by the direction's body only, never as its text", () => {
    const view = render(
      <>
        <Task kind="do" />
        <Task kind="say" role="keryx" />
      </>,
    );
    const action = view.container.querySelector(".do")!;
    expect(action.getAttribute("data-kind-label")).toBe("Direction");
    expect(action.textContent).toBe("Body");
    expect(
      view.container.querySelector(".say")!.hasAttribute("data-kind-label"),
    ).toBe(false);
    // Generated content: announced, but neither shown nor copied.
    const css = frameCss();
    const rule = /\.action\[data-kind-label\]::before \{([^}]*)\}/.exec(css);
    expect(rule?.[1]).toContain('content: attr(data-kind-label) ": ";');
    expect(rule?.[1]).toContain("clip-path: inset(50%);");
    expect(rule?.[1]).toContain("position: absolute;");
  });

  it("is translated with the interface", () => {
    const markup = renderToString(
      <LocaleProvider locale="he" messages={hebrew}>
        <Task kind="do" />
      </LocaleProvider>,
    );
    expect(markup).toContain('data-kind-label="הוראה"');
  });
});
