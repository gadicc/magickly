import Link from "next/link";
import { notesByPage } from "@/../data/kabbalah/lenain/notes";
import { bookLeaves, divisions } from "@/../data/kabbalah/lenain/volume";
import { privateMetadata } from "@/seo/metadata";
import Reading from "../Reading";
import styles from "../reading.module.css";

/**
 * The whole book on one page, for finding a phrase and for printing.
 *
 * Not indexed. It is a byte-for-byte duplicate of the eleven chapter routes,
 * so a search engine must choose one of them as canonical; if it chose this
 * one, every chapter would stop ranking and a single 250 KB page would rank
 * weakly for everything. "follow" keeps its links feeding the chapters. See
 * plan 033.
 */
export const metadata = privateMetadata("La Science Cabalistique, whole");

export default function WholeBookPage() {
  return (
    <>
      <header className={styles.reading}>
        <p>
          <Link href="/books/la-science-cabalistique">
            La Science Cabalistique
          </Link>
        </p>
        <h1>The whole book</h1>
        <p>
          All {bookLeaves().length} leaves on one page, for searching with your
          browser&apos;s find and for printing. Each chapter has its own page:{" "}
          {divisions.map((division, index) => (
            <span key={division.slug}>
              {index > 0 ? ", " : ""}
              <Link href={`/books/la-science-cabalistique/${division.slug}`}>
                {division.heading}
              </Link>
            </span>
          ))}
          .
        </p>
      </header>
      <Reading
        leaves={bookLeaves()}
        notesByPage={notesByPage()}
        label="La Science Cabalistique, complete"
      />
    </>
  );
}
