import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Planet from "./astrology/planet/[id]/page";
import Grade from "./gd/grade/[id]/page";
import PathPage from "./kabbalah/path/[id]/page";
import SephirahPage from "./kabbalah/sephirah/[id]/page";

// The planet page draws its spirit's sigil, which no route here is held to.
vi.mock("@/components/astrology/planetarySpirits", () => ({
  default: () => null,
}));

/**
 * The four routes that take an id out of the URL and read a row with it.
 *
 * Each used to index its table with a cast — `planets[id as keyof typeof
 * planets]` — which `strict: false` made `any`, so an unknown id reached the
 * render as `undefined` and the first field read of it threw. They go through
 * [rowOf](../../packages/magick-data/src/rowOf.ts) instead, and this pins both halves: the ids
 * that render, and the ids that 404 before anything is rendered.
 */
const props = (id: string) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve({}),
});

const routes = [
  {
    name: "planet",
    Page: Planet,
    id: "luna",
    shows: "Luna",
    trail: ["/", "/astrology", "/astrology/planets", "/astrology/planet/luna"],
  },
  {
    name: "grade",
    Page: Grade,
    id: "1=10",
    shows: "Zelator",
    trail: ["/", "/gd", "/gd/grades", "/gd/grade/1=10"],
  },
  {
    name: "sephirah",
    Page: SephirahPage,
    id: "hod",
    shows: "Hod",
    trail: ["/", "/kabbalah", "/kabbalah/tree", "/kabbalah/sephirah/hod"],
  },
  // Adjacent text nodes are split by comments, so each of these is one node.
  {
    name: "path",
    Page: PathPage,
    id: "1_2",
    shows: "The Fool",
    trail: ["/", "/kabbalah", "/kabbalah/tree", "/kabbalah/path/1_2"],
  },
] as const;

/** The URLs of the page's `BreadcrumbList`, relative to the site. */
function trailOf(html: string) {
  const lists = [
    ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs),
  ]
    .map(([, json]) => JSON.parse(json))
    .filter((data) => data["@type"] === "BreadcrumbList");
  expect(lists).toHaveLength(1);
  return lists[0].itemListElement.map(({ item }: { item: string }) =>
    new URL(item).pathname.replace(/^\/$/, "/"),
  );
}

describe("entity routes", () => {
  for (const { name, Page, id, shows, trail } of routes) {
    it(`renders the ${name} an id names, with its trail`, async () => {
      const html = renderToString(await Page(props(id)));
      expect(html).toContain(shows);
      expect(trailOf(html)).toEqual(trail);
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
