import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import MyAppBar, { menuPrefetch } from "./MyAppBar";

const navigation = vi.hoisted(() => ({
  pathname: "/",
  segment: null as string | null,
}));
const drawer = vi.hoisted(() => ({ inline: false }));
const links = vi.hoisted(() => ({
  rendered: [] as { href: string; prefetch: unknown }[],
}));

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

// Each Next link as rendered, with its prefetch setting, which leaves no
// trace in the markup.
vi.mock("next/link", async (importOriginal) => {
  const next = await importOriginal<typeof import("next/link")>();
  const { createElement } = await import("react");
  const Recording = (props: React.ComponentProps<typeof next.default>) => {
    links.rendered.push({ href: String(props.href), prefetch: props.prefetch });
    return createElement(next.default, props);
  };
  return { ...next, default: Recording };
});

/** The nav menu's markup, from its root to the end of the HTML. */
function navMenu(html: string) {
  const id = html.indexOf('id="nav-menu"');
  expect(id, "nav menu").toBeGreaterThan(-1);
  // The menu is the bar's last element with links (the drawer is portalled
  // and renders nothing on the server), so it runs to the end of the HTML.
  return html.slice(html.lastIndexOf("<div", id));
}

function hrefsIn(html: string) {
  return [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map(([, h]) => h);
}

function serverRender(pathname: string, segment: string | null = null) {
  navigation.pathname = pathname;
  navigation.segment = segment;
  return renderToString(<MyAppBar />);
}

afterEach(() => {
  navigation.pathname = "/";
  navigation.segment = null;
  drawer.inline = false;
  links.rendered.length = 0;
});

describe("MyAppBar on the server", () => {
  it("renders the page title as the heading without the query", () => {
    const html = serverRender("/kabbalah/tree");
    expect(html).toMatch(/<h1[^>]*>.*Tree of Life.*<\/h1>/);
    // The sign-in link waits for the query; its fallback keeps the path.
    expect(html).toContain('href="/signin?callbackURL=%2Fkabbalah%2Ftree"');
    expect(html).toContain('aria-label="share"');
  });

  it("titles the ritual editor, a dynamic route the map cannot hold", () => {
    expect(serverRender("/doc/abc123/edit/semantic")).toMatch(
      /<h1[^>]*>Ritual editor<\/h1>/,
    );
  });

  it("names the site in a heading on the home page", () => {
    expect(serverRender("/")).toMatch(/<h1[^>]*>Magick\.ly<\/h1>/);
  });

  it("keeps untitled pages out of the heading", () => {
    for (const pathname of ["/doc/neophyte", "/constructor"]) {
      const html = serverRender(pathname);
      expect(html, pathname).not.toContain("<h1");
      expect(html, pathname).toContain("Magick.ly");
      // Nothing above them, so no menu either.
      expect(html, pathname).not.toContain('id="nav-menu"');
    }
    // An unknown path below a section is labelled with that section.
    const html = serverRender("/gd/toString");
    expect(html).not.toContain("<h1");
    expect(html).toContain(
      '<span style="vertical-align:top">Golden Dawn</span>',
    );
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

  it("labels a page below a titled section with that section", () => {
    // The angel pages have no list page of their own, so no title either:
    // the page's heading is the page's, and the bar names the section.
    for (const pathname of [
      "/kabbalah/sephirah/keter",
      "/kabbalah/angel/vehuiah",
    ]) {
      const html = serverRender(pathname);
      expect(html, pathname).not.toContain("<h1");
      expect(html, pathname).toContain(
        '<span style="vertical-align:top">Kabbalah</span>',
      );
      const menu = navMenu(html);
      expect(hrefsIn(menu), pathname).toEqual([
        "/",
        "/kabbalah",
        "/kabbalah/yhvh",
        "/kabbalah/tree",
      ]);
      // No current item: the bar has no title for the page to show.
      expect(menu, pathname).not.toContain('aria-current="page"');
      // Nothing above Kabbalah but Home, so no inline trail.
      expect(html, pathname).not.toContain('aria-label="Breadcrumb"');
    }
  });

  it("holds only the page title in the heading", () => {
    const h1 = serverRender("/kabbalah/tree").match(/<h1\b.*?<\/h1>/s)?.[0];
    // Emotion inlines its <style> tags when rendered without the app's cache.
    const text = h1
      ?.replace(/<style\b.*?<\/style>/gs, "")
      .replace(/<[^>]*>/g, "");
    expect(text).toBe("Tree of Life");
  });

  it("puts the menu's links in the server HTML, hidden until opened", () => {
    const menu = navMenu(serverRender("/kabbalah/tree"));
    expect(hrefsIn(menu)).toEqual(["/", "/kabbalah", "/kabbalah/yhvh"]);
    expect(menu).toMatch(/aria-current="page"[^>]*>Tree of Life</);
    // Closed, MUI hides the kept-mounted menu.
    expect(menu).toMatch(/^<div[^>]*class="[^"]*MuiModal-hidden/);
  });

  it("lists a section page's own pages in its menu", () => {
    const menu = navMenu(serverRender("/kabbalah"));
    expect(hrefsIn(menu)).toEqual(["/", "/kabbalah/yhvh", "/kabbalah/tree"]);
  });

  it("keeps the title of the entry a page sits below", () => {
    const h1 = (pathname: string) =>
      serverRender(pathname)
        .match(/<h1\b.*?<\/h1>/s)?.[0]
        .replace(/<style\b.*?<\/style>/gs, "")
        .replace(/<[^>]*>/g, "");
    expect(h1("/books/la-science-cabalistique/chapitre-1")).toBe(
      "La Science Cabalistique",
    );
    expect(h1("/study/some-set")).toBe("Study");
    expect(h1("/temples/admin/some-temple")).toBe("Admin");
    // The menu links the entry rather than marking it as the page.
    const menu = navMenu(
      serverRender("/books/la-science-cabalistique/chapitre-1"),
    );
    expect(hrefsIn(menu)).toEqual([
      "/",
      "/books",
      "/books/la-science-cabalistique",
    ]);
    expect(menu).not.toContain('aria-current="page"');
    // Nothing above Study, so no menu.
    expect(serverRender("/study/some-set")).not.toContain('id="nav-menu"');
  });

  it("leaves members' pages out of the menu", () => {
    expect(hrefsIn(navMenu(serverRender("/gd/rituals")))).not.toContain(
      "/gd/rituals/deleted",
    );
    expect(hrefsIn(navMenu(serverRender("/temples/admin/x")))).toEqual([
      "/",
      "/temples",
      "/temples/admin",
    ]);
  });

  it("shows the sections above the page beside its title", () => {
    const html = serverRender("/kabbalah/yhvh/72angels");
    const trail = html.match(
      /<nav[^>]*aria-label="Breadcrumb".*?<\/nav>/s,
    )?.[0];
    expect(hrefsIn(trail ?? "")).toEqual(["/kabbalah", "/kabbalah/yhvh"]);
    // A top-level page has nothing above it.
    expect(serverRender("/about")).not.toContain('aria-label="Breadcrumb"');
  });

  it("prefetches nothing from the closed drawer and title menu", () => {
    // Hidden but in the viewport, their links would make Next fetch and run
    // every page they list, the chat's megabyte of code among them.
    drawer.inline = true;
    serverRender("/kabbalah/tree");
    const closed = links.rendered
      .filter((link) => link.prefetch === false)
      .map((link) => link.href);
    expect(closed).toEqual(
      expect.arrayContaining(["/", "/chat", "/kabbalah", "/kabbalah/yhvh"]),
    );
    // Only the links on show prefetch: the trail beside the title and
    // signing in. The list is exact on purpose: a new link in the bar has
    // to say whether it may prefetch.
    expect(
      links.rendered
        .filter((link) => link.prefetch !== false)
        .map((link) => link.href.replace(/\?.*/, "")),
    ).toEqual(["/kabbalah", "/signin"]);
  });

  it("lets an open menu's links prefetch as Next would", () => {
    // null is Next's default, "auto"; false stops viewport and hover alike.
    expect(menuPrefetch(true)).toBeNull();
    expect(menuPrefetch(false)).toBe(false);
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
    // A section with no pages yet is one link to its own page.
    expect(hrefs).toContain("/open-source");
  });
});
