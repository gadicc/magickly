import Link from "next/link";
import { notFound } from "next/navigation";
import { notesByPage } from "@/../data/kabbalah/lenain/notes";
import {
  divisionBySlug,
  divisions,
  leavesOf,
} from "@/../data/kabbalah/lenain/volume";
import JsonLd from "@/seo/JsonLd";
import { chapterJsonLd, lenainChapterPage } from "@/seo/lenain";
import { seoMetadata } from "@/seo/metadata";
import { SITE_URL } from "@/seo/site";
import FirstTable from "../FirstTable";
import Reading from "../Reading";
import styles from "../reading.module.css";

/** Unknown slugs are 404s without rendering, so arbitrary URLs add no pages. */
export const dynamicParams = false;

export function generateStaticParams() {
  return divisions.map((division) => ({ division: division.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/books/la-science-cabalistique/[division]">) {
  const page = lenainChapterPage((await params).division);
  if (!page) notFound();
  return seoMetadata(page.path, page);
}

export default async function DivisionPage({
  params,
}: PageProps<"/books/la-science-cabalistique/[division]">) {
  const { division: slug } = await params;
  const division = divisionBySlug(slug);
  if (!division) notFound();

  const at = divisions.indexOf(division);
  const previous = divisions[at - 1];
  const next = divisions[at + 1];

  return (
    <>
      {(chapterJsonLd(SITE_URL, slug) ?? []).map((data) => (
        <JsonLd key={data["@type"]} data={data} />
      ))}
      <header className={styles.reading}>
        <p>
          <Link href="/books/la-science-cabalistique">
            La Science Cabalistique
          </Link>
        </p>
        <h1>{division.heading}</h1>
        {division.subtitle ? (
          <p lang="fr">
            <em>{division.subtitle}</em>
          </p>
        ) : (
          <p>{division.title}</p>
        )}
      </header>

      <Reading
        leaves={leavesOf(division)}
        notesByPage={notesByPage()}
        label={`${division.heading} — ${division.title}`}
        omit={[division.heading, division.subtitle]}
      />

      {/* The fold-out belongs to Chapter IV, whose content is its tables. */}
      {slug === "chapitre-4" ? <FirstTable /> : null}

      <nav className={styles.reading} aria-label="Chapters">
        {previous ? (
          <p>
            ←{" "}
            <Link href={`/books/la-science-cabalistique/${previous.slug}`}>
              {previous.heading}
            </Link>
          </p>
        ) : null}
        {next ? (
          <p>
            <Link href={`/books/la-science-cabalistique/${next.slug}`}>
              {next.heading}
            </Link>{" "}
            →
          </p>
        ) : null}
      </nav>
    </>
  );
}
