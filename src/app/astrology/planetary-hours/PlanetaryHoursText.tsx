import { H2, List, PageText } from "@/app/PageText";
import Link from "@/ui/Link";

/**
 * How planetary hours work and how to use the calculator, below it (plan 071, decision 5).
 */
export default function PlanetaryHoursText() {
  return (
    <PageText labelledBy="hours-text">
      <H2 id="hours-text">How planetary hours work</H2>
      <p>
        In the old reckoning the day and the night each have twelve hours. Day
        hours run from sunrise to sunset and night hours from sunset to the next
        sunrise, so they are unequal. In summer a day hour is longer than sixty
        minutes and a night hour shorter, and in winter the reverse.
      </p>
      <p>
        Each hour is ruled by one of the seven classical planets in the Chaldean
        order: Saturn, Jupiter, Mars, the Sun, Venus, Mercury and the Moon, then
        Saturn again. The first hour after sunrise belongs to the planet of the
        day, and the others follow in order:
      </p>
      <List>
        <li>Sunday: the Sun</li>
        <li>Monday: the Moon</li>
        <li>Tuesday: Mars</li>
        <li>Wednesday: Mercury</li>
        <li>Thursday: Jupiter</li>
        <li>Friday: Venus</li>
        <li>Saturday: Saturn</li>
      </List>
      <H2>Using the calculator</H2>
      <p>
        The page starts from your approximate location, found from your internet
        connection, and shows the place and its coordinates at the top. If that
        is wrong, as it will be behind a VPN, choose <b>Change</b> and search
        for a city, or use your device&apos;s precise location. The page
        remembers the place you choose. From the place it works out sunrise and
        sunset for the next seven days. Times are shown on your device&apos;s
        clock, and the page says so when the place keeps a different time.
      </p>
      <p>
        The first day is open; tap any other day to see its twenty-four hours.
        Each hour has its number, 1 to 12 for the day and again for the night,
        its start time and its planet. Night hours are shaded and the hour in
        progress is outlined in red. Between midnight and sunrise the list
        starts with the coming day, so the night hour then in progress is not
        shown. Under each day you&apos;ll find how long one day hour and one
        night hour last.
      </p>
      <p>
        Choose a planet from the menu to highlight its hours across the week.
        The menu also gives what the <i>Key of Solomon</i>, in MacGregor
        Mathers&apos; translation of 1888, says the planet&apos;s days and hours
        are good for. For Venus that is friendship, kindness and love, pleasant
        undertakings and travel. For Mercury it is eloquence, business, science
        and divination.
      </p>
      <H2>Related</H2>
      <List>
        <li>
          <Link href="/astrology/planets">The planets</Link>, with a page for
          each: <Link href="/astrology/planet/saturn">Saturn</Link>,{" "}
          <Link href="/astrology/planet/jupiter">Jupiter</Link>,{" "}
          <Link href="/astrology/planet/mars">Mars</Link>,{" "}
          <Link href="/astrology/planet/sol">Sol</Link>,{" "}
          <Link href="/astrology/planet/venus">Venus</Link>,{" "}
          <Link href="/astrology/planet/mercury">Mercury</Link> and{" "}
          <Link href="/astrology/planet/luna">Luna</Link>
        </li>
        <li>
          <Link href="/astrology/moon">Moon Phases</Link>
        </li>
        <li>
          <Link href="/geomancy/reading">Geomancy Reading</Link>, which lists
          the coming hours of the planet you choose for a reading
        </li>
      </List>
    </PageText>
  );
}
