// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Render } from "./blocks";
import DocContext from "./context";
import { roles } from "./ritualBlocks/roles";
import { parseRitualText } from "./ritualText";
import { ritualTextExamples } from "./ritualTextExamples";
import { semanticToJrt } from "./semantic";

afterEach(cleanup);

it.each([
  ["hiero", "hierophant", true],
  ["hierophant", "hiero", true],
  ["all-except-hiero,keryx", "hierophant", false],
  ["all-officers-except-phylax", "sentinel", false],
  ["all-officers", "candidate", false],
  ["all-officers", "aspirant", true],
])(
  "matches reader assignment %s for selected role %s",
  (role, selected, included) => {
    const doc = {
      children: [
        {
          type: "task",
          role,
          say: true,
          children: [{ type: "text", value: "Instruction" }],
        },
      ],
    };
    const view = render(
      <DocContext.Provider
        value={{ vars: { myRole: { value: selected } }, roles }}
      >
        <Render doc={doc} onChange={undefined} />
      </DocContext.Provider>,
    );
    expect(
      view.container
        .querySelector('[data-ritual-frame="task"]')
        ?.getAttribute("data-audience"),
    ).toBe(included ? "self" : "other");
    expect(view.container.querySelector("[data-task-settings]")).toBeNull();
  },
);

it("carries the guide's alternative text through the semantic reader", () => {
  const doc = semanticToJrt(parseRitualText(ritualTextExamples.image));
  render(<Render doc={doc} onChange={undefined} />);
  const image = screen.getByRole("img", { name: "Describe the image" });
  expect(image.getAttribute("src")).toBe("/image.svg");
  expect(image.getAttribute("width")).toBe("320");
});

it("retains reader role grouping, audience state, navigation refs and footnote order", () => {
  const first = {
    type: "task",
    role: "hierophant",
    say: true,
    children: [
      { type: "text", value: "Welcome " },
      {
        type: "footnote",
        children: [{ type: "text", value: "First footnote" }],
      },
    ],
  };
  const second = {
    type: "task",
    role: "hierophant",
    do: true,
    children: [{ type: "text", value: "Open door" }],
  };
  const doc = { children: [first, second] };
  const view = render(
    <DocContext.Provider
      value={{ vars: { myRole: { value: "hiero" } }, roles }}
    >
      <Render doc={doc} onChange={undefined} />
    </DocContext.Provider>,
  );
  expect(screen.getAllByText("Hierophant")).toHaveLength(1);
  expect(screen.getByText("First footnote")).toBeTruthy();
  expect(view.container.querySelector("sup")?.textContent).toBe("1");
  expect(
    view.container.querySelectorAll('[data-audience="self"]'),
  ).toHaveLength(2);
  expect(
    (
      first as typeof first & {
        forMe?: boolean;
        ref?: { current: Element | null };
      }
    ).forMe,
  ).toBe(true);
  expect(
    (first as typeof first & { ref?: { current: Element | null } }).ref
      ?.current,
  ).toBeTruthy();
  view.unmount();
  expect("ref" in first).toBe(false);
  expect("forMe" in first).toBe(false);
});

it("retains explicit footnote destinations and native summary collapse", () => {
  const doc = {
    children: [
      {
        type: "task",
        role: "keryx",
        say: true,
        children: [
          { type: "text", value: "Instruction" },
          {
            type: "footnote",
            children: [{ type: "text", value: "Destination text" }],
          },
          { type: "footnotes" },
        ],
      },
      {
        type: "summary",
        summary: "More",
        children: [{ type: "text", value: "Details" }],
      },
    ],
  };
  const view = render(
    <DocContext.Provider value={{ vars: {}, roles }}>
      <Render doc={doc} onChange={undefined} />
    </DocContext.Provider>,
  );
  expect(screen.getByText("Destination text")).toBeTruthy();
  const details = view.container.querySelector('[data-ritual-frame="summary"]');
  expect(details?.tagName).toBe("DETAILS");
  expect(details?.hasAttribute("open")).toBe(false);
});

it("retains reader section heading semantics and navigation anchors", () => {
  const doc = {
    children: [
      {
        type: "title",
        text: "Opening section",
        children: [{ type: "text", value: "Opening section" }],
      },
    ],
  };
  const view = render(<Render doc={doc} onChange={undefined} />);
  expect(
    screen.getByRole("heading", { name: "Opening section", level: 5 }).tagName,
  ).toBe("H5");
  expect(view.container.querySelector("#Opening_section")).toBeTruthy();
});

it("numbers collected footnotes in order and does not retain removed notes across renders", () => {
  const task = {
    type: "task",
    role: "hiero",
    say: true,
    children: [
      { type: "text", value: "Sentence" },
      { type: "footnote", children: [{ type: "text", value: "First body" }] },
      { type: "footnote", children: [{ type: "text", value: "Second body" }] },
    ],
  };
  const doc = { children: [task] };
  const view = render(
    <DocContext.Provider value={{ vars: {}, roles }}>
      <Render doc={doc} onChange={undefined} />
    </DocContext.Provider>,
  );
  expect(
    [...view.container.querySelectorAll("sup")].map((node) => node.textContent),
  ).toEqual(["1", "2"]);
  expect(
    view.container.querySelectorAll('[data-ritual-frame="footnotes"] li'),
  ).toHaveLength(2);
  view.rerender(
    <DocContext.Provider value={{ vars: {}, roles }}>
      <Render
        doc={{
          children: [
            { ...task, children: [task.children[0], task.children[2]] },
          ],
        }}
        onChange={undefined}
      />
    </DocContext.Provider>,
  );
  expect(
    [...view.container.querySelectorAll("sup")].map((node) => node.textContent),
  ).toEqual(["1"]);
  expect(
    view.container.querySelectorAll('[data-ritual-frame="footnotes"] li'),
  ).toHaveLength(1);
});

it("renders empty footnote collections without inventing notes or throwing", () => {
  const view = render(
    <Render doc={{ children: [{ type: "footnotes" }] }} onChange={undefined} />,
  );
  expect(
    view.container.querySelector('[data-ritual-frame="footnotes"]'),
  ).toBeTruthy();
  expect(view.container.querySelectorAll("li")).toHaveLength(0);
});
