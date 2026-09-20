import "server-only";
import type { ReactElement } from "react";
import AstroGeomancyChart from "@/app/geomancy/reading/AstroGeomancyChart";
import { figuresFromMothers } from "@/app/geomancy/tetragrams";
import Tablet from "@/components/enochian/Tablet";
import { RoseSigilImage } from "@/components/gd/RoseSigil";
import {
  optimizeSigilPoints,
  sigilPoints,
} from "@/components/gd/roseSigilGeometry";
import SevenBranchedCandleStick, {
  CANDLESTICK_PLANETS,
} from "@/components/gd/SevenBranchedCandleStick";
import TableOfShewbread from "@/components/gd/TableOfShewbread";
import TreeOfLife from "@/components/kabbalah/TreeOfLife";
import type { ComponentImageProps, ComponentImageSlug } from "./contracts";
import { mothersFromString } from "./contracts/astroGeomancyChart";
import { TABLET_IDS } from "./contracts/enochianTablet";
import { TREE_IMAGE_FIELDS, TREE_PATHS } from "./contracts/treeOfLife";
import { type DataInputsSpec, resolvedInputsHash } from "./dataInputs";
import {
  COMPONENT_IMAGE_PROFILE,
  type ServerFontFile,
  TREE_IMAGE_PROFILE,
} from "./outlineTreeImage";

export interface ComponentImageRegistration<S extends ComponentImageSlug> {
  /** Trusted JSX for validated props; never caller-supplied markup. */
  render(props: ComponentImageProps<S>): ReactElement | Promise<ReactElement>;
  /** Outline identity profile the output is published under. */
  profile: string;
  /**
   * Every field of the data this component's render reads, resolved and
   * hashed into the image's identity (see [dataInputs.ts](./dataInputs.ts)).
   * It must cover what any reachable query can draw, not only the defaults.
   */
  inputs: DataInputsSpec;
  /** Mirror after outlining instead of relying on the component's CSS transform. */
  flip?(props: ComponentImageProps<S>): boolean;
  /** Server-only bundled fonts beyond the shared base set (see assets/fonts). */
  fonts?: readonly ServerFontFile[];
}

/**
 * The Tree prints any of the contract's fields as a label and reads six
 * colours per sephirah: the web colour and its text colour in either scale,
 * and Da'at's dashed outline. `id` and the path titles reach the source SVG
 * rather than the outlined bytes, and are hashed all the same.
 */
const TREE_INPUTS: DataInputsSpec = [
  {
    table: "sephirah",
    // Drawn by position — `Object.values(...)[0..10]` — so the key order counts.
    rows: "*",
    fields: [
      "id",
      "color.queenWeb",
      "color.queenWebText",
      "color.kingWeb",
      "color.kingWebText",
      "color.strokeColor",
      "color.strokeDasharray",
      ...TREE_IMAGE_FIELDS,
    ],
  },
  {
    table: "tolPath",
    rows: TREE_PATHS,
    fields: [
      "id",
      "hermetic.hebrewLetter.letter.he",
      "hebrew.hebrewLetter.letter.he",
      "hermetic.pathNo",
      "hermetic.tarotId",
    ],
  },
];

/**
 * The only components the image route can render. Each entry pairs a pure
 * contract with server-only rendering; slugs are object keys, never paths.
 */
export const COMPONENT_IMAGE_REGISTRY: {
  [S in ComponentImageSlug]: ComponentImageRegistration<S>;
} = {
  "tree-of-life": {
    render: (props) => <TreeOfLife {...props} flip={false} />,
    flip: (props) => props.flip,
    profile: TREE_IMAGE_PROFILE,
    inputs: TREE_INPUTS,
  },
  "astro-geomancy-chart": {
    render: (props) => (
      <AstroGeomancyChart
        tetragrams={figuresFromMothers(mothersFromString(props.mothers))}
      />
    ),
    profile: COMPONENT_IMAGE_PROFILE,
    // The reading's sixteen figures are matched by their rows, then drawn with
    // the symbol of each sign and planet they name; which rows those are is
    // itself data, so every row of both tables is hashed.
    inputs: [
      {
        table: "tetragram",
        rows: "*",
        fields: ["rows", "zodiacId", "planetIds"],
      },
      { table: "zodiac", rows: "*", fields: ["symbol"] },
      { table: "planet", rows: "*", fields: ["symbol"] },
    ],
  },
  "enochian-tablet": {
    // "Enochian" is the bundled TTF's family name; the page uses next/font's
    // generated family for the same glyphs.
    render: (props) => (
      <Tablet
        id={props.id}
        frame={false}
        enochianStyle={
          props.font === "enochian" ? { fontFamily: "Enochian" } : undefined
        }
      />
    ),
    profile: COMPONENT_IMAGE_PROFILE,
    fonts: ["EnochianPlain.ttf"],
    // The sigils are drawn in the component; only the letter grid is data.
    inputs: [{ table: "enochianTablet", rows: TABLET_IDS, fields: ["grid"] }],
  },
  "seven-branched-candlestick": {
    render: () => <SevenBranchedCandleStick />,
    profile: COMPONENT_IMAGE_PROFILE,
    inputs: [
      {
        table: "planet",
        rows: CANDLESTICK_PLANETS,
        fields: [
          "symbol",
          "archangel.name.he",
          "hebrewLetter.letter.he",
          "name.he.he",
        ],
      },
    ],
  },
  "table-of-shewbread": {
    render: () => <TableOfShewbread />,
    profile: COMPONENT_IMAGE_PROFILE,
    fonts: ["NotoEmoji-Variable.ttf"],
    // The signs are drawn by position, so their key order counts; the tribes
    // are reached through `tribeOfIsraelId`, so every tribe's name is hashed.
    inputs: [
      {
        table: "zodiac",
        rows: "*",
        fields: ["symbol", "tetragrammatonPermutation", "tribeOfIsraelId"],
      },
      { table: "tribeOfIsrael", rows: "*", fields: ["name.he"] },
    ],
  },
  "rose-sigil": {
    // The same bounded optimiser as the page, so the link reproduces the drawn sigil.
    render: async (props) => (
      <RoseSigilImage
        sigilText={props.text}
        showRose={props.rose}
        debug={false}
        points={await optimizeSigilPoints(sigilPoints(props.text))}
      />
    ),
    profile: COMPONENT_IMAGE_PROFILE,
    // The rose's letters are geometry, written out in roseSigilGeometry.ts;
    // this image reads no table, and no data edit can move its identity.
    inputs: [],
  },
};

const hashes = new Map<ComponentImageSlug, string>();

/**
 * The `inputs.sha256` a slug publishes under. The data is frozen for the life
 * of the process, so each spec is resolved once; a test that hashes mutated
 * data calls [resolvedInputsHash](./dataInputs.ts) with tables of its own.
 */
export function componentInputsHash(slug: ComponentImageSlug): string {
  let hash = hashes.get(slug);
  if (hash === undefined) {
    hash = resolvedInputsHash(COMPONENT_IMAGE_REGISTRY[slug].inputs);
    hashes.set(slug, hash);
  }
  return hash;
}
