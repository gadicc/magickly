import {
  HEYDON_PAGES,
  HeydonCitation,
  heydonLabel,
  PLATE_X,
  PlateXCitation,
} from "@/drawings/sigilSources";
import type { ComponentName } from "@/explorer/components";
import Cite from "@/sources/Cite";

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
        <Cite work="heydon1663" leaf={HEYDON_PAGES[13].leaf}>
          <HeydonCitation page={13} />
        </Cite>{" "}
        and{" "}
        <Cite
          work="heydon1663"
          leaf={HEYDON_PAGES[15].leaf}
          aria-label={heydonLabel(15)}
        >
          p. 15
        </Cite>
        .
      </p>
    );
  if (name === "PlanetarySeal")
    return (
      <p className={className}>
        The seals are drawn after the woodcuts in Agrippa,{" "}
        <i>De occulta philosophia</i> (Cologne, 1533), book II, chapter 22:
        Saturn and Jupiter on{" "}
        <Cite work="agrippa1533" leaf={164} region="saturnAndJupiter">
          p. CXLIX
        </Cite>
        , Mars and the Sun on{" "}
        <Cite work="agrippa1533" leaf={165}>
          p. CL
        </Cite>
        , Venus on{" "}
        <Cite work="agrippa1533" leaf={166}>
          p. CLI
        </Cite>
        , Mercury on{" "}
        <Cite work="agrippa1533" leaf={167}>
          p. CLII
        </Cite>{" "}
        and the Moon on{" "}
        <Cite work="agrippa1533" leaf={168}>
          p. CLIII
        </Cite>
        .
      </p>
    );
  // The README's Provenance rows (checked 14 November 2026).
  if (name === "TableOfShewbread")
    return (
      <p className={className}>
        The table is drawn in code after <i>The Equinox</i> I(2) (1909),{" "}
        <Cite work="equinoxI2" leaf={266}>
          p. 265, Diagram 16
        </Cite>
        ; the Zelator ritual describes it in Regardie, <i>The Golden Dawn</i>,
        vol. 2 (1938), pp.{" "}
        <Cite work="regardie1938" leaf={54}>
          60
        </Cite>
        –
        <Cite work="regardie1938" leaf={55}>
          61
        </Cite>
        . The Kerubim and the signs stand at their elements&apos; quarters, East
        at the top. The archangels, the permutations of the Name and the tribes
        are magick-data&apos;s, the last two after Crowley&apos;s <i>777</i>{" "}
        (1909).
      </p>
    );
  if (name === "FylfotCross")
    return (
      <p className={className}>
        The cross follows the Fylfot Cross of the Third Knowledge Lecture, in
        Regardie, <i>The Golden Dawn</i>, vol. 1 (1937),{" "}
        <Cite work="regardie1937" leaf={122}>
          p. 131
        </Cite>
        , which the Zelator ritual explains in vol. 2 (1938),{" "}
        <Cite work="regardie1938" leaf={51}>
          p. 57
        </Cite>
        . The symbols are magick-data&apos;s, and the colours of the arms our
        own.
      </p>
    );
  if (name === "Tablet")
    return (
      <p className={className}>
        The Equinox&apos;s sigils, and the form of the coloured Air sigil, are
        drawn after{" "}
        <Cite work="equinoxI7" leaf={PLATE_X.leaf}>
          <PlateXCitation />
        </Cite>
        .
      </p>
    );
  return null;
}
