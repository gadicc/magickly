import {
  HEYDON_PAGES,
  HeydonCitation,
  heydonLabel,
  PLATE_X,
  PlateXCitation,
} from "@/drawings/sigilSources";
import type { ComponentName } from "@/explorer/components";
import SourceLink from "@/sources/SourceLink";
import Link from "@/ui/Link";

/**
 * A leaf of Agrippa's *De occulta philosophia* (1533), the Library of
 * Congress copy on archive.org (`PLANETARY_SEAL_LEAVES`). Leaf n164 is
 * mirrored, but outlined for the Moon's name, not the seals, so it is
 * linked here like the rest.
 */
const agrippaLeaf = (leaf: number) =>
  `https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n${leaf}/mode/1up`;

/**
 * A leaf of Regardie's *The Golden Dawn* (Aries Press, Chicago) on
 * archive.org, vol. 1 (1937) or vol. 2 (1938). In copyright where the site
 * is read (plan 091), so linked for the facts our drawings take from it,
 * never mirrored or traced.
 */
const regardieLeaf = (volume: 1 | 2, leaf: number) =>
  `https://archive.org/details/${
    volume === 1
      ? "IsraelRegardie-thegoldenDawn-vol1-1937"
      : "IsraelRegardie-TheGoldenDawn-Vol2-1938"
  }/page/n${leaf}/mode/1up`;

/** A leaf of *The Equinox* I(2) (1909) on archive.org. */
const equinox2Leaf = (leaf: number) =>
  `https://archive.org/details/crowley-equinox_202110/${encodeURIComponent(
    "The Equinox Vol. 1, No. 2",
  )}/page/n${leaf}/mode/1up`;

/**
 * The printings a component's figures are drawn after, linked to their
 * scans: the components redrawn from public-domain sources (plan 080,
 * "The sigils' sources"), and the two Golden Dawn figures drawn in code
 * after the Equinox and Regardie (plan 094's C6); nothing for the others.
 */
export default function DrawnAfter({
  name,
  className,
}: {
  name: ComponentName;
  className?: string;
}) {
  if (name === "PlanetarySpirit")
    return (
      <p className={className}>
        The sigils are drawn after{" "}
        <SourceLink page={HEYDON_PAGES[13].mirror}>
          <HeydonCitation page={13} />
        </SourceLink>{" "}
        and{" "}
        <SourceLink page={HEYDON_PAGES[15].mirror} aria-label={heydonLabel(15)}>
          p. 15
        </SourceLink>
        .
      </p>
    );
  if (name === "PlanetarySeal")
    return (
      <p className={className}>
        The seals are drawn after the woodcuts in Agrippa,{" "}
        <i>De occulta philosophia</i> (Cologne, 1533), book II, chapter 22:
        Saturn and Jupiter on <Link href={agrippaLeaf(164)}>p. CXLIX</Link>,
        Mars and the Sun on <Link href={agrippaLeaf(165)}>p. CL</Link>, Venus on{" "}
        <Link href={agrippaLeaf(166)}>p. CLI</Link>, Mercury on{" "}
        <Link href={agrippaLeaf(167)}>p. CLII</Link> and the Moon on{" "}
        <Link href={agrippaLeaf(168)}>p. CLIII</Link>.
      </p>
    );
  // The README's Provenance rows (checked 14 November 2026).
  if (name === "TableOfShewbread")
    return (
      <p className={className}>
        The table is drawn in code after <i>The Equinox</i> I(2) (1909),{" "}
        <Link href={equinox2Leaf(266)}>p. 265, Diagram 16</Link>; the Zelator
        ritual describes it in Regardie, <i>The Golden Dawn</i>, vol. 2 (1938),
        pp. <Link href={regardieLeaf(2, 54)}>60</Link>–
        <Link href={regardieLeaf(2, 55)}>61</Link>. The Kerubim and the signs
        stand at their elements&apos; quarters, East at the top. The archangels,
        the permutations of the Name and the tribes are magick-data&apos;s, the
        last two after Crowley&apos;s <i>777</i> (1909).
      </p>
    );
  if (name === "FylfotCross")
    return (
      <p className={className}>
        The cross follows the Fylfot Cross of the Third Knowledge Lecture, in
        Regardie, <i>The Golden Dawn</i>, vol. 1 (1937),{" "}
        <Link href={regardieLeaf(1, 122)}>p. 131</Link>, which the Zelator
        ritual explains in vol. 2 (1938),{" "}
        <Link href={regardieLeaf(2, 51)}>p. 57</Link>. The symbols are
        magick-data&apos;s, and the colours of the arms our own.
      </p>
    );
  if (name === "Tablet")
    return (
      <p className={className}>
        The Equinox&apos;s sigils, and the form of the coloured Air sigil, are
        drawn after{" "}
        <Link href={PLATE_X.url}>
          <PlateXCitation />
        </Link>
        .
      </p>
    );
  return null;
}
