// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import Oration from "./Oration";
import OrationText from "./OrationText";
import {
  DEFAULT_ORATION_VERSION,
  ORATION_VERSIONS,
  READINGS,
  type ReadingId,
  readingAnchor,
  WORDINGS,
} from "./readings";
import { parseOrationQuery, useOrationVersion } from "./urlState";

const IDS = Object.keys(READINGS) as ReadingId[];

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/enochian/oration");
});

/** The prayer's two paragraphs as a reader at `search` sees them. */
function prayer(search = "") {
  window.history.replaceState(null, "", `/enochian/oration${search}`);
  const { container } = render(<Oration />);
  const paragraphs = [...container.querySelectorAll("p")].filter(
    (p) =>
      p.textContent?.includes("Amen") ||
      p.textContent?.startsWith("O Almighty"),
  );
  for (const sup of container.querySelectorAll("p sup")) sup.remove();
  const words = paragraphs
    .map((p) => p.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/ ([,.:;)])/g, "$1");
  cleanup();
  return words;
}

describe("the Oration's versions", () => {
  it("reads Dee's unless the URL asks for James's", () => {
    expect(DEFAULT_ORATION_VERSION).toBe("dee");
    expect(ORATION_VERSIONS).toEqual(["dee", "james"]);
    expect(parseOrationQuery("")).toBe("dee");
    expect(parseOrationQuery("?version=james")).toBe("james");
    expect(parseOrationQuery("?version=James")).toBe("dee");
    expect(parseOrationQuery("?version=constructor")).toBe("dee");
  });

  it("writes the version to the URL, keeping other params, Dee's as none", () => {
    window.history.replaceState(null, "", "/enochian/oration?x=1#a");
    const { result } = renderHook(() => useOrationVersion());
    expect(result.current[0]).toBe("dee");
    act(() => result.current[1]("james"));
    expect(result.current[0]).toBe("james");
    expect(window.location.search).toBe("?x=1&version=james");
    expect(window.location.hash).toBe("#a");
    act(() => result.current[1]("dee"));
    expect(window.location.search).toBe("?x=1");
  });

  it("prerenders Dee's, each reading in one place with his words there", () => {
    const html = renderToString(<Oration />);
    for (const id of IDS) {
      const spans = [
        ...html.matchAll(
          new RegExp(`<span data-reading="${id}">([^<]*)</span>`, "g"),
        ),
      ];
      expect(
        spans.map(([, words]) => words),
        id,
      ).toEqual([READINGS[id].dee]);
    }
    expect(html.match(/data-reading=/g)).toHaveLength(IDS.length);
  });

  it("gives Dee's wording, or James's where the reader chooses his", () => {
    const dee = prayer();
    const james = prayer("?version=james");
    expect(dee).toContain(
      "being to me made manifest, might abundantly instruct, furnish, and allure me",
    );
    expect(james).toContain("being to me made and allure me");
    expect(dee).toContain("I never found so urgent Opportunity");
    expect(james).toContain("I never found Opportunity");
    expect(dee).toContain("Mystery: Isagogically, (as yet,)");
    expect(james).toContain("Mystery: theurgically, (as yet,)");
    expect(james).toContain("O Almighty, Æternal, the True");
    // A reading dropped, or doubled, changes the count.
    const count = (s: string) => s.split(" ").length;
    // manifest… furnish (5), so urgent (2), for ever (1).
    expect(count(dee) - count(james)).toBe(8);
  });

  it("notes every change of wording under its letter, and marks it", () => {
    expect(WORDINGS.map(({ id, letter }) => `${letter}:${id}`)).toEqual([
      "a:who",
      "b:manifest",
      "c:majestical",
      "d:urgent",
      "e:isagogically",
    ]);
    const notes = renderToString(<OrationText />);
    const html = renderToString(<Oration />);
    for (const { id, letter } of WORDINGS) {
      expect(notes, id).toContain(`id="${readingAnchor(id)}"`);
      expect(html, id).toContain(`href="#${readingAnchor(id)}">${letter}</a>`);
    }
    // Spellings are not lettered.
    expect(html.match(/href="#oration-reading-/g)).toHaveLength(
      WORDINGS.length,
    );
  });

  it("keeps no copy of James's text, only his readings", () => {
    // His edition is in copyright.
    const source = readFileSync(
      resolve("src/app/enochian/oration/Oration.tsx"),
      "utf8",
    );
    expect(source).not.toContain("made and allure");
    expect(source).not.toContain("theurgically");
  });
});
