import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LocaleProvider from "@/i18n/LocaleProvider";
import { messages as english } from "@/locales/en/messages.js";
import { messages as hebrew } from "@/locales/he/messages.js";
import { planetaryNameSigilFiles } from "@/seo/planetaryNames";
import { expectEntityPage } from "../../../../tests/entityPage";
import { characterStrokes } from "./NameCharacter";
import NamePage, { NAME_LEDES } from "./NamePage";
import {
  characterOf,
  exceptionsOf,
  otherSpellings,
  type PlanetaryName,
  planetaryName,
  planetaryNamePath,
  planetaryNamesWithPages,
  tracedSpelling,
} from "./planetaryNames";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

const render = (name: PlanetaryName, locale: "en" | "he" = "en") =>
  renderToString(
    <LocaleProvider
      locale={locale}
      messages={locale === "en" ? english : hebrew}
    >
      <NamePage name={name} />
    </LocaleProvider>,
  )
    .replaceAll("&amp;", "&")
    .replaceAll("&#x27;", "'")
    .replaceAll("<!-- -->", "");

const named = (id: string) => {
  const name = planetaryName(id);
  if (!name) throw new Error(id);
  return name;
};

const pages = new Map(
  planetaryNamesWithPages().map((name) => [name.id, render(name)]),
);
const page = (id: string) => pages.get(id) as string;

const agrippa = (leaf: number) =>
  `https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n${leaf}/mode/1up`;
const regardie = (leaf: number) =>
  `https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n${leaf}/mode/1up`;

describe("a planetary name's page", () => {
  it("renders every name with a page, with its lede, Hebrew and sigil", () => {
    expect(pages.size).toBe(16);
    expect(Object.keys(NAME_LEDES).sort()).toEqual([...pages.keys()].sort());
    for (const name of planetaryNamesWithPages()) {
      const html = page(name.id);
      // One heading, no defect, every link to a page the site has.
      expectEntityPage(html, name.name.roman);
      expect(html, name.id).toContain(`<h1>${name.name.roman}`);
      expect(html, name.id).toContain(NAME_LEDES[name.id]);
      // The traced spelling, drawn by the server, with its reduction.
      expect(html, name.id).toContain(`data-sigil="${tracedSpelling(name)}"`);
      expect(html, name.id).toContain("Each letter, its number and its cell");
      expect(html, name.id).not.toContain('data-placement="failed"');
      // Its static files, the generator and the pages it belongs with.
      const { png, svg } = planetaryNameSigilFiles(name);
      expect(html, name.id).toContain(`href="${png.path}"`);
      expect(html, name.id).toContain(`download="${svg.name}"`);
      expect(html, name.id).toContain(
        `"contentUrl":"https://magick.ly${png.path}"`,
      );
      expect(html, name.id).toContain(
        `href="/astrology/kamea/${name.planetId}"`,
      );
      expect(html, name.id).toContain(
        `href="/astrology/planet/${name.planetId}"`,
      );
      expect(html, name.id).toContain(
        `href="/astrology/kamea/sigils?planet=${name.planetId}&text=${encodeURIComponent(
          tracedSpelling(name) as string,
        ).replaceAll("%20", "+")}"`,
      );
    }
  });

  it("renders every exception row of its name, as the row says it", () => {
    for (const name of planetaryNamesWithPages())
      for (const exception of exceptionsOf(name)) {
        const html = page(name.id);
        expect(html, exception.id).toContain(
          `data-exception="${exception.id}"`,
        );
        expect(html, exception.id).toContain(
          `Prints ${exception.printed}, where its letters give ${exception.expected}.`,
        );
      }
    // Kedemel leads with the square's number and gives Agrippa's slip.
    const kedemel = page("kedemel");
    expect(kedemel).toContain("175, the sum of a line");
    expect(kedemel).toContain(
      "Agrippa 1533 prints 157; his reading below says whose the slip is.",
    );
    // Bartzabel's 325 is the square's: its letters give 326.
    expect(page("bartzabel")).toContain(
      "Its letters give 326; Agrippa 1533's reading below says why.",
    );
  });

  it("gives Agrippa's form beside the site's where they differ", () => {
    expect(page("bartzabel")).toContain("Agrippa 1533: Barzabel");
    expect(page("iophiel")).toContain("Agrippa 1533: Iohphiel");
    expect(page("zazel")).not.toContain("Agrippa 1533: ");
    // A diaeresis is no other spelling.
    expect(page("hismael")).not.toContain("Agrippa 1533: ");
  });

  it("quotes each witness's caption in full, as the leaf prints it", () => {
    const zazel = page("zazel");
    expect(zazel).toContain('<q lang="la">Daemonium Saturni</q>');
    expect(zazel).toContain('<q lang="en">The spirit of Saturn</q>');
    expect(page("agiel")).toContain('<q lang="la">Intelligentia Saturni</q>');
  });

  it("traces another witness's spelling where its trace differs, slips left out", () => {
    const spellings = (id: string) =>
      otherSpellings(named(id)).map(({ he, witnesses, unsettled }) => ({
        he,
        witnesses,
        unsettled: unsettled.map((row) => row.id),
      }));
    expect(spellings("iophiel")).toEqual([
      { he: "יופיל", witnesses: ["crowley777"], unsettled: [] },
    ]);
    expect(spellings("bartzabel")).toEqual([
      { he: "ברצבאל", witnesses: ["crowley777"], unsettled: [] },
    ]);
    expect(spellings("zazel")).toEqual([]);
    // 1651's and Barrett's slips are not traced; 777's Moon is, unsettled.
    expect(spellings("sorath")).toEqual([]);
    expect(spellings("chasmodai")).toEqual([]);
    expect(spellings("malcha-betharsisim")).toEqual([
      {
        he: "מלכא בתרשישים ועד ברוח שחקים",
        witnesses: ["crowley777"],
        unsettled: ["malcha-betharsisim-crowley777"],
      },
    ]);
    expect(spellings("taphthartharath")).toEqual([
      {
        he: "תפתרתדת",
        witnesses: ["agrippa1651"],
        unsettled: ["taphthartharath-agrippa1651"],
      },
    ]);
    const jupiter = page("iophiel");
    expect(jupiter).toContain('data-spelling="יופיל"');
    expect(jupiter).toContain('data-sigil="יופיל"');
    // After Agrippa's character.
    expect(jupiter.indexOf('id="other-spellings"')).toBeGreaterThan(
      jupiter.indexOf('id="character"'),
    );
    expect(page("zazel")).not.toContain("Other witnesses' spellings");
    expect(page("sorath")).not.toContain('data-sigil="סורה"');
    expect(page("taphthartharath")).toContain(
      'data-unsettled="taphthartharath-agrippa1651"',
    );
  });

  it("says the spirit of spirits' division is ours", () => {
    const html = page("schedbarschemoth-schartathan");
    expect(html).toContain(
      "Dividing it in two, where its romanisation divides it, is ours",
    );
    expect(html).toContain('data-sigil="שדברשהמעת שרתתן"');
    // As Agrippa prints it, in one word, in the heading.
    expect(html).toMatch(
      /<h1>[^<]*<span lang="he" dir="rtl"[^>]*>שדברשהמעתשרתתן/,
    );
    expect(page("zazel")).not.toContain("is ours");
  });

  it("redraws Agrippa's character and links his leaf, opening n164 at the figure", () => {
    for (const name of planetaryNamesWithPages()) {
      const character = characterOf(name, "agrippa1533");
      if (!character) throw new Error(name.id);
      const html = page(name.id);
      expect(html, name.id).toContain(`data-character="${character.id}"`);
      expect(html, name.id).toContain(
        `viewBox="0 0 ${character.region.width} ${character.region.height}"`,
      );
      expect(html, name.id).toContain('data-reader="fable"');
      expect(html, name.id).toContain(
        "redrawn from our reading of the woodcut",
      );
      expect(html, name.id).toContain(
        `href="${agrippa(Number(character.leaf.slice(1)))}"`,
      );
      expect(html.match(/data-line=""/g)?.length, name.id).toBe(
        characterStrokes(character)?.length,
      );
    }
    // n164 is mirrored: its link opens the lightbox.
    expect(page("agiel")).toContain('aria-haspopup="dialog"');
  });

  it("draws the curves, rings, hooks and bars where the reader put them", () => {
    // The spirit of spirits' oval, curved, with the ring on it.
    const oval = page("schedbarschemoth-schartathan");
    expect(oval).toMatch(/<path d="M[^"]* C[^"]*" data-line=""/);
    expect(page("agiel")).not.toMatch(/<path d="M[^"]* C[^"]*" data-line=""/);
    // A line leaves a ring at its edge, not its centre: Agiel starts in
    // a ring at (71, 53).
    expect(page("agiel")).toContain('<circle cx="71" cy="53"');
    expect(page("agiel")).not.toContain('d="M71,53');
    expect(oval).toContain('data-mark="ring"');
    // Bartzabel's curl and Chasmodai's bars, as placed.
    expect(page("bartzabel")).toContain(
      'data-mark="hook" data-placed="reader"',
    );
    expect(page("chasmodai")).toContain('data-mark="bar" data-placed="reader"');
    // Sorath's double hook: the tips read, the bend ours, and said so.
    const sorath = page("sorath");
    expect(sorath).toContain("how they bend is ours");
    expect(page("bartzabel")).not.toContain("how they bend is ours");
    expect(page("agiel")).not.toContain("the direction drawn is ours");
  });

  it("gives K6's verdicts for 1533 and 1940, and how a split was settled, once", () => {
    const html = page("bartzabel");
    expect(html).toContain("Our reading: it is the trace of");
    expect(html).toContain('data-departures="bartzabel-agrippa1533"');
    expect(html).toContain('data-departures="bartzabel-regardie1940"');
    // The row's note says the judges differed; the page does not say it twice.
    expect(html).toContain('data-judges="bartzabel-agrippa1533"');
    expect(html).not.toContain("The two judges differed");
    expect(page("agiel")).not.toContain("data-judges=");
    expect(page("schedbarschemoth-schartathan")).toContain(
      "it is not recognisably the trace of any spelling",
    );
    expect(page("malcha-betharsisim")).toContain(
      "in some words and at their ordinary values in others",
    );
    expect(html).toContain("Claude Opus 5.5 weighed both judges' reasons");
  });

  it("cites Regardie's plates by page and shows no figure of his", () => {
    for (const name of planetaryNamesWithPages()) {
      const character = characterOf(name, "regardie1940");
      if (!character) throw new Error(name.id);
      const leaf = Number(character.leaf.slice(1));
      const html = page(name.id);
      expect(html, name.id).toContain(`href="${regardie(leaf)}"`);
      expect(html, name.id).toContain(`page ${leaf + 6}</a>`);
      expect(html, name.id).toContain("neither shown nor redrawn");
      // Only 1533's figure is drawn, and no image of any page is shown.
      expect(html, name.id).not.toContain(`data-character="${character.id}"`);
      expect(html.match(/data-character=/g), name.id).toHaveLength(1);
      expect(html, name.id).not.toMatch(/<img/);
      // The method is Regardie's, not the Order's (plan 093, K4 review).
      expect(html, name.id).not.toContain("Golden Dawn's method");
      expect(html, name.id).toContain("by the method Regardie sets out");
    }
  });

  it("is the page each name's link names", () => {
    expect(planetaryNamePath(named("agiel"))).toBe(
      "/astrology/intelligence/agiel",
    );
    expect(page("agiel")).toContain(
      '"item":"https://magick.ly/astrology/kamea/saturn"',
    );
  });

  it("reads in Hebrew with no placeholder left as text", () => {
    for (const id of ["agiel", "bartzabel", "malcha-betharsisim"]) {
      const html = render(named(id), "he");
      expect(html, id).not.toMatch(/&lt;\/?\d/);
      expect(html, id).not.toMatch(/\{[a-z]+\}/);
    }
  });
});
