import angels from "magick-data/kabbalah/seventyTwoAngels";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LocaleProvider from "@/i18n/LocaleProvider";
import { angelSlug } from "@/lib/angelSlugs";
import { messages as english } from "@/locales/en/messages.js";
import { messages as hebrew } from "@/locales/he/messages.js";
import SeventyTwoAngels from "./angels";
import ListSigil from "./ListSigil";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

const angel = (no: number) => angels[no - 1];

const render = (locale: "en" | "he", no = 1) =>
  renderToString(
    <LocaleProvider
      locale={locale}
      messages={locale === "en" ? english : hebrew}
    >
      <ListSigil angel={angel(no)} />
    </LocaleProvider>,
  );

describe("the 72 angels' list sigils", () => {
  it("draws none with the page: each mounts with its opened entry", () => {
    const html = renderToString(<SeventyTwoAngels />);
    expect(html).not.toContain("rose-cross-sigil");
    expect(html).not.toContain("<img");
    expect(html).toContain("Open an angel to see its Rose Cross sigil.");
  });

  it("shows the band's static file, lazily, linking the page and the generator", () => {
    const en = render("en");
    expect(en).toContain(
      'src="/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil-band.png" width="1024" height="1024"',
    );
    expect(en).toContain('loading="lazy"');
    expect(en).toContain(
      'alt="The Rose Cross sigil of Vehuiah, והויה, inside a ring with the name in Hebrew"',
    );
    // The caption names the style and sends a reader to the page for the
    // other three (plan 096, decision 12).
    expect(en.replaceAll("<!-- -->", "")).toContain(
      "Vehuiah&#x27;s Rose Cross sigil, in a ring with its name.",
    );
    expect(en).toContain(
      "has it on the rose, alone, and as a talisman with its verse;",
    );
    const he = render("he");
    expect(he).toContain("סיגיל צלב הוורד של Vehuiah, בתוך טבעת עם שמו.");
    expect(he).toContain(
      'alt="סיגיל צלב הוורד של Vehuiah, והויה, בתוך טבעת שבה השם בעברית"',
    );
    for (const html of [en, he]) {
      expect(html).toContain('href="/kabbalah/angel/vehuiah"');
      expect(html).toContain(
        'href="/gd/sigils?text=%D7%95%D7%94%D7%95%D7%99%D7%94"',
      );
      // No menu: the list always shows the band.
      expect(html).not.toContain("<select");
      expect(html).not.toMatch(/&lt;\/?\d/);
    }
  });

  it("numbers a shared name in the alt text, as the angel's page does", () => {
    expect(render("en", 17)).toContain(
      "The Rose Cross sigil of Lauviah, angel 17 of the 72, לאויה, inside a ring",
    );
    expect(render("en", 17)).toContain(
      'src="/kabbalah/angel/lauviah-17/lauviah-17-rose-cross-sigil-band.png"',
    );
  });

  it("shows every angel's band, a file the angel's page links", () => {
    for (const each of angels) {
      const html = render("en", each.no);
      const src = html.match(/<img src="([^"]+)"/)?.[1];
      expect(src, each.name.en).toBe(
        `/kabbalah/angel/${angelSlug(each.no)}/${angelSlug(each.no)}-rose-cross-sigil-band.png`,
      );
    }
  });
});
