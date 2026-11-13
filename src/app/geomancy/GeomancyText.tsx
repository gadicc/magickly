import { H2, H3, List, PageText } from "@/app/PageText";
import Link from "@/ui/Link";

/**
 * What the Geomancy section holds, below its tiles (plan 071, decision 4).
 */
export default function GeomancyText() {
  return (
    <PageText labelledBy="geomancy-text">
      <H2 id="geomancy-text">Geomancy</H2>
      <p>
        Geomancy is divination by sixteen figures. Each figure is four rows of
        one point or two, first made from marks in the earth, which gave the art
        its name. A reading starts from four figures, the Mothers. The
        Daughters, Nephews (often called Nieces), Witnesses and Judge are worked
        out from them, and the twelve figures in the houses are set on an
        astrological chart, as the Golden Dawn practised it.
      </p>
      <H3>On this site</H3>
      <List>
        <li>
          <Link href="/geomancy/reading">Geomancy Reading</Link>: cast the four
          Mothers at random or enter your own, see every figure derived and
          placed on the chart, and read the Witnesses and Judge for the house
          your question belongs to.
        </li>
        <li>
          <Link href="/geomancy/reference">The Sixteen Geomantic Figures</Link>:
          each figure&apos;s meaning, its meaning in each of the twelve houses,
          and its sign, element and planet, sortable by meaning pairs, by name
          or by binary value.
        </li>
      </List>
      <H3>The sixteen figures</H3>
      <p>The figures come in pairs of opposite or related meanings:</p>
      <List>
        <li>Acquisitio (gain) and Amissio (loss)</li>
        <li>Albus (white) and Rubeus (red)</li>
        <li>Puella (girl) and Puer (boy)</li>
        <li>Laetitia (joy) and Tristitia (sorrow)</li>
        <li>
          Caput Draconis and Cauda Draconis, the Dragon&apos;s Head and Tail
        </li>
        <li>Populus (people) and Via (way)</li>
        <li>Conjunctio (conjunction) and Carcer (prison)</li>
        <li>Fortuna Major and Fortuna Minor, the greater and lesser fortune</li>
      </List>
      <p>
        Each figure is ruled by one or two of the seven{" "}
        <Link href="/astrology/planets">planets</Link>, and through them by a
        planetary spirit and intelligence, which the reference lists with the
        spirits&apos; sigils. The Golden Dawn&apos;s practice uses the{" "}
        <Link href="/astrology/planetary-hours">planetary hours</Link> to time a
        reading as well.
      </p>
    </PageText>
  );
}
