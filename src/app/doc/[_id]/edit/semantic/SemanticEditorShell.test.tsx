// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

it("requires an explicit conversion choice before mounting the editor", () => {
  render(<SemanticEditorShell {...props} />);
  expect(screen.queryByText("Semantic editor mounted")).toBeNull();
  expect(screen.getByText(/1 unsupported legacy nodes/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Start editing conversion" }),
  );
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
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText(/could not be converted/)).toBeTruthy();
});
