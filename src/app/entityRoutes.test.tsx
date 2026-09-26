import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Planet from "./astrology/planet/[id]/page";
import Grade from "./gd/grade/[id]/page";
import PathPage from "./kabbalah/path/[id]/page";
import SephirahPage from "./kabbalah/sephirah/[id]/page";

// The planet page draws its spirit's sigil, an SVG import: a component under
// SVGR and a data URL under vitest, which React refuses as a tag name.
vi.mock("@/components/astrology/planetarySpirits", () => ({
  default: () => null,
}));

/**
 * The four routes that take an id out of the URL and read a row with it.
 *
 * Each used to index its table with a cast — `planets[id as keyof typeof
 * planets]` — which `strict: false` made `any`, so an unknown id reached the
 * render as `undefined` and the first field read of it threw. They go through
 * [rowOf](../../data/rowOf.ts) instead, and this pins both halves: the ids
 * that render, and the ids that 404 before anything is rendered.
 */
const props = (id: string) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve({}),
});

const routes = [
  { name: "planet", Page: Planet, id: "luna", shows: "Luna" },
  { name: "grade", Page: Grade, id: "1=10", shows: "Zelator" },
  { name: "sephirah", Page: SephirahPage, id: "hod", shows: "Hod" },
  // Adjacent text nodes are split by comments, so each of these is one node.
  { name: "path", Page: PathPage, id: "1_2", shows: "The Fool" },
] as const;

describe("entity routes", () => {
  for (const { name, Page, id, shows } of routes) {
    it(`renders the ${name} an id names`, async () => {
      expect(renderToString(await Page(props(id)))).toContain(shows);
    });

    it(`404s an unknown ${name} id`, async () => {
      for (const unknown of ["missing", "constructor", "__proto__"])
        await expect(Page(props(unknown)), unknown).rejects.toMatchObject({
          digest: "NEXT_HTTP_ERROR_FALLBACK;404",
        });
    });
  }

  it("renders the rows the links resolve, not the ids", async () => {
    // Luna's god name is a link the barrel resolves; the page lays it out.
    expect(renderToString(await Planet(props("luna")))).toContain(
      "Shaddai El Chai",
    );
  });
});
