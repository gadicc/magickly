import { H2, H3, List, PageText } from "@/app/PageText";
import Link from "@/i18n/PublicLink";
import UiRichText from "@/i18n/UiRichText";

/**
 * What Magick.ly holds, below the home page's tiles (plan 071, decision 4).
 */
export default function HomeText() {
  return (
    <PageText labelledBy="home-text">
      <H2 id="home-text">
        <UiRichText
          message={/*i18n*/ "A reference for the Western esoteric tradition"}
        />
      </H2>
      <p>
        <UiRichText
          message={
            /*i18n*/ "Magick.ly is a free, open-source reference and set of tools for students of Hermetic magick, as the Golden Dawn taught it and as it grew from older sources. It is a reference, not a course: nothing here replaces a teacher or a good book."
          }
        />
      </p>
      <H3>
        <UiRichText message={/*i18n*/ "What's here"} />
      </H3>
      <List>
        <li>
          <UiRichText
            message={
              /*i18n*/ "<0><1>Kabbalah</1></0>: an <2>interactive Tree of Life</2>, where each Sephirah and path has its own page, and the <3>72 angels of the Shem HaMephorash</3>."
            }
            components={{
              0: <b />,
              1: <Link href="/kabbalah" />,
              2: <Link href="/kabbalah/tree" />,
              3: <Link href="/kabbalah/yhvh/72angels" />,
            }}
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "<0><1>Golden Dawn</1></0>: the <2>grades</2> from Neophyte 0=0 to Ipsissimus 10=1, floor plans of the <3>temple halls</3>, the grade <4>rituals</4>, a <5>Rose Cross sigil generator</5> and the <6>temple symbols</6>."
            }
            components={{
              0: <b />,
              1: <Link href="/gd" />,
              2: <Link href="/gd/grades" />,
              3: <Link href="/gd/halls" />,
              4: <Link href="/gd/rituals" />,
              5: <Link href="/gd/sigils" />,
              6: <Link href="/gd/symbols" />,
            }}
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "<0><1>Enochian</1></0>: John Dee and Edward Kelley's <2>Keys</2>, a searchable <3>dictionary</3>, the four elemental <4>tablets</4> and Dee's <5>Oration to God</5>."
            }
            components={{
              0: <b />,
              1: <Link href="/enochian" />,
              2: <Link href="/enochian/keys" />,
              3: <Link href="/enochian/dictionary" />,
              4: <Link href="/enochian/tablets" />,
              5: <Link href="/enochian/oration" />,
            }}
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "<0><1>Astrology</1></0>: <2>planetary hours</2> for where you are, <3>moon phases</3>, the <4>planets</4> and the <5>zodiac</5>."
            }
            components={{
              0: <b />,
              1: <Link href="/astrology" />,
              2: <Link href="/astrology/planetary-hours" />,
              3: <Link href="/astrology/moon" />,
              4: <Link href="/astrology/planets" />,
              5: <Link href="/astrology/zodiac" />,
            }}
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "<0><1>Geomancy</1></0>: cast a <2>reading</2> and look up the <3>sixteen figures</3>."
            }
            components={{
              0: <b />,
              1: <Link href="/geomancy" />,
              2: <Link href="/geomancy/reading" />,
              3: <Link href="/geomancy/reference" />,
            }}
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "<0><1>Books</1></0>: public-domain works published in full, starting with Lazare Lenain's <2>La Science Cabalistique</2> of 1823."
            }
            components={{
              0: <b />,
              1: <Link href="/books" />,
              2: (
                <Link
                  href="/books/la-science-cabalistique"
                  lang="fr"
                  dir="ltr"
                />
              ),
            }}
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "<0><1>Study</1></0>: spaced-repetition flashcards for Hebrew letters, planetary and zodiac signs, alchemy, Enochian and more."
            }
            components={{ 0: <b />, 1: <Link href="/study" /> }}
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "<0><1>MagickGPT</1></0>: ask an AI that answers from a library of magickal texts and cites its sources."
            }
            components={{ 0: <b />, 1: <Link href="/chat" /> }}
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "<0><1>Open source</1></0>: the <2>data</2> behind the site, every table with its rows and fields, on npm as magick-data, and the <3>components</3> that draw the Tree of Life, the tablets and the sigils, each shown live with props to try, on npm as magick-components."
            }
            components={{
              0: <b />,
              1: <Link href="/open-source" />,
              2: <Link href="/open-source/data" />,
              3: <Link href="/open-source/components" />,
            }}
          />
        </li>
      </List>
      <H3>
        <UiRichText message={/*i18n*/ "For temples"} />
      </H3>
      <p>
        <UiRichText
          message={
            /*i18n*/ "A temple can keep its own rituals here, each readable by members of the right grade on any device. See <0>temples and private rituals</0>."
          }
          components={{ 0: <Link href="/help/temples" /> }}
        />
      </p>
      <H3>
        <UiRichText message={/*i18n*/ "Open source, open data"} />
      </H3>
      <p>
        <UiRichText
          message={
            /*i18n*/ "The app's code is on GitHub. Its data is free to reuse under CC BY 4.0, with credit, and the components that draw the Tree of Life, sigils, tablets and temple halls under MIT. See <0>Open source</0>."
          }
          components={{ 0: <Link href="/open-source" /> }}
        />
      </p>
    </PageText>
  );
}
