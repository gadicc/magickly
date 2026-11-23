// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { SIGIL_STYLE_NOTES } from "magick-components/gd/roseSigilStyles";
import angels from "magick-data/kabbalah/seventyTwoAngels";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocaleProvider from "@/i18n/LocaleProvider";
import { angelSlug } from "@/lib/angelSlugs";
import { messages as english } from "@/locales/en/messages.js";
import { messages as hebrew } from "@/locales/he/messages.js";
import { ANGEL_SIGIL_STYLES } from "@/render/contracts/angelSigil";
import {
  angelSigilBasedOn,
  angelSigilSection,
  angelSigilStyleAlt,
  angelSigilStyleFiles,
} from "@/seo/angelSigils";
import { citeUrl } from "@/sources/works";
import AngelSigil from "./AngelSigil";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));
// Next's <Link>, marked, so that a link the router would fetch is seen.
vi.mock("next/link", async () => {
  const { createElement, forwardRef } = await import("react");
  return {
    default: forwardRef<HTMLAnchorElement, Record<string, unknown>>(
      ({ prefetch: _prefetch, ...props }, ref) =>
        createElement("a", { ...props, ref, "data-next-link": "" }),
    ),
  };
});

const angel = (no: number) => angels[no - 1];
const pageOf = (no: number) => `/kabbalah/angel/${angelSlug(no)}`;

const LABELS = {
  band: "In a ring with its name",
  bare: "Alone, with its name",
  rose: "On the rose",
  talisman: "Talisman with its verse",
} as const;

beforeEach(() => window.history.replaceState(null, "", pageOf(1)));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const tree = (no: number, locale: "en" | "he" = "en") => (
  <LocaleProvider locale={locale} messages={locale === "en" ? english : hebrew}>
    <AngelSigil section={angelSigilSection(angel(no))} />
  </LocaleProvider>
);

const serverHtml = (no: number, locale: "en" | "he" = "en") =>
  renderToString(tree(no, locale));

/** The markup in a detached element, to query. */
const parsed = (html: string) => {
  const box = document.createElement("div");
  box.innerHTML = html;
  return box;
};

/** The figure's image and caption, and the shown style's downloads. */
function shown(root: ParentNode) {
  const images = [...root.querySelectorAll("figure img")];
  return {
    images,
    src: images[0]?.getAttribute("src"),
    alt: images[0]?.getAttribute("alt"),
    caption: root.querySelector("figcaption")?.textContent ?? "",
    downloads: [...root.querySelectorAll("a[download]")].map((a) =>
      a.getAttribute("href"),
    ),
    tapped: root.querySelector("figure a")?.getAttribute("href"),
  };
}

describe("an angel page's sigil section", () => {
  it("offers the four styles, and links every style's files, for each angel", () => {
    for (const each of angels) {
      const box = parsed(serverHtml(each.no));
      const label = box.querySelector("label");
      const select = box.querySelector("select");
      expect(label?.textContent).toBe("Sigil style");
      expect(label?.getAttribute("for")).toBe(select?.id);
      expect(
        [...(select?.querySelectorAll("option") ?? [])].map((option) => [
          option.value,
          option.textContent,
        ]),
        each.name.en,
      ).toEqual(ANGEL_SIGIL_STYLES.map((style) => [style, LABELS[style]]));
      const list = box.querySelector("ul");
      const intro = list?.previousElementSibling;
      expect(intro?.textContent).toBe("Every style:");
      expect(list?.getAttribute("aria-labelledby")).toBe(intro?.id);
      expect(
        [...(list?.querySelectorAll("li") ?? [])].map((item) => [
          item.textContent,
          ...[...item.querySelectorAll("a")].map((a) => a.getAttribute("href")),
        ]),
      ).toEqual(
        ANGEL_SIGIL_STYLES.map((style) => {
          const { png, svg } = angelSigilStyleFiles(each, style);
          return [`${LABELS[style]}: PNG · SVG`, png.path, svg.path];
        }),
      );
      // The band, and only the band, is the figure the server renders.
      const { png, svg } = angelSigilStyleFiles(each, "band");
      const now = shown(box);
      expect(now.images).toHaveLength(1);
      expect(now).toMatchObject({
        src: png.path,
        alt: angelSigilStyleAlt(each, "band"),
        downloads: [png.path, svg.path],
        tapped: png.path,
      });
    }
  });

  it("links the files as plain anchors, which Next's router never fetches", () => {
    // A click on Next's <Link> asks for the file with `RSC: 1` first, which
    // on Vercel may reach the route as `<name>.rsc` (plan 096, decision 3).
    const box = parsed(serverHtml(1));
    const files = [...box.querySelectorAll("a")].filter((a) =>
      /\.(png|svg)$/.test(a.getAttribute("href") ?? ""),
    );
    expect(files).toHaveLength(2 + 1 + 2 * ANGEL_SIGIL_STYLES.length);
    for (const a of files)
      expect(a.hasAttribute("data-next-link"), a.outerHTML).toBe(false);
    // The mark is seen where Next's <Link> is used: the generator's link.
    expect(box.querySelector('a[data-next-link][href^="/gd/sigils"]')).not.toBe(
      null,
    );
  });

  it("translates the menu, the captions and the alt text, keeping the links", () => {
    const en = serverHtml(1);
    expect(en).toContain(
      'alt="The Rose Cross sigil of Vehuiah, והויה, inside a ring with the name in Hebrew"',
    );
    const he = serverHtml(1, "he");
    expect(he).toContain(
      'alt="סיגיל צלב הוורד של Vehuiah, והויה, בתוך טבעת שבה השם בעברית"',
    );
    expect(he).toContain("סגנון הסיגיל");
    expect(he).toContain(">בתוך טבעת עם שמו</option>");
    expect(he).toContain("כל הסגנונות:");
    expect(he).toContain("הורדת SVG");
    for (const html of [en, he]) {
      expect(html).toContain(
        'href="/gd/sigils?text=%D7%95%D7%94%D7%95%D7%99%D7%94"',
      );
      // The band's caption cites Mathers's Fig. 18 on its plate.
      expect(html).toContain(
        'href="https://archive.org/details/b24884431/page/n79/mode/1up"',
      );
      // Every placeholder became an element; none shows as text.
      expect(html).not.toMatch(/&lt;\/?\d/);
    }
  });

  it("carries the band and only the band on the server, whatever the URL", () => {
    window.history.replaceState(null, "", `${pageOf(1)}?style=talisman`);
    const html = serverHtml(1);
    const box = parsed(html);
    const band = angelSigilStyleFiles(angel(1), "band");
    expect(shown(box)).toMatchObject({
      src: band.png.path,
      downloads: [band.png.path, band.svg.path],
    });
    expect(shown(box).caption).toMatch(/^The sigil inside a ring/);
    expect(html).not.toContain("A talisman");
    expect(box.querySelector("select option[selected]")?.textContent).toBe(
      LABELS.band,
    );
  });

  it("shows a shared link's style once hydrated, as one figure", async () => {
    window.history.replaceState(null, "", `${pageOf(1)}?style=talisman#sigil`);
    const container = document.createElement("div");
    container.innerHTML = serverHtml(1);
    document.body.appendChild(container);
    const errors = vi.spyOn(console, "error");
    const recoverable: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, tree(1), {
          onRecoverableError: (error) => recoverable.push(error),
        });
      });
      expect(recoverable).toEqual([]);
      expect(
        errors.mock.calls.filter((call) =>
          /hydrat|did not match/i.test(String(call[0])),
        ),
      ).toEqual([]);
      const talisman = angelSigilStyleFiles(angel(1), "talisman");
      const now = shown(container);
      expect(now.images).toHaveLength(1);
      expect(now).toMatchObject({
        src: talisman.png.path,
        tapped: talisman.png.path,
        downloads: [talisman.png.path, talisman.svg.path],
        // The psalm only (decision for Gadi 12): Lenain's verse numbers
        // are often not the Vulgate's.
        alt: "A talisman of Vehuiah, והויה: the Rose Cross sigil inside a ring lettered with a verse of Psalm 3 (Vulgate numbering) in Latin",
      });
      expect(now.caption).toMatch(/^A talisman as Lenain describes/);
      expect(now.caption).not.toContain("Genesis");
      expect(
        (container.querySelector("select") as HTMLSelectElement).value,
      ).toBe("talisman");
      // Reading the URL wrote nothing.
      expect(window.location.search).toBe("?style=talisman");
      expect(window.location.hash).toBe("#sigil");
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });

  it("writes a pick to the URL, keeping the rest, and never the band", () => {
    window.history.replaceState(null, "", `${pageOf(17)}?ref=mail#sigil`);
    const { container } = render(tree(17));
    const select = container.querySelector("select") as HTMLSelectElement;
    select.focus();
    fireEvent.change(select, { target: { value: "bare" } });
    expect(window.location.pathname).toBe("/kabbalah/angel/lauviah-17");
    expect(window.location.search).toBe("?ref=mail&style=bare");
    expect(window.location.hash).toBe("#sigil");
    const bare = angelSigilStyleFiles(angel(17), "bare");
    expect(shown(container)).toMatchObject({
      src: bare.png.path,
      alt: "The Rose Cross sigil of Lauviah, angel 17 of the 72, לאויה, drawn alone with the name beneath",
    });
    // The menu keeps the focus; the figure is not announced.
    expect(document.activeElement).toBe(select);
    expect(container.querySelector("[aria-live]")).toBeNull();
    fireEvent.change(select, { target: { value: "rose" } });
    expect(window.location.search).toBe("?ref=mail&style=rose");
    expect(shown(container).alt).toBe(angelSigilStyleAlt(angel(17), "rose"));
    expect(shown(container).caption).toMatch(/^Traced through the letters/);
    fireEvent.change(select, { target: { value: "band" } });
    expect(window.location.search).toBe("?ref=mail");
    expect(window.location.hash).toBe("#sigil");
  });

  it("shows the band for a style it does not know", () => {
    window.history.replaceState(null, "", `${pageOf(1)}?style=Talisman`);
    const { container } = render(tree(1));
    expect(shown(container).src).toBe(
      angelSigilStyleFiles(angel(1), "band").png.path,
    );
  });

  it("follows the history's own changes", () => {
    const { container } = render(tree(1));
    act(() => {
      window.history.replaceState(null, "", `${pageOf(1)}?style=bare`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(shown(container).src).toBe(
      angelSigilStyleFiles(angel(1), "bare").png.path,
    );
  });

  it("says where Jabamiah's Genesis comes from, citing Kircher", () => {
    window.history.replaceState(null, "", `${pageOf(70)}?style=talisman`);
    const { container } = render(tree(70));
    const now = shown(container);
    expect(now.alt).toBe(
      "A talisman of Jabamiah, יבמיה: the Rose Cross sigil inside a ring lettered with Genesis 1:1 in Latin",
    );
    expect(now.caption).toContain(
      "Lenain gives Jabamiah no psalm but the first verse of Genesis, in French; the Latin here is the Vulgate's",
    );
    expect(
      container.querySelector(
        `figcaption a[href="${citeUrl("kircher1653Complutense", { leaf: 287 })}"]`,
      )?.textContent,
    ).toBe("p. 280");
  });
});

describe("the captions' citations", () => {
  /** The links a style's caption makes: their text and where they go. */
  function citations(style: string, no = 1) {
    window.history.replaceState(null, "", `${pageOf(no)}?style=${style}`);
    const { container, unmount } = render(tree(no));
    const links = [...container.querySelectorAll("figcaption a")].map((a) => [
      a.textContent,
      a.getAttribute("href"),
    ]);
    unmount();
    return links;
  }

  it("cite each scan by its leaf or page", () => {
    const mathers = citeUrl("mathers1889", { leaf: 79 });
    expect(citations("band")).toEqual([["Plate IV, Fig. 18", mathers]]);
    expect(citations("bare")).toEqual([
      ["p. 58", citeUrl("regardie1940", { leaf: 52 })],
    ]);
    expect(citations("rose")).toEqual([
      ["57", citeUrl("regardie1940", { leaf: 51 })],
      ["58", citeUrl("regardie1940", { leaf: 52 })],
    ]);
    expect(citations("talisman")).toEqual([
      ["p. 45", "https://books.google.com/books?id=qt9SAAAAcAAJ&pg=PA45"],
      // The 1823 printing's title page, an unnumbered leaf (Y0).
      ["title page", "https://books.google.com/books?id=qt9SAAAAcAAJ&pg=PP11"],
      ["Plate IV, Fig. 21", mathers],
    ]);
  });

  it("open Mathers's plate in the mirror", () => {
    const { container } = render(tree(1));
    expect(
      container.querySelector("figcaption a")?.getAttribute("aria-haspopup"),
    ).toBe("dialog");
  });

  it("rest on works the package's own notes cite for each style", () => {
    // The structured data's `isBasedOn` (angelSigils.ts) against the
    // package's SIGIL_STYLE_NOTES, the notes for its own users, which link
    // archive.org's leaves without the site's `/mode/1up`.
    const leaf = (url: string) => url.replace(/\/mode\/1up$/, "");
    const noted = (style: (typeof ANGEL_SIGIL_STYLES)[number]) =>
      SIGIL_STYLE_NOTES[style].sources.map((source) => leaf(source.url ?? ""));
    for (const style of ANGEL_SIGIL_STYLES)
      for (const url of angelSigilBasedOn(style))
        expect(noted(style), style).toContain(leaf(url));
    // And every scan a caption links is one of those, or one the package
    // does not note: the title page and Kircher's page.
    const extra = [
      "https://books.google.com/books?id=qt9SAAAAcAAJ&pg=PP11",
      citeUrl("kircher1653Complutense", { leaf: 287 }),
    ].map(leaf);
    for (const style of ANGEL_SIGIL_STYLES)
      for (const [, href] of citations(style, 70))
        expect([...noted(style), ...extra], `${style}: ${href}`).toContain(
          leaf(href ?? ""),
        );
  });
});
