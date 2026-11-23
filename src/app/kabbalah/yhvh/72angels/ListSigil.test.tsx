import angels from "magick-data/kabbalah/seventyTwoAngels";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LocaleProvider from "@/i18n/LocaleProvider";
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

  it("shows the angel's own static file, lazily, linking the generator", () => {
    const en = render("en");
    expect(en).toContain(
      'src="/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.png" width="1024" height="1024"',
    );
    expect(en).toContain('loading="lazy"');
    expect(en).toContain(
      'alt="The Rose Cross sigil of Vehuiah, והויה, traced on the Golden Dawn&#x27;s rose of 22 letters"',
    );
    expect(en).toContain("Vehuiah&#x27;s Rose Cross sigil.");
    const he = render("he");
    expect(he).toContain("סיגיל צלב הוורד של Vehuiah.");
    expect(he).toContain(
      'alt="סיגיל צלב הוורד של Vehuiah, והויה, משורטט על ורד 22 האותיות של השחר הזהוב"',
    );
    for (const html of [en, he]) {
      expect(html).toContain(
        'href="/gd/sigils?text=%D7%95%D7%94%D7%95%D7%99%D7%94"',
      );
      expect(html).not.toMatch(/&lt;\/?\d/);
    }
  });

  it("numbers a shared name in the alt text, as the angel's page does", () => {
    expect(render("en", 17)).toContain(
      "The Rose Cross sigil of Lauviah, angel 17 of the 72,",
    );
    expect(render("en", 17)).toContain(
      'src="/kabbalah/angel/lauviah-17/lauviah-17-rose-cross-sigil.png"',
    );
  });
});
