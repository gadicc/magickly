import { KAMEA_PLANETS } from "magick-data/astrology/kameas";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LocaleProvider from "@/i18n/LocaleProvider";
import { messages as english } from "@/locales/en/messages.js";
import { messages as hebrew } from "@/locales/he/messages.js";
import { kameaFiles } from "@/seo/kameas";
import KameaHub from "./KameaHub";
import KameaPage, { hallsDrawing } from "./KameaPage";
import type { KameaPlanetId } from "./kameaPlanets";
import {
  exceptionsOf,
  planetaryNamePath,
  planetaryNamesOf,
} from "./planetaryNames";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

const render = (node: React.ReactNode, locale: "en" | "he" = "en") =>
  renderToString(
    <LocaleProvider
      locale={locale}
      messages={locale === "en" ? english : hebrew}
    >
      {node}
    </LocaleProvider>,
  )
    .replaceAll("&amp;", "&")
    .replaceAll("&#x27;", "'")
    .replaceAll("<!-- -->", "");

const page = (planet: KameaPlanetId, locale: "en" | "he" = "en") =>
  render(<KameaPage planet={planet} />, locale);

const agrippa = (leaf: number) =>
  `https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n${leaf}/mode/1up`;

describe("a kamea's page", () => {
  it("shows the square's file, its numbers and its downloads", () => {
    const html = page("saturn");
    const { png, svg } = kameaFiles("saturn");
    expect(html).toContain(`src="${png.path}"`);
    expect(html).toContain(
      'alt="Kamea of Saturn, the magic square of 3 by 3: the numbers 1 to 9, every row, column and diagonal adding up to 15, and the whole to 45, as Agrippa prints it"',
    );
    expect(html).toContain(`href="${svg.path}"`);
    expect(html).toContain(`download="${svg.name}"`);
    // The structured data names the same files.
    expect(html).toContain(`"contentUrl":"https://magick.ly${png.path}"`);
    expect(html).toMatch(/1–9/);
  });

  it("lists every name, links each name page, and renders every exception row", () => {
    for (const planet of KAMEA_PLANETS) {
      const html = page(planet);
      for (const name of planetaryNamesOf(planet)) {
        expect(html, name.id).toContain(`data-name="${name.id}"`);
        const path = planetaryNamePath(name);
        if (path) expect(html, name.id).toContain(`href="${path}"`);
        // The page and the data test read the same rows (plan 093).
        for (const exception of exceptionsOf(name)) {
          expect(html, exception.id).toContain(
            `data-exception="${exception.id}"`,
          );
          expect(html, exception.id).toContain(
            `Prints ${exception.printed}, where its letters give ${exception.expected}.`,
          );
        }
      }
    }
  });

  it("says whose each difference is", () => {
    const html = page("venus");
    // Kedemel: Agrippa's slip, which 1651 took over.
    expect(html).toContain(
      "A slip of this printing, its author's or its printer's.",
    );
    expect(html).toContain("Taken over from Agrippa 1533.");
    expect(html).toContain(
      "Whose the difference is, the evidence read does not settle.",
    );
  });

  it("links the names' leaves, opening Agrippa's in the lightbox", () => {
    const saturn = page("saturn");
    // n163 for Saturn's names, n164 for its square, both mirrored.
    expect(saturn).toContain(`href="${agrippa(163)}"`);
    expect(saturn).toContain(`href="${agrippa(164)}"`);
    expect(saturn).toContain('aria-haspopup="dialog"');
    expect(saturn).toContain(
      'href="https://archive.org/details/b22006795/page/n181/mode/1up"',
    );
    expect(saturn).toContain(
      'href="https://archive.org/details/aleister-crowley-liber-777/page/n27/mode/1up"',
    );
    expect(saturn).toContain(
      'href="https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n75/mode/1up"',
    );
    // The Moon's names are on n164, its square on n168.
    const luna = page("luna");
    expect(luna).toContain(`href="${agrippa(164)}"`);
    expect(luna).toContain(`href="${agrippa(168)}"`);
    expect(luna).not.toContain(`href="${agrippa(163)}"`);
  });

  it("sets the Hebrew in Frank Ruhl Libre's class, marked as Hebrew", () => {
    const html = page("jupiter");
    expect(html).toMatch(/lang="he" dir="rtl"[^>]*>יהפיאל/);
    // 777's other spelling, beside its reading.
    expect(html).toMatch(/lang="he" dir="rtl"[^>]*>יופיל/);
  });

  it("notes the printings' variants of the square, facts only", () => {
    expect(page("venus")).toContain(
      "Regardie's volume 4 prints 43 in row 2, column 3, where Agrippa has 48",
    );
    expect(page("mercury")).toContain("swaps three pairs of numbers");
    expect(page("luna")).toContain("Agrippa prints 45 in row 1, column 8");
    expect(page("saturn")).not.toContain("Regardie's volume 4 prints");
  });

  it("explains the Moon's column and its two long names on the Moon's page only", () => {
    const luna = page("luna");
    expect(luna).toContain("The Moon's column");
    expect(luna).toContain("Shelachel");
    expect(luna).toContain("intelligence of intelligences");
    expect(luna).toContain(
      "Dividing it in two, where its romanisation divides it, is ours",
    );
    expect(page("saturn")).not.toContain("The Moon's column");
  });

  it("links the planet, the generator and the halls that draw the square", () => {
    expect(hallsDrawing("luna").map((hall) => hall.slug)).toEqual([
      "theoricus-2",
    ]);
    expect(hallsDrawing("venus").map((hall) => hall.slug)).toEqual([
      "philosophus-4",
    ]);
    expect(hallsDrawing("saturn")).toEqual([]);
    const venus = page("venus");
    expect(venus).toContain('href="/astrology/planet/venus"');
    expect(venus).toContain('href="/gd/halls/philosophus-4"');
    expect(venus).toContain('href="/astrology/kamea/sigils?planet=venus"');
    expect(venus).toContain('href="/astrology/kamea/sol"');
    expect(venus).toContain('href="/astrology/kamea/mercury"');
    expect(page("saturn")).not.toContain('href="/gd/halls/');
  });

  it("gives the method and the plates to Regardie, and his leaves by page", () => {
    for (const planet of KAMEA_PLANETS) {
      const html = page(planet);
      expect(html, planet).not.toContain("Golden Dawn's");
      expect(html, planet).not.toContain("Order's papers");
      expect(html, planet).toContain("Regardie's plates in");
    }
    // His square of Venus is on p. 84, leaf n78; the seal's account on p. 80.
    const venus = page("venus");
    expect(venus).toMatch(
      /href="https:\/\/archive.org\/details\/IsraelRegardie-TheGoldenDawn-Vol4-1940\/page\/n78\/mode\/1up"[^>]*>page 84</,
    );
    expect(venus).toContain(
      'href="https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n74/mode/1up"',
    );
    expect(venus).not.toContain("lines pass through every number");
  });

  it("names what each leaf has beside the square, and which squares are corrected", () => {
    expect(page("saturn")).toContain(
      "the characters of its intelligence and its spirit",
    );
    expect(page("venus")).toContain(
      "its intelligence, its spirit and its intelligences, the Bne Seraphim",
    );
    expect(page("luna")).toContain(
      "its spirit, its spirit of spirits and its intelligence of intelligences",
    );
    expect(page("luna")).toContain("with one misprinted number corrected");
    expect(page("luna")).toContain(
      "with the slip of the 1533 printing noted below corrected",
    );
    expect(page("saturn")).toContain(
      "The square here is Agrippa's as the 1533 printing gives it.",
    );
    expect(page("saturn")).not.toContain("misprinted");
    for (const planet of KAMEA_PLANETS)
      expect(page(planet), planet).not.toContain("his printer");
  });

  it("draws the seal and names it", () => {
    expect(page("mars")).toContain('aria-label="Seal of Mars"');
  });

  it("reads in Hebrew with no placeholder left as text", () => {
    for (const planet of KAMEA_PLANETS) {
      const html = page(planet, "he");
      expect(html, planet).not.toMatch(/&lt;\/?\d/);
      expect(html, planet).not.toMatch(/\{[a-z]+\}/);
    }
  });
});

describe("the kameas' hub", () => {
  it("links the seven squares, Agrippa's leaves, Regardie's and the generator", () => {
    const html = render(<KameaHub />);
    for (const planet of KAMEA_PLANETS)
      expect(html).toContain(`href="/astrology/kamea/${planet}"`);
    expect(html).toContain(`href="${agrippa(163)}"`);
    expect(html).toContain(`href="${agrippa(164)}"`);
    // What the magi call the squares, and Saturn's lead and the Sun's
    // gold, each on its leaf of the chapter (checked against 1533).
    expect(html).toContain("the magi call them the planets' sacred tables");
    for (const leaf of [160, 161, 162])
      expect(html).toContain(`href="${agrippa(leaf)}"`);
    expect(html).not.toContain("amulet");
    expect(html).toContain(
      'href="https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n72/mode/1up"',
    );
    expect(html).toContain('href="/astrology/kamea/sigils"');
    expect(html).toContain('href="/gd/halls/theoricus-2"');
    expect(html).toContain("3 by 3, each line 15, the whole 45");
    // The Order lost the method; Regardie gives it, and says so.
    expect(html).toContain("the Order no longer knew how to form sigils");
    expect(html).not.toContain("Order's papers");
    expect(html).not.toContain("Golden Dawn's method");
    expect(html).not.toContain("his printer");
    // Seven squares drawn, each hidden behind its link's own name.
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(7);
  });

  it("reads in Hebrew with no placeholder left as text", () => {
    const html = render(<KameaHub />, "he");
    expect(html).not.toMatch(/&lt;\/?\d/);
    expect(html).not.toMatch(/\{[a-z]+\}/);
  });
});
