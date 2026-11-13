import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DocText, { docInline } from "./DocText";

describe("DocText", () => {
  it("sets code and emphasis in paragraphs", () => {
    expect(
      renderToStaticMarkup(
        <DocText
          text={"`id` of *De occulta philosophia*,\nwrapped.\n\nTwo."}
        />,
      ),
    ).toBe(
      "<p><code>id</code> of <em>De occulta philosophia</em>, wrapped.</p><p>Two.</p>",
    );
  });

  it("keys each part uniquely, a code span first included", () => {
    const parts = docInline("`id` and `ref`") as ReactElement[];
    const keys = parts.map((part) => part.key);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
  });
});
