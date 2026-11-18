import { editionNotes } from "magick-data/kabbalah/lenain/notes";
import { bookLeaves, divisions } from "magick-data/kabbalah/lenain/volume";
import Link from "next/link";
import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import JsonLd from "@/seo/JsonLd";
import { bookJsonLd } from "@/seo/lenain";
import { pageMetadata } from "@/seo/metadata";
import { SITE_URL } from "@/seo/site";
import styles from "../../../books/la-science-cabalistique/reading.module.css";

const PATH = "/books/la-science-cabalistique";

export const metadata = pageMetadata("/books/la-science-cabalistique");

export default function BookPage() {
  return (
    <>
      <PageBreadcrumbs path="/books/la-science-cabalistique" />
      <div className={styles.reading}>
        <JsonLd data={bookJsonLd(SITE_URL)} />
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
          rather than from an OCR of it. Every page marker links to the
          facsimile of that leaf.
        </p>
        <p>
          The scan is not of the 1823 printing but of a later reissue, which
          reproduces Lenain&apos;s title page and adds a preface by Papus for
          the Ordre Kabbalistique de la Rose-Croix. The volume does not date
          itself; the first reprint is recorded as Dujols and Thomas, 1909. It
          is not a facsimile: the reissue was reset from scratch, with its own
          line breaks and page contents, and its spelling modernised
          (&ldquo;savans&rdquo; became &ldquo;savants&rdquo;). The page numbers
          here are the reissue&apos;s, not Lenain&apos;s.
        </p>
        <p>
          Lenain died in 1877 and Papus in 1916, so both texts are public domain
          and no rights are asserted over either. This reading of them is{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
        </p>
        <h3>Sources</h3>
        <ul>
          <li>
            The base text: the reissue,{" "}
            <a href="https://books.google.com/books?id=ZqgpxTZ43HkC">
              Google Books ZqgpxTZ43HkC
            </a>
            .
          </li>
          <li>
            The 1823 printing, Koninklijke Bibliotheek copy:{" "}
            <a href="https://books.google.com/books?id=qt9SAAAAcAAJ">
              Google Books qt9SAAAAcAAJ
            </a>
            . Cited in the editorial notes wherever it bears on one.
          </li>
          <li>
            Bibliothèque interuniversitaire de santé, Ms 5365, an undated
            handwritten copy of the 1823 printing:{" "}
            <a href="https://archive.org/details/BIUSante_ms05365">
              archive.org BIUSante_ms05365
            </a>{" "}
            (Licence ouverte). Cited beside it; where the two differ, the
            difference is the copyist&apos;s.
          </li>
          <li>
            Lenain&apos;s own sources, whose tables give the seventy-two but
            neither the nations nor their names of God: Agrippa,{" "}
            <i lang="fr">La Philosophie occulte</i>, The Hague 1727, vol. II,{" "}
            <a href="https://archive.org/details/per_witchcraft-in-europe-and-america_agrippa-von-nettesh_1727_12_22/page/n588/mode/1up">
              pp. 109–110
            </a>
            , the seventy-two names in the spellings Lenain uses; and Kircher,{" "}
            <i lang="la">Oedipus Aegyptiacus</i>, vol. II part 1, 1653,{" "}
            <a href="https://archive.org/details/A027083/page/n278/mode/1up">
              pp. 271–273
            </a>
            , the seventy-two angels by choir, in Hebrew and Latin, and{" "}
            <a href="https://archive.org/details/A027083/page/n294/mode/1up">
              p. 287
            </a>
            , where he explains the four-letter name of God.
          </li>
        </ul>
        <p>
          The text is printed as the reissue sets it. Where it is wrong, it
          keeps its words and an editorial note says what is wrong, what it
          should be, and whether the slip is the reissue&apos;s or Lenain&apos;s
          own.
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
            <Link href="/kabbalah/yhvh/72angels">The 72 angels</Link> — the
            genii of Chapter VI, in English, with their dates and
            correspondences
          </li>
        </ul>
      </div>
    </>
  );
}
