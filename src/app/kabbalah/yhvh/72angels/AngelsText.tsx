import Link from "@magick-components/Link";
import { H2, List, PageText } from "@/app/PageText";

/**
 * What each of the 72 angels' entries gives, below the list (plan 071, decision 5).
 */
export default function AngelsText() {
  return (
    <PageText labelledBy="angels-text">
      <H2 id="angels-text">What each entry gives</H2>
      <p>
        Open an angel to see its attribute, what it rules, its divine name, its
        choir, its five degrees of the zodiac with the days they govern, its
        presiding days, what it is invoked for and what it influences, who is
        born under it, its contrary genius, and its psalm verse. Each angel also
        has a full page of its own, with its Hebrew name. Under{" "}
        <i>Original text</i>, choose <i>Français (Lenain)</i> to see what Lenain
        printed.
      </p>
      <p>
        In Lenain&apos;s arithmetic each genius takes five degrees of the
        zodiac, five days of the year and twenty minutes of each day, counting
        from the first degree of Aries on 20 March. The angels fall eight to a
        choir through the nine choirs, from the Seraphim to the Angels. The
        dates can follow the tropical zodiac or the sidereal (Fagan-Bradley).
      </p>
      <H2>Some of the angels</H2>
      <p>
        <Link href="/kabbalah/angel/vehuiah">Vehuiah</Link> is the first and{" "}
        <Link href="/kabbalah/angel/mumiah">Mumiah</Link> the last. Others
        include <Link href="/kabbalah/angel/jeliel">Jeliel</Link>,{" "}
        <Link href="/kabbalah/angel/omael">Omael</Link>,{" "}
        <Link href="/kabbalah/angel/mikael">Mikael</Link>,{" "}
        <Link href="/kabbalah/angel/sealiah">Sealiah</Link>,{" "}
        <Link href="/kabbalah/angel/poiel">Poiel</Link> and{" "}
        <Link href="/kabbalah/angel/anauel">Anauel</Link>. Two angels share the
        name Lauviah, the <Link href="/kabbalah/angel/lauviah-11">11th</Link>{" "}
        and the <Link href="/kabbalah/angel/lauviah-17">17th</Link>.
      </p>
      <H2>Related</H2>
      <List>
        <li>
          <Link href="/kabbalah/yhvh">The Shem HaMephorash</Link>, the name the
          angels come from
        </li>
        <li>
          <Link href="/books/la-science-cabalistique">
            La Science Cabalistique
          </Link>
          , Lenain&apos;s book in full
        </li>
        <li>
          <Link href="/kabbalah/tree">The Tree of Life</Link>
        </li>
        <li>
          <Link href="/astrology/zodiac">The zodiac</Link> and{" "}
          <Link href="/astrology/planets">the planets</Link>
        </li>
      </List>
    </PageText>
  );
}
