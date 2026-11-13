import { H2, H3, List, PageText } from "@/app/PageText";
import Link from "@/ui/Link";

/**
 * What the Enochian section holds, below its tiles (plan 071, decision 4).
 */
export default function EnochianText() {
  return (
    <PageText labelledBy="enochian-text">
      <H2 id="enochian-text">Enochian magick</H2>
      <p>
        Enochian magick comes from the angelic sessions that John Dee, Elizabeth
        I&apos;s mathematician and astrologer, held with the scryer Edward
        Kelley in the 1580s. Kelley saw and heard the angels, and Dee recorded
        what they gave: a language with its own alphabet of twenty-one letters,
        the Keys spoken in that language, and great tables of letters. Three
        centuries later the Golden Dawn built these into its own system. Both
        traditions are here.
      </p>
      <H3>On this site</H3>
      <List>
        <li>
          <Link href="/enochian/keys">The Enochian Keys</Link>, also called the
          Calls: the nineteen invocations Dee received, the last of them the
          Call of the Thirty Aethyrs, in his spelling or the Golden Dawn&apos;s,
          in English, in Enochian or side by side. Tap any word to look it up.
        </li>
        <li>
          <Link href="/enochian/dictionary">The Enochian dictionary</Link>:
          1,911 words, written in Latin letters and in the Enochian script, with
          pronunciations, meanings and their sources, and Gerald Schueler&apos;s
          gematria.
        </li>
        <li>
          <Link href="/enochian/tablets">The Enochian tablets</Link>: the four
          elemental Watchtowers of Earth, Air, Water and Fire, with the Tablet
          of Union. Choose the Golden Dawn&apos;s version or Dee&apos;s own of
          1584 and 1587, and see where the versions differ.
        </li>
        <li>
          <Link href="/enochian/oration">The Oration to God</Link>: the prayer
          Dee wrote to be said every day, three times over, before working with
          the angels of the Heptarchy.
        </li>
        <li>
          <Link href="/study?tags=enochian">Enochian flashcards</Link>: learn
          the twenty-one letters by spaced repetition.
        </li>
      </List>
      <H3>Where it meets the Golden Dawn</H3>
      <p>
        The Golden Dawn spoke the Keys in its own forms, which Aleister Crowley
        printed in <i>The Equinox</i> in 1912; the Keys page gives them beside
        Dee&apos;s. Its version of the tablets is the default here, as in its{" "}
        <Link href="/gd/halls">temple halls</Link>, where the tablets stand on
        the walls. The Earth tablet stands in the{" "}
        <Link href="/gd/halls/zelator-1">Zelator hall</Link> and the Fire tablet
        in the <Link href="/gd/halls/philosophus-1">Philosophus hall</Link>.
        Dee&apos;s tables, as he recorded them, are given beside it for anyone
        who works from Dee alone.
      </p>
    </PageText>
  );
}
