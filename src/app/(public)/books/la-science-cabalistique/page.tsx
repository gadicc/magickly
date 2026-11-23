import { plateRange } from "magick-data/kabbalah/lenain/firstTable";
import { editionNotes } from "magick-data/kabbalah/lenain/notes";
import { bookLeaves, divisions } from "magick-data/kabbalah/lenain/volume";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import JsonLd from "@/seo/JsonLd";
import { bookJsonLd } from "@/seo/lenain";
import { pageMetadata } from "@/seo/metadata";
import { SITE_URL } from "@/seo/site";
import { MIRRORED_PAGES, type MirroredPageKey } from "@/sources/mirroredPages";
import SourceLink from "@/sources/SourceLink";
import { citeUrl, workUrl } from "@/sources/works";
import styles from "../../../books/la-science-cabalistique/reading.module.css";

const PATH = "/books/la-science-cabalistique";

/**
 * Kircher's plate of the seventy-two names of God by nation in the
 * Complutense copy, photographed partly folded: the second copy, beside the
 * National Library of Poland's, which is mirrored and was transcribed.
 */
const KIRCHER_PLATE_COMPLUTENSE = citeUrl("kircher1653Complutense", {
  leaf: 294,
});

/** The Amiens library's records of its two copies of the 1823 printing. */
const AMIENS_RECORD = (id: number) =>
  `https://bibliotheques.amiens.fr/Default/doc/SYRACUSE/${id}/la-science-cabalistique-ou-l-art-de-connaitre-les-bons-genies-qui-influent-sur-la-destinee-des-homme`;

/** A mirrored page, its link named by the full citation. */
function PageLink({
  page,
  children,
}: {
  page: MirroredPageKey;
  children: ReactNode;
}) {
  return (
    <SourceLink plain page={page} aria-label={MIRRORED_PAGES[page].label}>
      {children}
    </SourceLink>
  );
}

export const metadata = pageMetadata("/books/la-science-cabalistique");

export default function BookPage() {
  const reissuePlate = plateRange("plate1909");
  const plate1823 = plateRange("plate1823");
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
          <a href={workUrl("lenainReissue")}>Google Books scan</a> rather than
          from an OCR of it. Every page marker links to the facsimile of that
          leaf.
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
            <a href={workUrl("lenainReissue")}>Google Books ZqgpxTZ43HkC</a>,
            the Bibliothèque municipale de Lyon&apos;s copy, whose folded plate
            shows the first table&apos;s rows {reissuePlate.from} to{" "}
            {reissuePlate.to} (<PageLink page="lenainReissue25">p. 25</PageLink>
            ).
          </li>
          <li>
            The 1823 printing, Koninklijke Bibliotheek copy:{" "}
            <a href={workUrl("lenain1823")}>Google Books qt9SAAAAcAAJ</a>. Cited
            in the editorial notes wherever it bears on one; its plate, opened
            further, shows rows {plate1823.from} to {plate1823.to}, and the same
            page names Lenain&apos;s sources (
            <PageLink page="lenain25">p. 25</PageLink>).
          </li>
          <li>
            A second copy of the reissue, also Lyon&apos;s:{" "}
            <a href={workUrl("lenainReissueLyon2")}>
              Google Books BqzyzEEX3MAC
            </a>
            , its plate folded the same way, so it shows no further rows.
          </li>
          <li>
            Bibliothèque interuniversitaire de santé, Ms 5365, an undated
            handwritten copy of the 1823 printing:{" "}
            <a href={workUrl("lenainMs5365")}>archive.org BIUSante_ms05365</a>{" "}
            (Licence ouverte). Cited beside it; where the two differ, the
            difference is the copyist&apos;s.
          </li>
          <li>
            Two copies of the 1823 printing in Amiens, Bibliothèque Louis
            Aragon, shelfmarks <a href={AMIENS_RECORD(1711996)}>42247</a> and{" "}
            <a href={AMIENS_RECORD(293461)}>M 2762</a>: not digitised, and not
            yet read for this edition.
          </li>
          <li>
            Lenain&apos;s own sources, which he names on p. 25:
            <ul>
              <li>
                Agrippa, <i lang="fr">La Philosophie occulte</i>, The Hague
                1727, vol. II, pp. <PageLink page="agrippaFr109">109</PageLink>{" "}
                and <PageLink page="agrippaFr110">110</PageLink>: the
                seventy-two names, in the spellings Lenain uses, without nations
                or names of God.
              </li>
              <li>
                Kircher, <i lang="la">Oedipus Aegyptiacus</i>, vol. II part 1,
                1653, pp. <PageLink page="kircher271">271</PageLink>,{" "}
                <PageLink page="kircher272">272</PageLink> and{" "}
                <PageLink page="kircher273">273</PageLink>: the seventy-two by
                choir, in Hebrew and Latin, the table Lenain says he relies on
                entirely; and p. <PageLink page="kircher287">287</PageLink>,
                where Kircher says every nation&apos;s name of God has four
                letters and introduces the plate of them that follows.
              </li>
              <li>
                Kircher&apos;s{" "}
                <PageLink page="kircherPlate">plate after p. 287</PageLink>,
                which the copy above lacks: seventy-two four-letter names of
                God, each with its nation. The first table&apos;s last two
                columns follow it row for row, and it is transcribed here from
                the National Library of Poland&apos;s copy, on Wikimedia
                Commons; the reconstructed table sets each ray beside its row,
                and a note on each entry that departs from it says how. A second
                copy, the Universidad Complutense de Madrid&apos;s, was
                photographed partly folded:{" "}
                <a href={KIRCHER_PLATE_COMPLUTENSE}>
                  archive.org bub_gb_XjfzMnomDQoC, leaf n294
                </a>
                .
              </li>
            </ul>
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
