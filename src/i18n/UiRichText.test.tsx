import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import AboutPage from "@/app/about/AboutPage";
import BooksPage from "@/app/books/BooksPage";
import HomeText from "@/app/HomeText";
import { messages as english } from "@/locales/en/messages.js";
import { messages as hebrew } from "@/locales/he/messages.js";
import LocaleProvider from "./LocaleProvider";
import UiRichText from "./UiRichText";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));
it("renders the shared pages in both languages and keeps code-owned links and anchors", () => {
  for (const Page of [HomeText, AboutPage, BooksPage]) {
    const en = renderToString(
      <LocaleProvider locale="en" messages={english}>
        <Page />
      </LocaleProvider>,
    );
    const he = renderToString(
      <LocaleProvider locale="he" messages={hebrew}>
        <Page />
      </LocaleProvider>,
    );
    expect(he).toMatch(/[א-ת]/);
    for (const source of en.matchAll(/href="(https:[^"]+)"/g))
      expect(he).toContain(source[0]);
    for (const anchor of en.matchAll(/id="([^"]+)"/g))
      expect(he).toContain(anchor[0]);
    expect(en).not.toMatch(/&lt;\/?\d/);
    expect(he).not.toMatch(/&lt;\/?\d/);
  }
  const home = renderToString(
    <LocaleProvider locale="he" messages={hebrew}>
      <HomeText />
    </LocaleProvider>,
  );
  expect(home).toContain('href="/he/books"');
  expect(home).toContain('href="/kabbalah"');
});
it("labels a missing rich translation as English and escapes interpolated content", () => {
  const html = renderToString(
    <LocaleProvider locale="he" messages={hebrew}>
      <UiRichText
        message="Untranslated {value}"
        values={{ value: "<script>bad</script>" }}
      />
    </LocaleProvider>,
  );
  expect(html).toContain('lang="en" dir="ltr"');
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>bad");
});
