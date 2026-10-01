// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SemanticEditorShell, {
  type SemanticEditorProps,
} from "./SemanticEditorShell";

vi.mock("next/dynamic", () => ({
  default: () => () => <div>Semantic editor mounted</div>,
}));

afterEach(cleanup);

const props: SemanticEditorProps = {
  ritualId: "ritual",
  actorId: "actor",
  title: "Synthetic ritual",
  revisionId: "revision",
  parentVersion: 1,
  initialDocument: { format: "magickli-ritual", version: 1, nodes: [] },
  importedFromLegacy: true,
  importReport: {
    lossless: true,
    elementCount: 4,
    textCount: 2,
    opaqueCount: 1,
  },
};

it("automatically mounts the editor after a lossless conversion", () => {
  render(<SemanticEditorShell {...props} />);
  expect(screen.getByText("Semantic editor mounted")).toBeTruthy();
});

it("does not offer editing when the import changes the reader tree", () => {
  render(
    <SemanticEditorShell
      {...props}
      importReport={{ ...props.importReport!, lossless: false }}
    />,
  );
  expect(screen.queryByText("Semantic editor mounted")).toBeNull();
  expect(screen.getByRole("link", { name: "Open Pug editor" })).toBeTruthy();
  expect(screen.getByText(/could not be converted/)).toBeTruthy();
});
