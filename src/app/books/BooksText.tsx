import Link from "@magick-components/Link";
import { H2, H3 } from "@/app/PageText";

/**
 * How the books are edited, below the list (plan 071, decision 4).
 */
export default function BooksText() {
  return (
    <section aria-labelledby="books-text">
      <H2 id="books-text">About these editions</H2>
      <p>
        Each book is read page by page from a scan of the printed book, not from
        machine OCR. Where the original is wrong, a misprinted date, a
        misnumbered entry or a miscounted total, the text keeps the
        author&apos;s words and a note says what is wrong and what it should be.
        Every page marker links to the facsimile of its leaf. You can always
        check the reading against the page it was made from.
      </p>
      <H3>La Science Cabalistique</H3>
      <p>
        <Link href="/books/la-science-cabalistique">
          La Science Cabalistique
        </Link>
        , Lazare Lenain&apos;s book of 1823, was the first work in French on the
        72 angels of the Kabbalah. It was printed in 500 copies and sold by the
        author from his reading room. It sets out the 72 genii of the Shem
        HaMephorash and the arithmetic of Lenain&apos;s four cabalistic tables.
        Each genius takes five degrees of the zodiac, five days of the year and
        twenty minutes of each day.
      </p>
      <p>
        The edition is in French, chapter by chapter, from a later reissue with
        a preface by Papus. For the angels in English, see{" "}
        <Link href="/kabbalah/yhvh/72angels">the 72 angels</Link>. Their names,
        dates and correspondences are translated from Lenain&apos;s French
        alone, and each angel has its own page, from{" "}
        <Link href="/kabbalah/angel/vehuiah">Vehuiah</Link> to{" "}
        <Link href="/kabbalah/angel/mumiah">Mumiah</Link>. The{" "}
        <Link href="/kabbalah/yhvh">Shem HaMephorash</Link> page explains the
        name they come from.
      </p>
      <p>
        Lenain died in 1877 and Papus in 1916, so both texts are in the public
        domain. This reading of them is CC BY 4.0.
      </p>
    </section>
  );
}
