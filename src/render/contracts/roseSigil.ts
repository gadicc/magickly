import {
  type ComponentImageContract,
  canonicalDimensions,
  choice,
  type ImageDimensions,
  invalid,
  parseDimensions,
} from "./types";

export const SIGIL_VIEWBOX = [-50, -50, 100, 100] as const;
/** Letters on the rose. Final forms are folded onto these before lookup. */
export const SIGIL_LETTERS = "אבגדהוזחטיכלמנסעפצקרשת";
export const SIGIL_MAX_LETTERS = 32;
const FINAL_FORMS: Record<string, string> = {
  ך: "כ",
  ם: "מ",
  ן: "נ",
  ף: "פ",
  ץ: "צ",
};

/** The interactive page's normalisation: final letters become their medial forms. */
export function rectifySigilText(text: string): string {
  return text.replace(/[ךםןףץ]/g, (letter) => FINAL_FORMS[letter]);
}

/**
 * The roses a sigil is traced on, the Golden Dawn's (`gd`) first and by
 * default: the package's `ROSE_VERSIONS`, written out so that the
 * contracts do not pull in the geometry; a test holds the two equal.
 */
export const ROSE_IMAGE_VERSIONS = ["gd", "regardie1939"] as const;

export interface RoseSigilProps extends ImageDimensions {
  /** Rectified rose letters, at least one and at most SIGIL_MAX_LETTERS. */
  text: string;
  rose: boolean;
  /**
   * Which rose: the Golden Dawn's when absent, as for a link made before
   * the versions.
   */
  version?: (typeof ROSE_IMAGE_VERSIONS)[number];
}

/**
 * Sigil text is the user's own intent. Links are only created on explicit
 * request and responses are never indexed; the parser accepts final forms
 * and canonicalises them so equivalent spellings share one representation.
 */
export const roseSigil: ComponentImageContract<RoseSigilProps> = {
  slug: "rose-sigil",
  viewBox: SIGIL_VIEWBOX,
  rasterDefault: { width: 1024, height: 1024 },
  keys: ["text", "rose", "version"],
  personal: true,
  parse(searchParams) {
    const raw = searchParams.get("text") ?? "";
    if (raw.length < 1 || raw.length > SIGIL_MAX_LETTERS) invalid();
    const text = rectifySigilText(raw);
    for (const letter of text) if (!SIGIL_LETTERS.includes(letter)) invalid();
    return {
      text,
      rose:
        choice(searchParams.get("rose") ?? "true", ["true", "false"]) ===
        "true",
      version: choice(searchParams.get("version") || "gd", ROSE_IMAGE_VERSIONS),
      ...parseDimensions(searchParams, SIGIL_VIEWBOX),
    };
  },
  canonicalize(props) {
    const pairs: Array<[string, string]> = [["text", props.text]];
    if (!props.rose) pairs.push(["rose", "false"]);
    if (props.version && props.version !== "gd")
      pairs.push(["version", props.version]);
    return [...pairs, ...canonicalDimensions(props)];
  },
  filename: (props) =>
    `rose-sigil-${props.text}${props.version && props.version !== "gd" ? `-${props.version}` : ""}`,
};
