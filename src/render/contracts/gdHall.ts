import { SITE_URL } from "@/seo/site";
import {
  type ComponentImageContract,
  choice,
  type ImageDimensions,
  invalid,
} from "./types";

/**
 * The published temple halls (plan 062): each preset's public slug, the
 * words its title adds, and the viewBox its image draws in. This table is
 * the one place a slug is written; `src/seo/halls.ts` builds the pages on
 * it. **A published slug never changes**: a renamed preset changes
 * `preset`, and a withdrawn hall gets a permanent redirect, never a reused
 * slug.
 *
 * The viewBoxes are what `GdHallSvg` writes in image mode (its bounds
 * rounded outward to whole units), written out so that the contracts,
 * which client code imports, do not pull in the halls; a test holds the
 * two equal.
 */
export const GD_HALLS = [
  {
    preset: "neophyte",
    slug: "neophyte",
    grade: "Neophyte",
    number: "0=0",
    gradeId: "0=0",
    part: "",
    viewBox: [-152, -521, 1904, 2531],
  },
  {
    preset: "zelator1",
    slug: "zelator-1",
    grade: "Zelator",
    number: "1=10",
    gradeId: "1=10",
    part: ", part 1",
    viewBox: [-152, -918, 1904, 2776],
  },
  {
    preset: "zelator2",
    slug: "zelator-2",
    grade: "Zelator",
    number: "1=10",
    gradeId: "1=10",
    part: ", part 2",
    viewBox: [-152, -918, 1904, 2776],
  },
  {
    preset: "theoricus1",
    slug: "theoricus-1",
    grade: "Theoricus",
    number: "2=9",
    gradeId: "2=9",
    part: ", 32nd path",
    viewBox: [-152, -918, 1904, 2776],
  },
  {
    preset: "theoricus2",
    slug: "theoricus-2",
    grade: "Theoricus",
    number: "2=9",
    gradeId: "2=9",
    part: " in Yesod",
    viewBox: [-152, -918, 1904, 3072],
  },
  {
    preset: "practicus1",
    slug: "practicus-1",
    grade: "Practicus",
    number: "3=8",
    gradeId: "3=8",
    part: ", 31st path",
    viewBox: [-152, -818, 1904, 2676],
  },
  {
    preset: "practicus2",
    slug: "practicus-2",
    grade: "Practicus",
    number: "3=8",
    gradeId: "3=8",
    part: ", 30th path",
    viewBox: [-152, -818, 1904, 2676],
  },
  {
    preset: "practicus3",
    slug: "practicus-3",
    grade: "Practicus",
    number: "3=8",
    gradeId: "3=8",
    part: " in Hod",
    viewBox: [-152, -818, 2224, 2972],
  },
  {
    preset: "philosophus1",
    slug: "philosophus-1",
    grade: "Philosophus",
    number: "4=7",
    gradeId: "4=7",
    part: ", 29th path",
    viewBox: [-198, -818, 1996, 2676],
  },
  {
    preset: "philosophus2",
    slug: "philosophus-2",
    grade: "Philosophus",
    number: "4=7",
    gradeId: "4=7",
    part: ", 28th path",
    viewBox: [-198, -818, 1996, 2676],
  },
  {
    preset: "philosophus3",
    slug: "philosophus-3",
    grade: "Philosophus",
    number: "4=7",
    gradeId: "4=7",
    part: ", 27th path",
    viewBox: [-152, -818, 2224, 2972],
  },
  {
    preset: "philosophus4",
    slug: "philosophus-4",
    grade: "Philosophus",
    number: "4=7",
    gradeId: "4=7",
    part: " in Netzach",
    viewBox: [-472, -818, 2224, 2972],
  },
  {
    preset: "portal1",
    slug: "portal-1",
    grade: "Portal",
    number: "",
    gradeId: "portal",
    part: ", part 1",
    viewBox: [-152, -797, 1904, 2655],
  },
  {
    preset: "portal2",
    slug: "portal-2",
    grade: "Portal",
    number: "",
    gradeId: "portal",
    part: ", part 2",
    viewBox: [-152, -621, 1904, 2775],
  },
] as const satisfies readonly GdHallEntry[];

/** One published hall. */
export interface GdHallEntry {
  /** The preset's id in `HALL_PRESETS`. */
  preset: string;
  /** Its public slug: `/gd/halls/<slug>`. */
  slug: string;
  /** The grade's name, as titles write it. */
  grade: string;
  /** The grade's number (`1=10`); empty for the Portal. */
  number: string;
  /** The grade's id in magick-data's `gdGrade`. */
  gradeId: string;
  /** What the title adds after "Temple": ", part 1", ", 32nd path", " in Hod". */
  part: string;
  viewBox: readonly [number, number, number, number];
}

export type GdHallSlug = (typeof GD_HALLS)[number]["slug"];

export const GD_HALL_SLUGS: readonly GdHallSlug[] = GD_HALLS.map(
  (hall) => hall.slug,
);

/**
 * Names no hall may take as its slug: the static pages beside
 * `/gd/halls/[slug]` (plan 062's amendment, A2). Next matches a static
 * segment first, so a hall slugged `editor` could never be reached; add
 * a name here before adding a page under `/gd/halls`.
 */
export const GD_HALL_RESERVED_SLUGS: readonly string[] = ["editor"];

/** Where a hall's page is: `/gd/halls/<slug>`. */
export const gdHallPagePath = (slug: string) => `/gd/halls/${slug}`;

/** A published hall by slug; `undefined` for any other string. */
export function gdHall(slug: string): GdHallEntry | undefined {
  return GD_HALLS.find((hall) => hall.slug === slug);
}

/**
 * The licence the halls' images are published under (Gadi, 26 October
 * 2026): the one source of the URL, credit and notice the files, the
 * pages' JSON-LD and the editor's exports state.
 */
export const GD_HALL_LICENCE = {
  url: "https://creativecommons.org/licenses/by/4.0/",
  name: "CC BY 4.0",
  creator: "Magick.ly",
  creditText: "Magick.ly, CC BY 4.0",
  copyrightNotice: "© 2026 Magick.ly. Licensed under CC BY 4.0",
  acquireLicensePage: `${SITE_URL}/about#licence`,
} as const;

/** "Zelator Temple, part 1": the gallery's, cards' and trail's name. */
export function gdHallShortName(hall: GdHallEntry): string {
  return `${hall.grade} Temple${hall.part}`;
}

/** "Golden Dawn Zelator Temple, part 1 (1=10): floor plan": title and H1. */
export function gdHallTitle(hall: GdHallEntry): string {
  const number = hall.number ? ` (${hall.number})` : "";
  return `Golden Dawn ${gdHallShortName(hall)}${number}: floor plan`;
}

/** The image files' name without size or extension. */
export function gdHallFileBase(hall: GdHallEntry): string {
  return `golden-dawn-${hall.slug}-temple`;
}

/**
 * PNG widths: the full image, the phones' `srcset` size and the gallery's
 * thumbnail (180 CSS px at 2×). The full width keeps the tallest hall
 * (Theoricus 2, 1,500 × 2,420) inside the route's pixel limit.
 */
export const GD_HALL_WIDTHS = { full: 1500, medium: 750, small: 360 } as const;

export const GD_HALL_SIZES = ["medium", "small"] as const;
export type GdHallSize = (typeof GD_HALL_SIZES)[number];

export interface GdHallImageProps extends ImageDimensions {
  hall: GdHallSlug;
  /** A smaller PNG; the full image when absent. */
  size?: GdHallSize;
}

/** The pixel size an image of these props is drawn at. */
export function gdHallPixels(props: GdHallImageProps): {
  width: number;
  height: number;
} {
  const [, , boxWidth, boxHeight] = (gdHall(props.hall) as GdHallEntry).viewBox;
  const width = GD_HALL_WIDTHS[props.size ?? "full"];
  return { width, height: Math.round((width * boxHeight) / boxWidth) };
}

/**
 * A published hall's image. Its sizes are fixed, so the route answers at
 * most 56 distinct requests (fourteen SVGs and three PNGs of each hall)
 * and varied queries cannot each cost a render: `width` and `height` are
 * refused, and so is a `size` on an SVG, which has one.
 */
export const gdHallImage: ComponentImageContract<GdHallImageProps> = {
  slug: "gd-hall",
  viewBox: GD_HALLS[0].viewBox,
  viewBoxOf: (props) => (gdHall(props.hall) as GdHallEntry).viewBox,
  rasterDefault: null,
  keys: ["hall", "size"],
  personal: false,
  // The canonical copies are the static files under /gd/halls/<slug>.
  indexed: false,
  parse(searchParams) {
    if (searchParams.has("width") || searchParams.has("height")) invalid();
    const hall = choice(
      searchParams.get("hall") || "neophyte",
      GD_HALL_SLUGS,
    ) as GdHallSlug;
    const size = searchParams.get("size");
    if (size === null) return { hall };
    if ((searchParams.get("fmt") || "svg") !== "png") invalid();
    return { hall, size: choice(size, GD_HALL_SIZES) };
  },
  canonicalize(props) {
    const pairs: Array<[string, string]> = [];
    if (props.hall !== "neophyte") pairs.push(["hall", props.hall]);
    if (props.size) pairs.push(["size", props.size]);
    return pairs;
  },
  filename: (props) =>
    `${gdHallFileBase(gdHall(props.hall) as GdHallEntry)}${props.size ? `-${props.size}` : ""}`,
};
