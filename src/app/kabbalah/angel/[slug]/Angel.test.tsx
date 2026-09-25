import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { angelBySlug, angelSlug } from "@/../data/kabbalah/angelSlugs";
import angels from "@/../data/kabbalah/SeventyTwoAngels";
import { loadAngelTexts } from "@/../data/kabbalah/SeventyTwoAngelsText";
import { expectEntityPage, textOf } from "../../../../../tests/entityPage";
import AngelPage from "./Angel";
import AngelRoute from "./page";

/**
 * The angel page, moved onto the entity pages' shared pieces (plan 036).
 *
 * The move is pinned by a golden: the text of Ariel's page, the 46th, which
 * has editorial notes, a Hebrew name with Lenain's pointing, a psalm with its
 * Latin, and a neighbour on each side. It was captured on `ceae007`, before
 * the refactor, by rendering the body as it was then —
 * `renderToString(await AngelPage({ angel }))`, since the body was `async` —
 * and reducing the markup with `textOf`. It is not to be regenerated: the
 * refactor changed the page's frame, links and styles and none of its text,
 * and this is what says so. The body is synchronous now, with the texts
 * loaded by the route, and the route is held to the same text.
 */
const GOLDEN = readFileSync(
  path.join(import.meta.dirname, "angel.golden.txt"),
  "utf8",
);

const params = (slug: string) => ({
  params: Promise.resolve({ slug }),
  searchParams: Promise.resolve({}),
});

async function body(no: number) {
  const [english, french] = await Promise.all([
    loadAngelTexts("en"),
    loadAngelTexts("fr"),
  ]);
  return renderToString(
    <AngelPage
      angel={angels[no - 1]}
      english={english[no - 1]}
      french={french[no - 1]}
    />,
  );
}

describe("the angel page", () => {
  it("renders Ariel's text as it did before the refactor", async () => {
    const ariel = angelBySlug("ariel");
    expect(ariel?.no).toBe(46);
    expect(textOf(await body(46))).toBe(GOLDEN);
  });

  it("hands the body the angel's own texts", async () => {
    expect(textOf(renderToString(await AngelRoute(params("ariel"))))).toBe(
      GOLDEN,
    );
  });

  it("holds all seventy-two to what every entity page must hold", async () => {
    for (const angel of angels) {
      const html = await body(angel.no);
      expectEntityPage(html, `${angel.no}. ${angel.name.en}`);
      // The nav links each neighbour; the first and the last have one.
      const around = [angel.no - 1, angel.no + 1].filter(
        (no) => no >= 1 && no <= angels.length,
      );
      for (const no of around)
        expect(html, angelSlug(angel.no)).toContain(
          `href="/kabbalah/angel/${angelSlug(no)}"`,
        );
    }
  });
});
