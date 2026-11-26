import { H2, List, PageText } from "@/app/PageText";
import Cite from "@/sources/Cite";
import Link from "@/ui/Link";

/**
 * How to use the tablets page, below the tablet; the tablets and their
 * versions are described above it, from their notes (plan 071, decision 5).
 */
export default function TabletsText() {
  return (
    <PageText labelledBy="tablets-text">
      <H2 id="tablets-text">Using this page</H2>
      <p>
        Choose a tablet and a version. Switch between Latin and Enochian
        letters, and show the reversed letters and the second letters some
        squares carry. In the Golden Dawn&apos;s versions,{" "}
        <i>Draw as pyramids</i> draws every square as its pyramid, each side in
        its element&apos;s colour, with a key to the colours;{" "}
        <i>Symbols on the sides</i> then paints each side&apos;s symbol on it,
        standing on the square&apos;s edge, and <i>Stand the symbols upright</i>{" "}
        turns them all to be read. Beside the tablet, or under it on a phone,
        are three tabs. <i>Names</i> lists the names read off the tablet,
        grouped as it is built: the three holy names, the King and the six
        Seniors on the Great Cross, then each quarter&apos;s names, and in the
        Golden Dawn&apos;s versions its Kerubic archangel and servient angels,
        which put a letter of the Tablet of Union before their names. The Tablet
        of Union is a tablet of its own here, with its four lines and its first
        column; Dee and Raphael have none. Choose a name to see its squares on
        the tablet, from its first, with how the other versions and the sources
        spell it, where it is read and its dictionary entry; tap a square to
        find the names through it, or turn on <i>Show the regions</i> to tint
        the crosses and the top rows. <i>Differences</i> marks every square
        where the versions disagree: tap one to see what each version and source
        has there, and why. <i>Squares</i> shows a square as the Golden
        Dawn&apos;s truncated pyramid: tap a square, or choose its row and
        square, or follow a square from a name&apos;s detail. Each version comes
        with its sources and page references, and with how it differs from the
        others. Download the tablet as SVG or PNG as it is shown, and use the
        share button at the top of the page to send a link with the tablet,
        version, tab and square you chose.
      </p>
      <H2 id="tablets-pyramids">The squares as pyramids</H2>
      <p>
        The Golden Dawn treats every square of the four Watchtowers and of the
        Tablet of Union as a truncated pyramid: four sides around a flat top
        that holds the square&apos;s letter. Each side carries an element, and
        most carry an attribution as well: a sign and its decan, a planet, a
        Sephirah, a Tarot card or trump, a geomantic figure or a Hebrew letter.
        None of this depends on the letters. It is a rule over positions, given
        region by region: the Great Cross, read in blocks of three squares under
        the letters of the Name; the Calvary crosses, which hold the ten
        Sephiroth; the Kerubic squares of each top row; the servient squares
        below the cross bars, whose column and rank each take a letter of the
        Name; and the Tablet of Union. The sides are painted in the elements'
        colours, Fire red, Water blue, Air yellow, Earth black and Spirit white,
        with each symbol in the complementary colour (Regardie,{" "}
        <i>The Golden Dawn</i>, vol. 4, p.
        <Cite work="regardie1940" leaf={287} plain rel="noreferrer">
          295
        </Cite>
        ). On a servient square, the mix of elements on its four sides gives it
        one of fifteen Egyptian gods, and their Kerubs give it a sphinx, both
        used in skrying the square. The rules are in Regardie&apos;s{" "}
        <i>The Golden Dawn</i>, vol. 4 (1940), and in &ldquo;Liber
        Chanokh&rdquo; in <i>The Equinox</i> I(7) (1912), whose plates draw
        every square as a pyramid.
      </p>
      <p>
        Everything in the Squares tab is computed from those rules and tested
        against the squares, tables and plates the sources print, and every rule
        is shown with the pages it comes from. The drawing is ours: the Order
        painted the tablets flat and made a pyramid of card for one square at a
        time. Regardie&apos;s drawings in vol. 4 stand each symbol on its
        side&apos;s outer edge, so that the top side&apos;s is upside down on
        the page (pp.
        <Cite work="regardie1940" leaf={286} plain rel="noreferrer">
          294
        </Cite>{" "}
        and{" "}
        <Cite work="regardie1940" leaf={288} plain rel="noreferrer">
          296
        </Cite>
        ); we take them to be read from outside the pyramid, and ours stand so.
        The Equinox&apos;s plates stand them all upright on the page (
        <Cite work="equinoxI7" leaf={242} plain rel="noreferrer">
          Plate IV
        </Cite>
        ), as <i>Stand the symbols upright</i> does; which way the Order itself
        painted them, these two witnesses do not settle. So is a whole tablet
        drawn in pyramids, after the Order&apos;s rule for one square: the sides
        in their elements&apos; colours, and the letter on a flat top half as
        wide as the square, or a third with the symbols on the sides. The
        Equinox&apos;s plates draw the top about a quarter of the square, to
        leave the sides room for the symbols; ours keeps the letter large enough
        to read, and shows one symbol a side where the sources list several.
        Some readings are ours too, and labelled so: where the sources do not
        say which of a sphinx&apos;s left and right sides gives which part, the
        Kerubs are listed by side rather than drawn as one figure; where a
        sphinx has two active sides and two passive, no tendency is given; and
        the Children of Horus are given by the three elements present, as the
        gods&apos; table and its one worked example of the kind have them.
        Dee&apos;s and Raphael&apos;s tables carry no elements, so their
        versions have no pyramids.
      </p>
      <p>
        One thing is disputed: the order of the four Sephiroth on a Calvary
        cross&apos;s bar. Vol. 4&apos;s diagram of a lesser angle and the Ten
        Squares badge in vol. 1 (1937) put Binah, Gevurah, Tiferet, Chesed and
        Chochmah from the left; the Equinox&apos;s plates put Gevurah, Binah,
        Tiferet, Chochmah and Chesed in every lesser angle, and one square vol.
        4 works out agrees with them. The Golden Dawn&apos;s and Regardie&apos;s
        versions here follow vol. 4&apos;s diagram and the badge, the
        Equinox&apos;s its plates, and a square on a bar says what the other
        layout puts there.
      </p>
      <H2>Related</H2>
      <List>
        <li>
          Each tablet on a page of its own, with its names and its images in the
          Golden Dawn&apos;s version: the{" "}
          <Link href="/enochian/tablets/earth">Earth</Link>,{" "}
          <Link href="/enochian/tablets/air">Air</Link>,{" "}
          <Link href="/enochian/tablets/water">Water</Link> and{" "}
          <Link href="/enochian/tablets/fire">Fire</Link> tablets, and the{" "}
          <Link href="/enochian/tablets/union">Tablet of Union</Link>
        </li>
        <li>
          <Link href="/enochian/keys">The Enochian Keys</Link> and{" "}
          <Link href="/enochian/dictionary">dictionary</Link>
        </li>
        <li>
          The tablets in the{" "}
          <Link href="/gd/halls">Golden Dawn temple halls</Link>: Earth in the{" "}
          <Link href="/gd/halls/zelator-1">Zelator hall</Link>, Air in the{" "}
          <Link href="/gd/halls/theoricus-1">Theoricus 32nd path hall</Link>,
          Fire in the{" "}
          <Link href="/gd/halls/philosophus-1">Philosophus 29th path hall</Link>
          , and the Tablet of Union in the{" "}
          <Link href="/gd/halls/portal-1">Portal</Link>
        </li>
      </List>
    </PageText>
  );
}
