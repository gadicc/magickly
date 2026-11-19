import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import LocaleProvider from "@/i18n/LocaleProvider";
import { messages as english } from "@/locales/en/messages.js";
import { messages as hebrew } from "@/locales/he/messages.js";
import SigilsText from "./SigilsText";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

const render = (locale: "en" | "he") =>
  renderToString(
    <LocaleProvider
      locale={locale}
      messages={locale === "en" ? english : hebrew}
    >
      <SigilsText />
    </LocaleProvider>,
  );

it("cites Regardie's rules and figures, leaf by leaf, in both languages", () => {
  for (const html of [render("en"), render("he")]) {
    for (const leaf of [51, 52, 53, 54])
      expect(html).toContain(
        `href="https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n${leaf}/mode/1up"`,
      );
    expect(html).toContain(
      'href="https://github.com/gadicc/magickly/blob/main/plans/088-rose-sigil-oracle.md"',
    );
    // Every placeholder became an element; none shows as text.
    expect(html).not.toMatch(/&lt;\/?\d/);
  }
});

it("links its examples into the generator and the 72 angels", () => {
  const html = render("en");
  for (const text of ["מטטרון", "אלהים", "יהוה אלהים", "שבתאי", "והויה"])
    expect(html).toContain(
      `href="/gd/sigils?text=${encodeURIComponent(text)}"`,
    );
  expect(html).toContain('href="/kabbalah/yhvh/72angels"');
  // The angels' pages show their sigils (plan 088, S4).
  expect(html).toContain('href="/kabbalah/angel/vehuiah"');
});

it("is translated into Hebrew, with the English headings' anchor kept", () => {
  const he = render("he");
  expect(he).toContain("כיצד משרטטים סיגיל של צלב הוורד");
  expect(he).toContain('id="sigils-text"');
});
