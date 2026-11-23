import "server-only";
import Kamea from "magick-components/astrology/Kamea";
import { KameaSigilImage } from "magick-components/astrology/KameaSigil";
import Tablet from "magick-components/enochian/Tablet";
import { RoseSigilImage } from "magick-components/gd/RoseSigilImage";
import SevenBranchedCandlestick, {
  CANDLESTICK_PLANETS,
} from "magick-components/gd/SevenBranchedCandlestick";
import TableOfShewbread from "magick-components/gd/TableOfShewbread";
import { TreeOfLifeSvg } from "magick-components/kabbalah/TreeOfLife";
import type { ReactElement } from "react";
import AstroGeomancyChart from "@/app/geomancy/reading/AstroGeomancyChart";
import { figuresFromMothers } from "@/app/geomancy/tetragrams";
import { pathHref, sephirahHref } from "@/app/kabbalah/treeLinks";
import {
  ANGEL_SIGIL_FONTS,
  ANGEL_SIGIL_IMAGE_PROFILE,
  ANGEL_SIGIL_INPUTS,
  bareAngelSigilRoot,
  renderAngelSigilImage,
} from "./angelSigilImage";
import type { ComponentImageProps, ComponentImageSlug } from "./contracts";
import { mothersFromString } from "./contracts/astroGeomancyChart";
import { TABLET_IDS } from "./contracts/enochianTablet";
import { KAMEA_IMAGE_PLANETS } from "./contracts/kamea";
import { TREE_IMAGE_FIELDS, TREE_PATHS } from "./contracts/treeOfLife";
import { type DataInputsSpec, resolvedInputsHash } from "./dataInputs";
import {
  bareHallFonts,
  compactHallSvg,
  finishGdHallImage,
  GD_HALL_IMAGE_PROFILE,
  renderGdHallImage,
} from "./gdHallImage";
import {
  COMPONENT_IMAGE_PROFILE,
  type ServerFontFile,
  TREE_IMAGE_PROFILE,
} from "./outlineTreeImage";

/**
 * The renderer's identity for the rose sigil's images; moves only when the
 * drawing does. Until plan 088 the sigil was drawn through COBYLA's points
 * and published under the shared `COMPONENT_IMAGE_PROFILE`; v1 is the
 * sigil planned and placed by rule, with each word its own sigil.
 */
export const ROSE_SIGIL_IMAGE_PROFILE = "magickli-rose-sigil-image-v1";

/**
 * The renderer's identity for the bare kameas (plan 093): the square, its
 * rules and its numbers in Noto Serif italic, outlined. It moves only when
 * the drawing does; the numbers are inputs (`KAMEA_INPUTS`).
 */
export const KAMEA_IMAGE_PROFILE = "magickli-kamea-image-v1";

/**
 * The renderer's identity for a name's sigil on its kamea (plan 093, K3):
 * the square under each word's figure, placed by the rose's rules under
 * `KAMEA_SIGIL_PROFILE`. The engine is code, so this moves when a figure
 * does; the squares' numbers and the planets' names are inputs.
 */
export const KAMEA_SIGIL_IMAGE_PROFILE = "magickli-kamea-sigil-image-v1";

export { ANGEL_SIGIL_IMAGE_PROFILE };

/**
 * The response header a kamea sigil carries when placement could not draw
 * a word of it with every mark clear: the image is drawn best effort, as
 * the generator draws it, and may be hard to read.
 */
export const SIGIL_PLACEMENT_HEADER = "X-Sigil-Placement";

/**
 * `KameaSigilImage`'s mark on its root for a figure drawn best effort,
 * which the route turns into its header and strips from the bytes.
 */
const PLACEMENT_FAILED = /^(<svg\b[^>]*?) data-placement="failed"/;

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
  /**
   * Rewrites the rendered markup before outlining; part of the recorded
   * source digest (the halls name their fonts as resvg resolves them).
   */
  source?(svg: string): string;
  /** Keep the local paint servers (see `outlineComponentImage`). */
  paintServers?: { idPrefix: string };
  /** Rewrites the outlined SVG before any PNG is drawn from it. */
  outlined?(svg: Buffer): Buffer;
  /** Quantise PNGs to a palette (libimagequant), as the social cards do. */
  palette?: boolean;
  /**
   * Response headers read from the rendered markup, before `source`
   * rewrites it: what the image cannot say in its bytes (a sigil drawn
   * best effort). Only `X-` names, which the route sets beneath its own,
   * so a registration cannot change the type, caching or disposition.
   */
  headers?(markup: string): Readonly<Record<`X-${string}`, string>>;
  /**
   * The final bytes of either format, after encoding: the halls' licence
   * metadata. Nothing re-encodes after it.
   */
  finish?(
    bytes: Buffer,
    format: "svg" | "png",
    props: ComponentImageProps<S>,
  ): Buffer;
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
    table: "treeOfLifePath",
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
 * Both versions' lamps: the planets in the default's order, with the
 * planetary angels the modern one draws, and the archangels of the
 * planets' sephirot, which the 1909 figure draws. The component finds
 * each sephirah by its planet, so every sephirah's planet is read; the
 * archangels only of the seven it finds, so that Metatron's name, say,
 * moves only the Tree.
 */
const CANDLESTICK_INPUTS: DataInputsSpec = [
  {
    table: "planet",
    rows: CANDLESTICK_PLANETS.equinox1909,
    fields: [
      "symbol",
      "archangel.name.he",
      "hebrewLetter.letter.he",
      "name.he.he",
    ],
  },
  { table: "sephirah", rows: "*", fields: ["planetId"] },
  {
    table: "sephirah",
    rows: ["binah", "gevurah", "netzach", "yesod", "hesed", "tiferet", "hod"],
    fields: ["archangel.name.he"],
  },
];

/**
 * The signs are drawn by position, so their key order counts. Each sign's
 * tribe is read through its link, as the component reads it, so only the
 * twelve tribes the signs name are hashed: Levi and Joseph, whom no sign
 * names and the table never draws, are not (plan 052). The four
 * archangels of the quarters are drawn by name.
 */
const SHEWBREAD_INPUTS: DataInputsSpec = [
  {
    table: "zodiac",
    rows: "*",
    fields: ["symbol", "tetragrammatonPermutation", "tribeOfIsrael.name.he"],
  },
  {
    table: "archangel",
    rows: ["raphael", "michael", "gabriel", "uriel"],
    fields: ["name.he"],
  },
];

/**
 * What a kamea's image draws from the data: the square's numbers, which
 * magick-data computes, and the planet's English name, in the image's
 * accessible name ("Kamea of Saturn", "Sigil of … on the Kamea of Luna").
 * Every planet's, since any of the seven can be asked for.
 */
const KAMEA_INPUTS: DataInputsSpec = [
  { table: "kamea", rows: KAMEA_IMAGE_PLANETS, fields: ["cells"] },
  { table: "planet", rows: KAMEA_IMAGE_PLANETS, fields: ["name.en.en"] },
];

/**
 * The bundled face resvg resolves for the squares' italic numbers: the
 * temple halls' Noto Serif italic, which draws their kameas too.
 */
const KAMEA_FONT_FAMILY = "Noto Serif";

/**
 * The only components the image route can render. Each entry pairs a pure
 * contract with server-only rendering; slugs are object keys, never paths.
 */
export const COMPONENT_IMAGE_REGISTRY: {
  [S in ComponentImageSlug]: ComponentImageRegistration<S>;
} = {
  "tree-of-life": {
    // The Tree without hooks, since a route handler's renderToStaticMarkup
    // runs outside the dispatcher useId needs, and with the root id the
    // Tree always had, so that published images keep their bytes under
    // the unchanged profile (plan 080, "Before publishing"); every other
    // id is stripped from the outlines. The query's `active` is the Tree's
    // `activeSephirah`, and the links are the ones the Tree drew by default
    // before it drew none, which the source SVG has always carried. Its
    // root declares the xlink prefix itself (plan 080, "After the review").
    render: ({ active, ...props }) => (
      <TreeOfLifeSvg
        {...props}
        // The API sized `name.roman` labels at 12 before the Tree's own
        // default became the page's 10; its links keep their bytes.
        fontSize={
          props.fontSize ?? (props.field === "name.roman" ? 12 : undefined)
        }
        activeSephirah={active}
        sephirahHref={sephirahHref}
        pathHref={pathHref}
        flip={false}
        id="TreeOfLife"
      />
    ),
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
        tablet={props.id}
        version={props.version}
        // A page that shows the image gives it its own alt text.
        label={false}
        enochianStyle={
          props.font === "enochian" ? { fontFamily: "Enochian" } : undefined
        }
      />
    ),
    // `label={false}` marks the drawing decorative, `aria-hidden`, which
    // the published images' root never carried; they keep their bytes.
    source: (svg) => svg.replace(/^(<svg\b[^>]*?) aria-hidden="true"/, "$1"),
    profile: COMPONENT_IMAGE_PROFILE,
    fonts: ["EnochianPlain.ttf"],
    // The sigils are drawn in the component; the letters, which of them are
    // reversed, and the kind that chooses the page are data: every
    // source's reading, since a version is a rule over several (the Golden
    // Dawn's takes Regardie's letters, the Equinox's reversed ones and
    // its `choices`). A field path cannot select inside an object of
    // readings by version, so they are hashed whole, the letters no image
    // draws too: correcting one re-identifies the image without moving a
    // byte, the safe direction.
    inputs: [
      {
        table: "enochianTablet",
        rows: TABLET_IDS,
        fields: ["kind", "readings", "choices"],
      },
      // How a version is read from them, and the revision of the code
      // that reads it: a rule's change moves the bytes too.
      {
        table: "enochianTabletVersion",
        rows: "*",
        fields: ["revision", "base", "choices", "variants", "reversedFrom"],
      },
    ],
  },
  "seven-branched-candlestick": {
    render: (props) => <SevenBranchedCandlestick version={props.version} />,
    profile: COMPONENT_IMAGE_PROFILE,
    inputs: CANDLESTICK_INPUTS,
  },
  "table-of-shewbread": {
    render: () => <TableOfShewbread />,
    profile: COMPONENT_IMAGE_PROFILE,
    fonts: ["NotoEmoji-Variable.ttf"],
    inputs: SHEWBREAD_INPUTS,
  },
  "rose-sigil": {
    // Planned and placed by rule (plan 088), as the page draws it, so the
    // link reproduces the drawn sigil; each word its own sigil.
    render: (props) => (
      <RoseSigilImage
        text={props.text}
        showRose={props.rose}
        version={props.version}
      />
    ),
    profile: ROSE_SIGIL_IMAGE_PROFILE,
    // The rose's letters are geometry, written out in roseSigilGeometry.ts
    // for each version; this image reads no table, and no data edit can
    // move its identity. The drawing's rules are code, so the profile
    // moves when they do.
    inputs: [],
  },
  kamea: {
    render: (props) => (
      <Kamea planet={props.planet} fontFamily={KAMEA_FONT_FAMILY} />
    ),
    profile: KAMEA_IMAGE_PROFILE,
    fonts: ["NotoSerif-Italic-latin1.ttf"],
    inputs: KAMEA_INPUTS,
  },
  "kamea-sigil": {
    // One row, one `<svg>`, as the generator's download; in rows with
    // `columns` (a long name's card).
    render: (props) => (
      <KameaSigilImage
        planet={props.planet}
        text={props.text}
        finals={props.finals}
        columns={props.columns}
        fontFamily={KAMEA_FONT_FAMILY}
      />
    ),
    // The component marks a best-effort figure on its root, which no
    // image may carry (the closed SVG profile admits no data attribute);
    // the route's header says it instead.
    source: (svg) => svg.replace(PLACEMENT_FAILED, "$1"),
    headers: (markup): Record<`X-${string}`, string> =>
      PLACEMENT_FAILED.test(markup)
        ? { [SIGIL_PLACEMENT_HEADER]: "failed" }
        : {},
    profile: KAMEA_SIGIL_IMAGE_PROFILE,
    fonts: ["NotoSerif-Italic-latin1.ttf"],
    inputs: KAMEA_INPUTS,
  },
  "gd-hall": {
    render: renderGdHallImage,
    profile: GD_HALL_IMAGE_PROFILE,
    fonts: [
      "NotoSerif-Italic-latin1.ttf",
      "NotoSerif-BoldItalic-compass.ttf",
      "FrankRuhlLibre-Bold-letters.ttf",
      "EnochianPlain.ttf",
    ],
    source: bareHallFonts,
    paintServers: { idPrefix: "gdhall-" },
    outlined: compactHallSvg,
    palette: true,
    finish: finishGdHallImage,
    // What any preset draws from the data: the Hebrew letters (banners,
    // the trumps' letters), the trumps' paths and titles, the Tree's
    // colours on the boards, the tablets' letters in their versions, as
    // the tablet image reads them (every tablet: the Portal draws the
    // Tablet of Union), and the Shewbread and the candlestick, which the
    // Zelator's second hall draws. The art and the presets are code; the
    // golden pins hold their bytes.
    inputs: [
      ...SHEWBREAD_INPUTS,
      ...CANDLESTICK_INPUTS,
      {
        table: "hebrewLetter",
        rows: "*",
        fields: ["id", "letter.he", "letter.name"],
      },
      {
        table: "treeOfLifePath",
        rows: "*",
        fields: [
          "hermetic.tarotId",
          "hermetic.hebrewLetterId",
          "hermetic.tarotTitle",
        ],
      },
      { table: "sephirah", rows: "*", fields: ["id", "color.queenWeb"] },
      {
        table: "enochianTablet",
        rows: "*",
        fields: ["kind", "readings", "choices"],
      },
      {
        table: "enochianTabletVersion",
        rows: "*",
        fields: ["revision", "base", "choices", "variants", "reversedFrom"],
      },
    ],
  },
  "angel-sigil": {
    // The band, the bare sigil and the talisman (plan 096), each drawn from
    // the angel's slug alone: its Hebrew, roman name and verse are the
    // data's. The rose is rose-sigil's, and is never drawn here.
    render: renderAngelSigilImage,
    source: bareAngelSigilRoot,
    profile: ANGEL_SIGIL_IMAGE_PROFILE,
    fonts: ANGEL_SIGIL_FONTS,
    inputs: ANGEL_SIGIL_INPUTS,
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
