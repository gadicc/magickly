import {
  HEYDON_PAGES,
  HeydonCitation,
  heydonLabel,
  PLATE_X,
  PlateXCitation,
} from "@/drawings/sigilSources";
import type { ComponentName } from "@/explorer/components";
import Link from "@/ui/Link";

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
        <Link href={HEYDON_PAGES[13].url}>
          <HeydonCitation page={13} />
        </Link>{" "}
        and{" "}
        <Link href={HEYDON_PAGES[15].url} aria-label={heydonLabel(15)}>
          p. 15
        </Link>
        .
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
