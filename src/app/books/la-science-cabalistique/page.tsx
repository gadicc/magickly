import Link from "next/link";
import { editionNotes } from "@/../data/kabbalah/lenain/notes";
import { bookLeaves, divisions } from "@/../data/kabbalah/lenain/volume";
import { pageMetadata } from "@/seo/metadata";
import styles from "./reading.module.css";

const PATH = "/books/la-science-cabalistique";

export const metadata = pageMetadata("/books/la-science-cabalistique");

export default function BookPage() {
  return (
    <div className={styles.reading}>
      <h1>La Science Cabalistique</h1>
      <p lang="fr">
        <em>
          ou l&apos;art de connaître les bons génies qui influent sur la
          destinée des hommes
        </em>
      </p>
      <p>
        Lazare Lenain, Amiens, 1823. The first work in French to treat the 72
        angels of the Kabbalah, printed in 500 copies and sold by the author
        from his reading room on the place Saint-Firmin.
      </p>

      <h2>Contents</h2>
      <ol>
        {divisions.map((division) => (
          <li key={division.slug}>
            <Link href={`${PATH}/${division.slug}`}>{division.heading}</Link>
            {" — "}
            {division.title}
            {division.subtitle ? (
              <>
                <br />
                <small lang="fr">{division.subtitle}</small>
              </>
            ) : null}
          </li>
        ))}
      </ol>

      <h2>About this edition</h2>
      <p>
        {bookLeaves().length} leaves, read page by page from the{" "}
        <a href="https://books.google.com/books?id=ZqgpxTZ43HkC">
          Google Books scan
        </a>{" "}
        rather than from an OCR of it. Every page marker links to the facsimile
        of that leaf.
      </p>
      <p>
        The scan is not of the 1823 printing but of a later reissue, which
        reproduces Lenain&apos;s title page and adds a preface by Papus for the
        Ordre Kabbalistique de la Rose-Croix. The volume does not date itself;
        the first reprint is recorded as Dujols and Thomas, 1909. Lenain died in
        1877 and Papus in 1916, so both texts are public domain and no rights
        are asserted over either. This reading of them is{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
      </p>
      <p>
        Lenain is printed as he set it. Where he is wrong, the text keeps his
        words and an editorial note says what is wrong and what it should be.
      </p>
      <ul>
        {editionNotes().map((note) => (
          <li key={note.field}>
            <strong>{note.field}</strong> — {note.why}
          </li>
        ))}
      </ul>

      <h2>Read it</h2>
      <ul>
        <li>
          <Link href={`${PATH}/texte-integral`}>
            The whole book on one page
          </Link>{" "}
          — for searching and printing
        </li>
        <li>
          <a href="/docs/Lenain - La Science Cabalistique (1823).md">
            Markdown
          </a>{" "}
          — the same edition as a file
        </li>
        <li>
          <Link href="/kabbalah/yhvh/72angels">The 72 angels</Link> — the genii
          of Chapter VI, in English, with their dates and correspondences
        </li>
      </ul>
    </div>
  );
}
