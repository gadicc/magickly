// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { copiedImageLink } from "../../../../tests/exportControls";
import { TreeOfLifeView } from "./tree";
import { DEFAULT_TREE_SETTINGS } from "./treeSettings";

afterEach(cleanup);

// The image link is copied, never shown, so this presses Link in a DOM;
// tree.test.tsx keeps the server rendering.
describe("TreeOfLifeView's image link", () => {
  it("copies the default image's link", async () => {
    render(<TreeOfLifeView settings={DEFAULT_TREE_SETTINGS} />);
    expect(await copiedImageLink()).toBe(
      "/api/render/tree-of-life?field=name.roman&bottomText=name.en&fontSize=10",
    );
  });
});
