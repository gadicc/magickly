import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import LocaleProvider from "@/i18n/LocaleProvider";
import { messages as english } from "@/locales/en/messages.js";
import { messages as hebrew } from "@/locales/he/messages.js";
import { ANGEL_SIGIL_ALT } from "@/seo/angelSigils";
import AngelSigil from "./AngelSigil";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

const render = (locale: "en" | "he") =>
  renderToString(
    <LocaleProvider
      locale={locale}
      messages={locale === "en" ? english : hebrew}
    >
      <AngelSigil
        name="Vehuiah"
        number={1}
        hebrew="והויה"
        alt={ANGEL_SIGIL_ALT}
        png={{
          name: "vehuiah-rose-cross-sigil.png",
          path: "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.png",
          width: 1024,
          height: 1024,
        }}
        svg={{
          name: "vehuiah-rose-cross-sigil.svg",
          path: "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.svg",
        }}
        generatorHref="/gd/sigils?text=%D7%95%D7%94%D7%95%D7%99%D7%94"
      />
    </LocaleProvider>,
  );

it("translates the section, its alt text included, keeping the links", () => {
  const en = render("en");
  expect(en).toContain(
    'alt="The Rose Cross sigil of Vehuiah, והויה, traced on the Golden Dawn&#x27;s rose of 22 letters"',
  );
  const he = render("he");
  expect(he).toContain(
    'alt="סיגיל צלב הוורד של Vehuiah, והויה, משורטט על ורד 22 האותיות של השחר הזהוב"',
  );
  expect(he).toContain("סיגיל של צלב הוורד");
  expect(he).toContain("הורדת SVG");
  for (const html of [en, he]) {
    expect(html).toContain(
      'href="/gd/sigils?text=%D7%95%D7%94%D7%95%D7%99%D7%94"',
    );
    expect(html).toContain(
      'href="/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.svg"',
    );
    // Every placeholder became an element; none shows as text.
    expect(html).not.toMatch(/&lt;\/?\d/);
  }
});
