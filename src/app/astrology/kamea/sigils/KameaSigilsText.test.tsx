import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import LocaleProvider from "@/i18n/LocaleProvider";
import { messages as english } from "@/locales/en/messages.js";
import { messages as hebrew } from "@/locales/he/messages.js";
import KameaSigilsText from "./KameaSigilsText";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

const render = (locale: "en" | "he") =>
  renderToString(
    <LocaleProvider
      locale={locale}
      messages={locale === "en" ? english : hebrew}
    >
      <KameaSigilsText />
    </LocaleProvider>,
  );

it("cites Agrippa's and Regardie's leaves in both languages", () => {
  for (const html of [render("en"), render("he")]) {
    for (const leaf of [163, 164, 168])
      expect(html).toContain(
        `href="https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n${leaf}/mode/1up"`,
      );
    for (const leaf of [72, 73, 74])
      expect(html).toContain(
        `href="https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n${leaf}/mode/1up"`,
      );
    expect(html).toContain(
      'href="https://github.com/gadicc/magickly/blob/main/plans/093-kameas-and-their-sigils.md"',
    );
    // Every placeholder became an element; none shows as text.
    expect(html).not.toMatch(/&lt;\/?\d/);
  }
  expect(render("he")).toContain("כיצד משרטטים סיגיל על קמיע");
});

it("links its examples into the generator and the rose's", () => {
  const html = render("en").replaceAll("&amp;", "&");
  for (const [planet, text] of [
    ["saturn", "אגיאל"],
    ["mercury", "תפתרתרת"],
    ["luna", "חשמודאי"],
  ])
    expect(html).toContain(
      `href="/astrology/kamea/sigils?${new URLSearchParams({ planet, text })}"`,
    );
  expect(html).toContain('href="/gd/sigils"');
});
