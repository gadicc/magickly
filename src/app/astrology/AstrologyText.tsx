import Link from "@magick-components/Link";
import { H2, H3, List, PageText } from "@/app/PageText";

/**
 * What the Astrology section holds, below its tiles (plan 071, decision 4).
 */
export default function AstrologyText() {
  return (
    <PageText labelledBy="astrology-text">
      <H2 id="astrology-text">Astrology for magical work</H2>
      <p>
        Magicians have long timed their work by the heavens: by the planet that
        rules the day and the hour, by the phase of the Moon and by the signs.
        This section gathers the tools and tables for that.
      </p>
      <H3>Tools</H3>
      <List>
        <li>
          <Link href="/astrology/planetary-hours">Planetary Hours</Link> works
          out the twelve hours of the day and the twelve of the night for the
          coming week, where you are or at a place you choose, and shows which
          planet rules each one.
        </li>
        <li>
          <Link href="/astrology/moon">Moon Phases</Link> shows tonight&apos;s
          Moon and the dates of the last and next new moon, quarters and full
          moon in your own time zone.
        </li>
      </List>
      <H3>The planets</H3>
      <p>
        <Link href="/astrology/planets">The Planets</Link> lists the classical
        planets and the Kabbalistic heavens with their symbols and their English
        and Hebrew names, together with live Moon phase and Mercury retrograde
        widgets. Each of the seven planets of the hours has a page of
        correspondences: symbol, Hebrew letter, god name, archangel,
        intelligence and spirit.
      </p>
      <List>
        <li>
          <Link href="/astrology/planet/saturn">Saturn</Link> ♄, Shabbathai
        </li>
        <li>
          <Link href="/astrology/planet/jupiter">Jupiter</Link> ♃, Tzedek
        </li>
        <li>
          <Link href="/astrology/planet/mars">Mars</Link> ♂, Ma&apos;adim
        </li>
        <li>
          <Link href="/astrology/planet/sol">Sol</Link> ☉, the Sun, Shemesh
        </li>
        <li>
          <Link href="/astrology/planet/venus">Venus</Link> ♀, Noga
        </li>
        <li>
          <Link href="/astrology/planet/mercury">Mercury</Link> ☿, Kochav
        </li>
        <li>
          <Link href="/astrology/planet/luna">Luna</Link> ☾, the Moon, Levanah
        </li>
      </List>
      <p>
        That is the Chaldean order, from the slowest to the fastest, which the
        planetary hours follow. Pages also cover the heavens of the Kabbalah,
        such as the{" "}
        <Link href="/astrology/planet/primum-mobile">Primum Mobile</Link>, as
        well as Uranus, Neptune and the Moon&apos;s nodes.
      </p>
      <H3>The zodiac</H3>
      <p>
        <Link href="/astrology/zodiac">The Zodiac</Link> gives the twelve signs,
        from Aries to Pisces, with their symbols, meanings, dates and ruling
        planets.
      </p>
      <p>
        Astrology runs through the rest of the site too. Each of the{" "}
        <Link href="/kabbalah/yhvh/72angels">72 angels</Link> rules five degrees
        of the zodiac, and a{" "}
        <Link href="/geomancy/reading">geomancy reading</Link> sets its figures
        on an astrological chart.
      </p>
    </PageText>
  );
}
