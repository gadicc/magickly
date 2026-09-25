import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Data from "@/../data/data";
import { publicRitualQueryKeys } from "@/doc/publicRituals";
import {
  expectEntityPage,
  hrefsOf,
  textOf,
} from "../../../../../tests/entityPage";
import Grade from "./page";

/**
 * The grade page (plan 036, "Grade"), rendered through its route for every
 * grade, as the route test renders a page.
 *
 * Each page is held to what every entity page must hold, and the cases
 * below pin what a reader sees on the grades whose rows differ: the one
 * with no sephirah and a ritual, the one that teaches alchemy, the plan's
 * own example, the one in no order, one of the Second Order, and the last. The built-in rituals are
 * found by the grade's name (decision 6), and that mapping is held both
 * ways: each ritual names one grade, and only those grades link one.
 */
const props = (id: string) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve({}),
});

const grades = Object.values(Data.gdGrade);

const rendered = new Map<string, Promise<string>>();

/** The route's markup for a grade, rendered once per run. */
function page(id: string) {
  let html = rendered.get(id);
  if (!html) {
    html = Grade(props(id)).then((element) => renderToString(element));
    rendered.set(id, html);
  }
  return html;
}

/** The heading the brief gives: "Theoricus 2=9", and the Portal's name. */
const heading = (grade: (typeof grades)[number]) =>
  grade.id.includes("=") ? `${grade.name} ${grade.id}` : grade.name;

/** The table's rows, label to the value's markup, in the page's order. */
function rowsOf(html: string) {
  return new Map(
    [
      ...html.matchAll(
        /<tr><th scope="row">([\s\S]*?)<\/th><td>([\s\S]*?)<\/td><\/tr>/g,
      ),
    ].map(([, label, value]) => [textOf(label).trim(), value]),
  );
}

/** A row's value as the reader sees it, or undefined where it is absent. */
function rowText(html: string, label: string) {
  const value = rowsOf(html).get(label);
  return value === undefined ? undefined : textOf(value).trim();
}

/** The opacity each sphere of the Tree is drawn at, read off its circle. */
function sphereOpacities(html: string) {
  const tree = html.match(/<svg\b[^>]*\bid="TreeOfLife"[\s\S]*?<\/svg>/)?.[0];
  return [...(tree ?? "").matchAll(/<circle\b[^>]*\br="40"[^>]*>/g)].map(
    ([circle]) => circle.match(/\sopacity="([^"]*)"/)?.[1],
  );
}

/** The named nav that closes the page: its links and its text. */
function navOf(html: string) {
  const nav =
    html.match(/<nav\b[^>]*aria-label="Grades"[^>]*>[\s\S]*?<\/nav>/)?.[0] ??
    "";
  return { hrefs: hrefsOf(nav), text: textOf(nav).trim() };
}

describe("every grade's page", () => {
  it("holds each to what every entity page must hold", async () => {
    for (const grade of grades)
      expectEntityPage(await page(grade.id), heading(grade));
  });

  it("names its neighbours in the arrows and the nav", async () => {
    for (const grade of grades) {
      const html = await page(grade.id);
      const around = [grade.prev, grade.next].filter((g) => g !== undefined);
      expect(navOf(html).hrefs, grade.id).toEqual(
        around.map((g) => `/gd/grade/${g.id}`),
      );
      for (const g of around) expect(navOf(html).text).toContain(heading(g));
      if (grade.prev)
        expect(html).toContain(`aria-label="Previous: ${heading(grade.prev)}"`);
      if (grade.next)
        expect(html).toContain(`aria-label="Next: ${heading(grade.next)}"`);
    }
  });

  it("never prints the placeholder the dump drew for a missing sephirah", async () => {
    // Neophyte and the Portal printed "(no sephirah)" where the tree goes.
    for (const grade of grades) {
      const html = await page(grade.id);
      expect(html, grade.id).not.toContain("(no sephirah)");
    }
  });

  it("gives an Alchemy row to the Zelator alone", async () => {
    // The alchemy tables number the grade that teaches each entry, and only
    // 1=10 teaches any; a row anywhere else would be a mismatched number.
    const withAlchemy: string[] = [];
    for (const grade of grades)
      if (rowsOf(await page(grade.id)).has("Alchemy"))
        withAlchemy.push(grade.id);
    expect(withAlchemy).toEqual(["1=10"]);
  });
});

describe("the built-in rituals", () => {
  it("are each the lower-cased name of exactly one grade", () => {
    for (const ritual of Object.keys(publicRitualQueryKeys))
      expect(
        grades.filter((grade) => grade.name.toLowerCase() === ritual),
        ritual,
      ).toHaveLength(1);
  });

  it("are linked from exactly those grades' pages", async () => {
    const links: Array<[string, string]> = [];
    for (const grade of grades)
      for (const href of hrefsOf(await page(grade.id)))
        if (href.startsWith("/doc/")) links.push([grade.id, href]);
    expect(links).toEqual([
      ["0=0", "/doc/neophyte"],
      ["1=10", "/doc/zelator"],
      ["2=9", "/doc/theoricus"],
    ]);
  });
});

describe("what a reader sees", () => {
  it("Neophyte: no sphere, every sphere dimmed, and its ritual", async () => {
    // The first grade has no sephirah, planet or element in the data, which
    // is where the old page printed "(no sephirah)"; the Tree lights every
    // sphere when `active` names none, so this is where dimming could fail.
    const html = await page("0=0");
    expect([...rowsOf(html).keys()]).toEqual(["Order", "Degree", "Ritual"]);
    expect(rowText(html, "Order")).toBe("First Order");
    expect(rowText(html, "Degree")).toBe("First Degree · Pillar of Severity");
    expect(rowText(html, "Ritual")).toBe("Neophyte 0=0 Ritual");
    expect(hrefsOf(rowsOf(html).get("Ritual") ?? "")).toEqual([
      "/doc/neophyte",
    ]);
    expect(textOf(html)).toContain(
      "A grade of the First Order, not attributed to a Sephirah.",
    );

    const spheres = sphereOpacities(html);
    expect(spheres).toHaveLength(10);
    expect(spheres.filter((opacity) => opacity !== "0.1")).toEqual([]);
  });

  it("Zelator: Malchut lit, Earth, the Gnomes, and the alchemy it teaches", async () => {
    // The one grade with an Alchemy row, and the first whose element names
    // its elementals. Its Tree is the contrast to Neophyte's: one sphere lit,
    // Malchut, and the other nine dimmed.
    const html = await page("1=10");
    expect(rowText(html, "Sephirah")).toBe("Malchut");
    expect(hrefsOf(rowsOf(html).get("Sephirah") ?? "")).toEqual([
      "/kabbalah/sephirah/malchut",
    ]);
    expect(rowText(html, "Planet")).toBe("♁ Earth");
    expect(rowText(html, "Element")).toBe("🜃 Earth · the Gnomes");
    expect(rowText(html, "Ritual")).toBe("Zelator 1=10 Ritual");
    expect(sphereOpacities(html).filter((o) => o === "1")).toHaveLength(1);
    expect(sphereOpacities(html).filter((o) => o === "0.1")).toHaveLength(9);

    const alchemy = rowsOf(html).get("Alchemy") ?? "";
    const entries = [...alchemy.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g)].map(
      ([item]) => item,
    );
    const entry = (name: string) =>
      entries.find((item) => textOf(item).includes(name)) ?? "";
    // Lead is Saturn's metal, the first of the seven; the Green Lion is a
    // term, so between them they cover both halves of the row.
    expect(textOf(entry("Lead"))).toContain("🜪 Lead · ♄ Saturn");
    expect(hrefsOf(entry("Lead"))).toEqual(["/astrology/planet/saturn"]);
    expect(textOf(entry("Green Lion"))).toContain(
      "Green Lion — Stem and Root of Radical Essence of Metals",
    );

    // And nothing the tables file under the Zelator is left out: the ten
    // symbols by symbol and name, each metal linking to its planet, and the
    // six terms with each of their glosses.
    const symbols = Object.values(Data.alchemySymbol).filter(
      (symbol) => symbol.gdGrade === 1,
    );
    const terms = Object.values(Data.alchemyTerm).filter(
      (term) => term.gdGrade === 1,
    );
    expect([symbols.length, terms.length]).toEqual([10, 6]);
    for (const symbol of symbols) {
      const named = `${symbol.symbol} ${symbol.name.en}`;
      expect(textOf(entry(named)), symbol.id).toContain(named);
      expect(hrefsOf(entry(named)), symbol.id).toEqual(
        symbol.planet ? [`/astrology/planet/${symbol.planet.id}`] : [],
      );
    }
    for (const term of terms) {
      expect(textOf(entry(term.name.en)), term.id).toContain(
        `${term.name.en} — ${term.terms.en.join("; ")}`,
      );
    }
  });

  it("Theoricus: the plan's own example, lede and neighbours", async () => {
    // The page plan 036 sketches, so its sentence and its labels are pinned
    // as the owner approved them.
    const html = await page("2=9");
    expect(textOf(html)).toContain(
      "A grade of the First Order, attributed to Yesod.",
    );
    expect(rowText(html, "Planet")).toBe("☾ Luna");
    expect(rowText(html, "Element")).toBe("🜁 Air · the Sylphs");
    expect(rowText(html, "Ritual")).toBe("Theoricus 2=9 Ritual");
    expect(navOf(html).hrefs).toEqual(["/gd/grade/1=10", "/gd/grade/3=8"]);
    expect(navOf(html).text).toContain("← Zelator 1=10");
    expect(navOf(html).text).toContain("Practicus 3=8 →");
  });

  it("the Portal: no order, sephirah or ritual, between the Orders", async () => {
    // The one grade outside the three orders, with the element Spirit, which
    // has no elementals; the other grade with no sephirah, so dimmed too.
    const html = await page("portal");
    expect([...rowsOf(html).keys()]).toEqual(["Degree", "Element"]);
    expect(rowText(html, "Degree")).toBe("Second Degree · Pillar of Mercy");
    expect(rowText(html, "Element")).toBe("☸ Spirit");
    expect(textOf(html)).toContain(
      "The grade that stands between the First and Second Orders.",
    );
    expect(sphereOpacities(html).filter((o) => o !== "0.1")).toEqual([]);
  });

  it("Adeptus Minor: the Second Order, on the Middle Pillar", async () => {
    // The first grade past the Portal: a new order and the third degree,
    // whose pillar is the middle one, and Tiferet with the Sun.
    const html = await page("5=6");
    expect(rowText(html, "Order")).toBe("Second Order");
    expect(rowText(html, "Degree")).toBe("Third Degree · Middle Pillar");
    expect(rowText(html, "Sephirah")).toBe("Tiferet");
    expect(rowText(html, "Planet")).toBe("☉ Sol");
    expect(hrefsOf(rowsOf(html).get("Planet") ?? "")).toEqual([
      "/astrology/planet/sol",
    ]);
    expect(rowsOf(html).has("Element")).toBe(false);
  });

  it("Ipsissimus: no degree, Keter, and no next grade", async () => {
    // The last of the chain, and of the Third Order, which the degrees do
    // not group: only an order and a sephirah are left in its row.
    const html = await page("10=1");
    expect([...rowsOf(html).keys()]).toEqual(["Order", "Sephirah"]);
    expect(rowText(html, "Order")).toBe("Third Order");
    expect(rowText(html, "Sephirah")).toBe("Keter");
    expect(html).not.toContain('aria-label="Next: ');
    expect(navOf(html)).toEqual({
      hrefs: ["/gd/grade/9=2"],
      text: "← Magus 9=2",
    });
  });
});
