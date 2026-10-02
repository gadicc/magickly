const uuid = (n) => `01995000-0000-7000-8000-${String(n).padStart(12, "0")}`;
let next = 1;
const text = (value) => ({ kind: "text", text: value });
const element = (tag, attrs, children) => ({
  kind: "element",
  id: uuid(next++),
  tag,
  attrs,
  ...(children === undefined ? {} : { children }),
});
export const fixture = {
  format: "magickli-ritual",
  version: 1,
  nodes: [
    element("title", { text: "Opening" }, [text("Opening")]),
    element(
      "declareVar",
      {
        name: "candidate",
        label: "Candidate",
        varType: "text",
        default: "Guest",
      },
      [],
    ),
    element("summary", { summary: "Preparation" }, [
      element("note", {}, [text("Prepare the space.")]),
    ]),
    element("task", { say: true, role: "hiero" }, [text("Welcome.")]),
    element("task", { do: true, role: "keryx" }, [text("Open the door.")]),
    element("task", { say: true, role: "hiero" }, [
      text("Welcome, "),
      element("var", { name: "candidate" }),
      text(". Speak "),
      element("b", {}, [text("clearly")]),
      text("."),
    ]),
    element("ul", {}, [
      element("li", {}, [text("First item")]),
      element("li", {}, [text("Second item")]),
    ]),
    element("img", {
      src: "/synthetic-ritual.png",
      alt: "Synthetic diagram",
      width: 320,
    }),
    {
      kind: "legacy",
      id: uuid(next++),
      raw: {
        type: "synthetic-widget",
        mode: "preserve",
        children: [{ type: "text", value: "Unusual content" }],
      },
    },
  ],
};
export function literalFixture(value) {
  return {
    format: "magickli-ritual",
    version: 1,
    nodes: [element("note", {}, [text(value)])],
  };
}
