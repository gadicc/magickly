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
 * The printings a component's figures are drawn after, linked to their
 * scans, for the components redrawn from public-domain sources (plan 080,
 * "The sigils' sources"); nothing for the others.
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
