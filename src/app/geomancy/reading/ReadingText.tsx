import { H2, List, PageText } from "@/app/PageText";
import Link from "@/ui/Link";

/**
 * How to cast and read a geomancy reading, below the tool (plan 071, decision 5).
 */
export default function ReadingText() {
  return (
    <PageText labelledBy="reading-text">
      <H2 id="reading-text">How to cast a reading</H2>
      <List ordered>
        <li>
          <b>Frame your question</b> and decide which of the twelve houses it
          belongs to: money in the second, travel in the ninth, love and
          partnership in the seventh.
        </li>
        <li>
          <b>Make the four Mothers.</b> Each row of a figure is one point (odd)
          or two (even). Tap a row to switch it, which lets you copy in figures
          you made yourself from dots on paper or in sand. Or press the dice
          under a Mother for a random figure from your browser&apos;s secure
          random generator. The page opens on an example, so roll or enter all
          four.
        </li>
        <li>
          <b>Read the rest.</b> The page derives the four Daughters by reading
          the Mothers across, row by row. It then adds the figures in pairs to
          make the four Nephews (often called Nieces), the two Witnesses and the
          Judge. Adding counts the points: an odd total gives one point, an even
          total two.
        </li>
      </List>
      <H2>Interpreting it</H2>
      <p>
        Choose the house. The page shows each Witness and the Judge with its
        meaning in that house, marked good or bad from that meaning; correct any
        mark you read differently, and the page gives the verdict. A good Judge
        from two good Witnesses is good. A good Judge from mixed Witnesses
        promises success after delay and vexation. Two good Witnesses with a bad
        Judge end badly.
      </p>
      <p>
        The twelve figures, Mothers, Daughters and Nephews, are set in the
        twelve houses of an astrological chart with their signs and planets, as
        in the Golden Dawn&apos;s astrological geomancy. Download the chart as
        SVG or PNG, or copy a link that restores the same reading.
      </p>
      <H2>The planet and the hour</H2>
      <p>
        Before casting, choose the planet that suits your question. The page
        gives its intelligence and spirit, draws the spirit&apos;s sigil in a
        pentagram, and offers an invocation adapted from{" "}
        <i>Geomancy in the Golden Dawn</i>. It also lists the planet&apos;s
        coming <Link href="/astrology/planetary-hours">planetary hours</Link> at
        your location.
      </p>
      <H2>Related</H2>
      <List>
        <li>
          <Link href="/geomancy/reference">The Sixteen Geomantic Figures</Link>:
          every figure&apos;s meaning in every house
        </li>
        <li>
          <Link href="/astrology/planets">The planets</Link> and{" "}
          <Link href="/astrology/zodiac">the zodiac</Link>
        </li>
        <li>
          <Link href="/geomancy">Geomancy</Link>
        </li>
      </List>
    </PageText>
  );
}
