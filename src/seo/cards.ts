import type { ComponentImageSlug } from "@/render/contracts";
import { KAMEA_IMAGE_PLANETS } from "@/render/contracts/kamea";
import type { SocialImage } from "./pages";

export const CARD_SIZE = { width: 1200, height: 630 } as const;

/** The framed art area on the right of a card, in card pixels. */
export const CARD_ART_BOX = { width: 440, height: 510 } as const;

/** Card art: a raster or SVG file from the repository, or a closed diagram. */
export type CardArt =
  | {
      kind: "file";
      file: string;
      fit: "cover" | "contain";
      /** Which part of a cropped image to keep; the centre by default. */
      position?: "left" | "right" | "top" | "bottom";
    }
  | {
      kind: "diagram";
      slug: ComponentImageSlug;
      query?: string;
      /**
       * `"query"` when the query names its own size, for a contract with
       * fixed sizes (the halls refuse `height`); the card asks for its art
       * box's height otherwise.
       */
      raster?: "query";
    };

/** What a page's card shows; the route draws it at build time. */
export interface SocialCard {
  /** Catch-all segments of `/og/...`, ending in `.png`. */
  segments: string[];
  section: string;
  title: string;
  art: CardArt;
}

const file = (
  path: string,
  fit: "cover" | "contain" = "cover",
  position?: "left" | "right" | "top" | "bottom",
): CardArt => ({ kind: "file", file: path, fit, position });

const ART = {
  pentagram: file("public/pentagram.png", "contain"),
  astrology: file("src/app/img/astrology.jpeg"),
  planetaryHours: file("src/app/astrology/img/planetary-hours.webp"),
  // The Sun and the inner planets; a centre crop cuts a label in half.
  planets: file("public/pics/planets2013.jpg", "cover", "left"),
  chat: file("src/app/img/android-magician.png"),
  enochian: file("src/app/img/enochian-angel.webp"),
  enochianKey: file("src/app/enochian/img/enochianFirstKey.png"),
  goldenDawn: file("src/goldendawn-logo-squished.svg", "contain"),
  robes: file("public/pics/Anxfisa_Golden_Dawn_Robes.jpg"),
  geomancy: file("src/app/img/geomancy.webp"),
  geomancyReference: file("src/app/geomancy/img/reference.webp"),
  kabbalah: file("src/app/img/portae_lucis_upsampled.webp"),
  study: file("src/app/img/study.webp"),
  // The page's own defaults, which the Tree page links explicitly.
  tree: {
    kind: "diagram",
    slug: "tree-of-life",
    query: "field=name.roman&bottomText=name.en&fontSize=10",
  },
  tablet: { kind: "diagram", slug: "enochian-tablet" },
  candlestick: { kind: "diagram", slug: "seven-branched-candlestick" },
  shewbread: { kind: "diagram", slug: "table-of-shewbread" },
  // Page defaults only: shared readings and sigils never reach a card.
  geomancyChart: { kind: "diagram", slug: "astro-geomancy-chart" },
  sigil: { kind: "diagram", slug: "rose-sigil", query: "text=גדי" },
  // The generator's default: Agiel on Saturn's square.
  kameaSigil: {
    kind: "diagram",
    slug: "kamea-sigil",
    query: "planet=saturn&text=אגיאל",
  },
  // The Neophyte hall, at the full size the halls' contract draws.
  hall: { kind: "diagram", slug: "gd-hall", raster: "query" },
} satisfies Record<string, CardArt>;

/**
 * A kamea's card art: its own square (plan 093, K4), drawn through the
 * `kamea` contract as the page's static files are.
 */
export const kameaCardArt = (planet: string): CardArt => ({
  kind: "diagram",
  slug: "kamea",
  query: `planet=${planet}`,
});

/** Each kamea page's prefix and its square, as the sections list them. */
const KAMEA_SECTIONS = KAMEA_IMAGE_PLANETS.map(
  (planet): [string, string, CardArt] => [
    `/astrology/kamea/${planet}`,
    "Astrology",
    kameaCardArt(planet),
  ],
);

/** A temple hall's card art: its own drawing (plan 062). */
export const hallCardArt = (slug: string): CardArt => ({
  kind: "diagram",
  slug: "gd-hall",
  query: `hall=${slug}`,
  raster: "query",
});

/** Most specific prefix first; every path matches the final entry. */
const SECTIONS: [prefix: string, section: string, art: CardArt][] = [
  ["/astrology/planetary-hours", "Astrology", ART.planetaryHours],
  ["/astrology/kamea/sigils", "Astrology", ART.kameaSigil],
  ...KAMEA_SECTIONS,
  // The hub: the Sun's square, the middle of the seven.
  ["/astrology/kamea", "Astrology", kameaCardArt("sol")],
  ["/astrology/planet", "Astrology", ART.planets],
  ["/astrology", "Astrology", ART.astrology],
  ["/books", "Books", ART.kabbalah],
  ["/chat", "MagickGPT", ART.chat],
  ["/enochian/keys", "Enochian Magick", ART.enochianKey],
  ["/enochian/tablets", "Enochian Magick", ART.tablet],
  ["/enochian", "Enochian Magick", ART.enochian],
  ["/doc", "Golden Dawn Rituals", ART.robes],
  ["/gd/rituals", "Golden Dawn", ART.robes],
  ["/gd/halls", "Golden Dawn", ART.hall],
  ["/gd/sigils", "Golden Dawn", ART.sigil],
  ["/gd/symbols/shewbread", "Golden Dawn", ART.shewbread],
  ["/gd/symbols/fylfot-cross", "Golden Dawn", ART.goldenDawn],
  ["/gd/symbols", "Golden Dawn", ART.candlestick],
  ["/gd", "Golden Dawn", ART.goldenDawn],
  ["/geomancy/reading", "Geomancy", ART.geomancyChart],
  ["/geomancy/reference", "Geomancy", ART.geomancyReference],
  ["/geomancy", "Geomancy", ART.geomancy],
  ["/kabbalah/angel", "Kabbalah", ART.kabbalah],
  ["/kabbalah/tree", "Kabbalah", ART.tree],
  ["/kabbalah/sephirah", "Kabbalah", ART.tree],
  ["/kabbalah/path", "Kabbalah", ART.tree],
  ["/kabbalah", "Kabbalah", ART.kabbalah],
  // The Tree is drawn by the components from the data: both packages at once.
  ["/open-source", "Open source", ART.tree],
  ["/study", "Flashcards", ART.study],
  ["/", "Magick.ly", ART.pentagram],
];

function matches(path: string, prefix: string) {
  return prefix === "/" || path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * The image request a diagram's card art is drawn from: its query, as a
 * PNG, at twice the art box's height unless the query names its own size
 * (`raster: "query"`), which the drawing then shrinks to the box. The
 * request must pass its contract's `parse`, as `cards.test.ts` holds for
 * every card.
 */
export function cardArtRequest(
  art: Extract<CardArt, { kind: "diagram" }>,
): URLSearchParams {
  const params = new URLSearchParams(art.query);
  params.set("fmt", "png");
  if (art.raster !== "query")
    params.set("height", String(CARD_ART_BOX.height * 2));
  return params;
}

/** The card for an indexable path and its page title. */
export function socialCard(
  path: string,
  title: string,
  ownArt?: CardArt,
): SocialCard {
  const [, section, sectionArt] = SECTIONS.find(([prefix]) =>
    matches(path, prefix),
  ) as (typeof SECTIONS)[number];
  const art = ownArt ?? sectionArt;
  const segments = path === "/" ? ["home"] : path.slice(1).split("/");
  segments.push(`${segments.pop()}.png`);
  return {
    segments,
    section,
    // The home page's title already names the site, which the card shows.
    title: path === "/" ? "Open Source Magick Reference and Tools" : title,
    art,
  };
}

/** The `og:image` entry for a page's card. */
export function socialCardImage(path: string, title: string): SocialImage {
  return {
    url: `/og/${socialCard(path, title).segments.join("/")}`,
    ...CARD_SIZE,
    alt: title,
  };
}
