import Link from "@magick-components/Link";
import { H2, H3, List, PageText } from "@/app/PageText";

/**
 * What Magick.ly holds, below the home page's tiles (plan 071, decision 4).
 */
export default function HomeText() {
  return (
    <PageText labelledBy="home-text">
      <H2 id="home-text">A reference for the Western esoteric tradition</H2>
      <p>
        Magick.ly is a free, open-source reference and set of tools for students
        of Hermetic magick, as the Golden Dawn taught it and as it grew from
        older sources. It is a reference, not a course: nothing here replaces a
        teacher or a good book.
      </p>
      <H3>What&apos;s here</H3>
      <List>
        <li>
          <b>
            <Link href="/kabbalah">Kabbalah</Link>
          </b>
          : an <Link href="/kabbalah/tree">interactive Tree of Life</Link>,
          where each Sephirah and path has its own page, and the{" "}
          <Link href="/kabbalah/yhvh/72angels">
            72 angels of the Shem HaMephorash
          </Link>
          .
        </li>
        <li>
          <b>
            <Link href="/gd">Golden Dawn</Link>
          </b>
          : the <Link href="/gd/grades">grades</Link> from Neophyte 0=0 to
          Ipsissimus 10=1, floor plans of the{" "}
          <Link href="/gd/halls">temple halls</Link>, the grade{" "}
          <Link href="/gd/rituals">rituals</Link>, a{" "}
          <Link href="/gd/sigils">Rose Cross sigil generator</Link> and the{" "}
          <Link href="/gd/symbols">temple symbols</Link>.
        </li>
        <li>
          <b>
            <Link href="/enochian">Enochian</Link>
          </b>
          : John Dee and Edward Kelley&apos;s{" "}
          <Link href="/enochian/keys">Keys</Link>, a searchable{" "}
          <Link href="/enochian/dictionary">dictionary</Link>, the four
          elemental <Link href="/enochian/tablets">tablets</Link> and Dee&apos;s{" "}
          <Link href="/enochian/oration">Oration to God</Link>.
        </li>
        <li>
          <b>
            <Link href="/astrology">Astrology</Link>
          </b>
          : <Link href="/astrology/planetary-hours">planetary hours</Link> for
          where you are, <Link href="/astrology/moon">moon phases</Link>, the{" "}
          <Link href="/astrology/planets">planets</Link> and the{" "}
          <Link href="/astrology/zodiac">zodiac</Link>.
        </li>
        <li>
          <b>
            <Link href="/geomancy">Geomancy</Link>
          </b>
          : cast a <Link href="/geomancy/reading">reading</Link> and look up the{" "}
          <Link href="/geomancy/reference">sixteen figures</Link>.
        </li>
        <li>
          <b>
            <Link href="/books">Books</Link>
          </b>
          : public-domain works published in full, starting with Lazare
          Lenain&apos;s{" "}
          <Link href="/books/la-science-cabalistique">
            La Science Cabalistique
          </Link>{" "}
          of 1823.
        </li>
        <li>
          <b>
            <Link href="/study">Study</Link>
          </b>
          : spaced-repetition flashcards for Hebrew letters, planetary and
          zodiac signs, alchemy, Enochian and more.
        </li>
        <li>
          <b>
            <Link href="/chat">MagickGPT</Link>
          </b>
          : ask an AI that answers from a library of magickal texts and cites
          its sources.
        </li>
      </List>
      <H3>For temples</H3>
      <p>
        A temple can keep its own rituals here, each readable by members of the
        right grade on any device. See{" "}
        <Link href="/help/temples">temples and private rituals</Link>.
      </p>
      <H3>Open source, open data</H3>
      <p>
        The app&apos;s code is on GitHub. Its data is free to reuse under CC BY
        4.0, with credit, and the components that draw the Tree of Life, sigils,
        tablets and temple halls under MIT. See{" "}
        <Link href="/open-source">Open source</Link>.
      </p>
    </PageText>
  );
}
