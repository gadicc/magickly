import { H2, H3 } from "@/app/PageText";
import Link from "@/i18n/PublicLink";
import UiRichText from "@/i18n/UiRichText";

/**
 * How the books are edited, below the list (plan 071, decision 4).
 */
export default function BooksText() {
  return (
    <section aria-labelledby="books-text">
      <H2 id="books-text">
        <UiRichText message={/*i18n*/ "About these editions"} />
      </H2>
      <p>
        <UiRichText
          message={
            /*i18n*/ "Each book is read page by page from a scan of the printed book, not from machine OCR. Where the original is wrong, a misprinted date, a misnumbered entry or a miscounted total, the text keeps the author's words and a note says what is wrong and what it should be. Every page marker links to the facsimile of its leaf. You can always check the reading against the page it was made from."
          }
        />
      </p>
      <H3>
        <bdi lang="fr" dir="ltr">
          La Science Cabalistique
        </bdi>
      </H3>
      <p>
        <UiRichText
          message={
            /*i18n*/ "<0>La Science Cabalistique</0>, Lazare Lenain's book of 1823, was the first work in French on the 72 angels of the Kabbalah. It was printed in 500 copies and sold by the author from his reading room. It sets out the 72 genii of the Shem HaMephorash and the arithmetic of Lenain's four cabalistic tables. Each genius takes five degrees of the zodiac, five days of the year and twenty minutes of each day."
          }
          components={{
            0: (
              <Link href="/books/la-science-cabalistique" lang="fr" dir="ltr" />
            ),
          }}
        />
      </p>
      <p>
        <UiRichText
          message={
            /*i18n*/ "The edition is in French, chapter by chapter, from a later reissue with a preface by Papus. For the angels in English, see <0>the 72 angels</0>. Their names, dates and correspondences are translated from Lenain's French alone, and each angel has its own page, from <1>Vehuiah</1> to <2>Mumiah</2>. The <3>Shem HaMephorash</3> page explains the name they come from."
          }
          components={{
            0: <Link href="/kabbalah/yhvh/72angels" />,
            1: <Link href="/kabbalah/angel/vehuiah" />,
            2: <Link href="/kabbalah/angel/mumiah" />,
            3: <Link href="/kabbalah/yhvh" />,
          }}
        />
      </p>
      <p>
        <UiRichText
          message={
            /*i18n*/ "Lenain died in 1877 and Papus in 1916, so both texts are in the public domain. This reading of them is CC BY 4.0."
          }
        />
      </p>
    </section>
  );
}
