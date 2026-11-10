import Link from "@magick-components/Link";
import { H2, List, PageText } from "@/app/PageText";

/**
 * What the Moon page shows, below it (plan 071, decision 5).
 */
export default function MoonText() {
  return (
    <PageText labelledBy="moon-text">
      <H2 id="moon-text">About this page</H2>
      <p>
        The drawing shows the Moon as it is now, with the name of its phase. It
        is turned the right way up for your hemisphere, judged from your
        approximate location or from the place you chose for the{" "}
        <Link href="/astrology/planetary-hours">planetary hours</Link>. Below it
        are the dates and times of the last new moon, the first quarter, the
        full moon, the third quarter, the next new moon and the next full moon.
        All of them are in your own time zone, and the ones already past are
        dimmed. Everything is worked out in your browser when you open the page,
        so it is always current.
      </p>
      <H2>The phases</H2>
      <p>
        A lunation, from new moon to new moon, takes about twenty-nine and a
        half days. The Moon waxes from new to full, passing the first quarter
        when half its face is lit, and wanes from full back to new through the
        third quarter. Many magical traditions time their work by it, choosing
        the waxing Moon for what should grow and the waning Moon for what should
        end.
      </p>
      <H2>Related</H2>
      <List>
        <li>
          <Link href="/astrology/planet/luna">Luna</Link>: the Moon&apos;s
          correspondences, with its Hebrew name Levanah, its archangel,
          intelligence and spirit
        </li>
        <li>
          <Link href="/astrology/planets">The planets</Link>, with live Moon
          phase and Mercury retrograde widgets
        </li>
        <li>
          <Link href="/astrology/planetary-hours">Planetary Hours</Link>: Monday
          is the Moon&apos;s day, and its hours recur through every day and
          night
        </li>
        <li>
          <Link href="/astrology/zodiac">The zodiac</Link>
        </li>
        <li>
          <Link href="/geomancy">Geomancy</Link>, where the Moon rules Populus
          and Via
        </li>
      </List>
    </PageText>
  );
}
