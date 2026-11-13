import type { InkDrawing } from "@/drawings/Ink";
import {
  COMPONENT_EXAMPLES,
  type ComponentName,
} from "../../packages/magick-components/examples/index.ts";
import manifest from "../../packages/magick-components/package.json";

export { COMPONENT_EXAMPLES, type ComponentName };

/** Where the explorer lists the components (plan 080, decision 1). */
export const COMPONENTS_PATH = "/open-source/components";

/** What the app says about a component, beside what its JSDoc says. */
interface ComponentPage {
  /** What it draws, in words: "Tree of Life". The SEO title's subject. */
  title: string;
  /** The search snippet, 110 to 160 characters (`src/seo/pages.ts`). */
  description: string;
  /**
   * How the dark scheme shows the live drawing (plan 076, decision 4): an
   * `Ink` drawing re-inked, `plate` on a light card, or nothing, for a
   * drawing that brings its own ground (the kamea, the Moon, Mercury) or
   * inks itself with the theme (the fylfot cross).
   */
  dark?: InkDrawing | "plate";
}

const PAGES: Record<ComponentName, ComponentPage> = {
  TreeOfLife: {
    title: "Tree of Life",
    description:
      "A React component that draws the Kabbalistic Tree of Life from " +
      "magick-data: the sephirot in either colour scale, the paths and their " +
      "Hebrew letters.",
    dark: "tree",
  },
  GradeTree: {
    title: "Golden Dawn Grade Tree",
    description:
      "A React component that draws the Tree of Life as the map of the Golden " +
      "Dawn's grades, each sphere labelled with its grade and linked to its page.",
    dark: "tree",
  },
  GdHall: {
    title: "Golden Dawn Temple Hall",
    description:
      "A React component that draws a Golden Dawn temple hall as SVG: the " +
      "officers' stations, pillars, altar and banners, from fourteen preset halls.",
    dark: "plate",
  },
  Lamen: {
    title: "Golden Dawn Officer's Lamen",
    description:
      "A React component that draws the lamen of a Golden Dawn officer, from the " +
      "Hierophant to the Sentinel, the Chiefs and the adepts, as SVG.",
    dark: "lamen",
  },
  RoseSigil: {
    title: "Rose Cross Sigil",
    description:
      "A React component that draws the Rose Cross sigil of a Hebrew word or " +
      "name, traced through its letters on the rose and spread by an optimiser.",
    dark: "roseSigil",
  },
  SevenBranchedCandleStick: {
    title: "Seven-Branched Candlestick",
    description:
      "A React component that draws the Golden Dawn's seven-branched " +
      "candlestick: the planets' symbols, Hebrew names, archangels and letters.",
    dark: "candlestick",
  },
  TableOfShewbread: {
    title: "Table of Shewbread",
    description:
      "A React component that draws the Golden Dawn's Table of Shewbread: the " +
      "twelve signs with their permutations of the Name and the tribes of Israel.",
    dark: "shewbread",
  },
  FylfotCross: {
    title: "Fylfot Cross",
    description:
      "A React component that draws the Golden Dawn's fylfot cross of the " +
      "twelve signs, the four elements and the Sun, as a table of squares.",
  },
  Tablet: {
    title: "Enochian Tablet",
    description:
      "A React component that draws the four Enochian Watchtowers and the " +
      "Tablet of Union in the Golden Dawn's version, Dee's and others, as SVG.",
    dark: "plate",
  },
  Kamea: {
    title: "Planetary Kamea",
    description:
      "A React component that draws the kamea, or magic square, of any of the " +
      "seven planets from Saturn's three by three to the Moon's nine by nine.",
  },
  PlanetarySpirit: {
    title: "Planetary Spirit Sigil",
    description:
      "A React component that draws the geomantic sigils of the seven " +
      "planetary spirits, Zazel to Chasmodai, after Heydon's Theomagia (1663).",
    dark: "spirit",
  },
  Chakras: {
    title: "Chakras",
    description:
      "A React component that draws the seven chakras on a figure's " +
      "silhouette, from the root to the crown, any one of them highlighted.",
    dark: "chakras",
  },
  Moon: {
    title: "Moon Phase",
    description:
      "A React component that draws today's Moon as it looks from the viewer's " +
      "hemisphere, with the name of its phase, worked out in the browser.",
  },
  Mercury: {
    title: "Mercury Retrograde",
    description:
      "A React component that shows Mercury's current or next retrograde in " +
      "the reader's own date format, worked out in the browser on today's date.",
  },
};

/** One component as the explorer's pages present it. */
export interface ExplorerComponent extends ComponentPage {
  /** Its name, from its example module: `TreeOfLife`. */
  name: ComponentName;
  /** Its page's last segment: `tree-of-life`. */
  slug: string;
  /** Its page: `/open-source/components/tree-of-life`. */
  path: string;
  /** The package entry it is imported from: `magick-components/…`. */
  specifier: string;
  /** `default`, or the name it is exported by. */
  exportName: string;
  /** Its source file in the repository. */
  sourceFile: string;
  /** Its example module in the repository. */
  examplesFile: string;
}

/** Slugs that the words of a name would split where English does not. */
const SLUGS: Partial<Record<string, string>> = {
  SevenBranchedCandleStick: "seven-branched-candlestick",
};

/** `TreeOfLife` → `tree-of-life`: a URL's segment, as the site's are. */
export const componentSlug = (name: string) =>
  SLUGS[name] ?? name.replace(/(?<=[a-z])(?=[A-Z])/g, "-").toLowerCase();

/** Every component, in the examples' order. */
export const EXPLORER_COMPONENTS: readonly ExplorerComponent[] = (
  Object.keys(COMPONENT_EXAMPLES) as ComponentName[]
).map((name) => {
  const { entry, exportName } = COMPONENT_EXAMPLES[name];
  const slug = componentSlug(name);
  const source = (manifest.exports as Record<string, string>)[`./${entry}`];
  return {
    ...PAGES[name],
    name,
    slug,
    path: `${COMPONENTS_PATH}/${slug}`,
    specifier: `magick-components/${entry}`,
    exportName,
    sourceFile: `packages/magick-components/${source.replace(/^\.\//, "")}`,
    examplesFile: `packages/magick-components/examples/${name}.examples.tsx`,
  };
});

/** A component by its page's slug. */
export function explorerComponent(slug: string): ExplorerComponent | undefined {
  return EXPLORER_COMPONENTS.find((component) => component.slug === slug);
}

/** The line that imports it: `import TreeOfLife from "magick-components/…";` */
export function importLine(component: ExplorerComponent): string {
  const binding =
    component.exportName === "default"
      ? component.name
      : component.exportName === component.name
        ? `{ ${component.name} }`
        : `{ ${component.exportName} as ${component.name} }`;
  return `import ${binding} from "${component.specifier}";`;
}
