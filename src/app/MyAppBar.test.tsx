import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import MyAppBar from "./MyAppBar";

const navigation = vi.hoisted(() => ({
  pathname: "/",
  segment: null as string | null,
}));
const drawer = vi.hoisted(() => ({ inline: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSelectedLayoutSegment: () => navigation.segment,
  // Static prerendering bails out of anything that reads the query.
  useSearchParams: () => {
    throw new Error("Bail out to client-side rendering: useSearchParams()");
  },
}));
vi.mock("@/auth/client", () => ({
  useSession: () => ({ data: null, isPending: true }),
}));
vi.mock("@/auth/browserLifecycle", () => ({ sqlBrowserLifecycle: {} }));
vi.mock("./clientProviders", () => ({
  useLegacyRecoveryGate: () => ({ state: "checking", retry: () => {} }),
}));
// The drawer is a portal, which renders nothing on the server, and each of
// its sections mounts its list only when opened. Laid out inline, every
// link the drawer can show is in the markup, for the one test that asks.
vi.mock("@mui/material", async (importOriginal) => {
  const mui = await importOriginal<typeof import("@mui/material")>();
  const { createElement } = await import("react");
  const inline =
    <P extends { children?: React.ReactNode }>(
      Original: React.ComponentType<P>,
    ) =>
    (props: P) =>
      drawer.inline
        ? createElement("div", null, props.children)
        : createElement(Original, props);
  return {
    ...mui,
    Drawer: inline(mui.Drawer),
    Collapse: inline(mui.Collapse),
  };
});

function serverRender(pathname: string, segment: string | null = null) {
  navigation.pathname = pathname;
  navigation.segment = segment;
  return renderToString(<MyAppBar />);
}

afterEach(() => {
  navigation.pathname = "/";
  navigation.segment = null;
  drawer.inline = false;
});

describe("MyAppBar on the server", () => {
  it("renders the page title as the heading without the query", () => {
    const html = serverRender("/kabbalah/tree");
    expect(html).toMatch(/<h1[^>]*>.*Tree of Life.*<\/h1>/);
    // The sign-in link waits for the query; its fallback keeps the path.
    expect(html).toContain('href="/signin?callbackURL=%2Fkabbalah%2Ftree"');
    expect(html).toContain('aria-label="share"');
  });

  it("names the site in a heading on the home page", () => {
    expect(serverRender("/")).toMatch(/<h1[^>]*>Magick\.ly<\/h1>/);
  });

  it("keeps untitled pages out of the heading", () => {
    for (const pathname of ["/doc/neophyte", "/constructor", "/gd/toString"]) {
      const html = serverRender(pathname);
      expect(html, pathname).not.toContain("<h1");
      expect(html, pathname).toContain("Magick.ly");
    }
  });

  it("titles the shared 404 page the same for every unknown path", () => {
    // Prerendered for "/_not-found", hydrated at the unknown path.
    // The browser's router reports the segment without the leading slash.
    const server = serverRender("/_not-found", "/_not-found");
    const browser = serverRender("/gd/nope", "_not-found");
    // Without the segment, /gd/nope would show the Golden Dawn breadcrumb.
    expect(serverRender("/gd/nope")).toContain("vertical-align:top");
    for (const html of [server, browser]) {
      expect(html).not.toContain("<h1");
      expect(html).not.toContain("vertical-align:top");
      expect(html).toContain(">Magick.ly</div>");
    }
    // Sign-in still returns to the path the reader opened.
    expect(browser).toContain('href="/signin?callbackURL=%2Fgd%2Fnope"');
  });

  it("shows the site name below a titled section", () => {
    // The angel pages have no list page of their own, so no title either:
    // the page's heading is the page's, and the bar shows the breadcrumb.
    for (const pathname of [
      "/kabbalah/sephirah/keter",
      "/kabbalah/angel/vehuiah",
    ]) {
      const html = serverRender(pathname);
      expect(html, pathname).not.toContain("<h1");
      expect(html, pathname).toContain(
        '<span style="vertical-align:top">Magick.ly</span>',
      );
    }
  });

  it("offers no link in the drawer to a page that does not exist", () => {
    drawer.inline = true;
    const hrefs = [
      ...serverRender("/").matchAll(/<a\b[^>]*\shref="([^"]*)"/g),
    ].map(([, href]) => href);
    // The Kabbalah section is there, so its absence below means something.
    expect(hrefs).toEqual(
      expect.arrayContaining(["/kabbalah/tree", "/kabbalah/yhvh"]),
    );
    // There is no /kabbalah/angel page, only the pages below it.
    expect(hrefs).not.toContain("/kabbalah/angel");
  });
});
