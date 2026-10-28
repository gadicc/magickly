// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { parseRitualPug, RITUAL_PUG_HEADER } from "../ritualPug";
import { semanticToTiptap } from "../tiptapRitual";
import { FootnotePreview } from "./FootnotesForEditing";

afterEach(cleanup);

it("opens a footnote's site link in a new tab, never in the editor's", () => {
  const tiptap = semanticToTiptap(
    parseRitualPug(
      `${RITUAL_PUG_HEADER}\nnote\n  a(href="/gd/halls/neophyte") The Neophyte hall\n`,
    ),
  );
  // The preview reads only the footnote node's content and identity.
  const entry = {
    node: {
      content: { toJSON: () => tiptap.content },
      toJSON: () => tiptap,
    },
    pos: 0,
    children: [],
  } as never;
  const view = render(<FootnotePreview entry={entry} />);
  const link = view.container.querySelector("a");
  expect(link?.getAttribute("href")).toBe("/gd/halls/neophyte");
  expect(link?.getAttribute("target")).toBe("_blank");
});
