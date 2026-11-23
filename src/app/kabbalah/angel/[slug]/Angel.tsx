import Data from "magick-data";
import zodiacs from "magick-data/astrology/zodiac";
import christianChoirs from "magick-data/kabbalah/christianChoirs";
import {
  anchorOfGenius,
  notesOfGenius,
} from "magick-data/kabbalah/lenain/notes";
import type { Angel } from "magick-data/kabbalah/seventyTwoAngels";
import {
  ANGEL_COUNT,
  choirOf,
  decadeOf,
  degreesOf,
  governedDaysOf,
  invocationOf,
  type MonthDay,
  planetOf,
  presidingDaysOf,
  signOf,
} from "magick-data/kabbalah/seventyTwoAngels/derived";
import React from "react";
import { scriptRuns } from "@/app/books/la-science-cabalistique/hebrewRuns";
import { reissuePageUrl } from "@/app/books/la-science-cabalistique/scan";
import Witnesses from "@/app/books/la-science-cabalistique/Witnesses";
import { angelSlug } from "@/lib/angelSlugs";
import { angelJsonLd, angelSigilSection } from "@/seo/angelSigils";
import JsonLd from "@/seo/JsonLd";
import {
  EntityFrame,
  EntityTable,
  Hebrew,
  Lede,
  type Neighbour,
  PrevNext,
  Row,
  Trail,
} from "@/ui/entity";
import Link from "@/ui/Link";
import AngelSigil from "./AngelSigil";
import styles from "./angel.module.css";

/**
 * One genius, server-rendered.
 *
 * The list page keeps all seventy-two behind accordions that unmount when
 * closed, and loads their prose on the client, so production serves none of
 * this: "Vehuiah" appears three times in that HTML and "God elevated and
 * exalted" not at all. Everything a reader or a crawler wants is in the markup
 * here. See plan 033's follow-ups.
 *
 * English here, French on the book's routes, each linking to the other — so
 * the two pages answer different questions rather than competing to answer
 * the same one.
 *
 * The table, the trail, the Hebrew and the nav are the entity pages' shared
 * pieces, which were extracted from this page (plan 036); what is left here
 * is its own: the attribute, Lenain's entry, the notes and the book.
 */

const BOOK = "/books/la-science-cabalistique";

const formatter = new Intl.DateTimeFormat("en", {
  month: "long",
  day: "numeric",
});

/**
 * A pointed name without its marks. Where that is not the name itself, the
 * reissue has misprinted it (the 37th, 68th and 69th) and the name follows the
 * 1823 printing, so the pointed form is the misprint's.
 */
function lettersOf(pointed: string) {
  return [...pointed].filter((c) => !/\p{Mark}/u.test(c)).join("");
}

/**
 * Hebrew inside a note's text, marked as the reading edition marks it, and
 * any other script (a name from Kircher's plate) with its language and
 * direction.
 */
function withHebrew(text: string, keyPrefix: string) {
  return scriptRuns(text, keyPrefix, (run, key, { lang, dir }) =>
    lang === "he" ? (
      <Hebrew key={key}>{run}</Hebrew>
    ) : (
      <span key={key} lang={lang} dir={dir}>
        {run}
      </span>
    ),
  );
}

/** Lenain's days belong to the year, not to one of them; 2001 is common. */
function day([month, dayOfMonth]: MonthDay) {
  return formatter.format(new Date(2001, month - 1, dayOfMonth));
}

/** The planet a decade falls under, named and linked to its page. */
function DecadePlanet({ id }: { id: string }) {
  const planets = Data.planet as Record<
    string,
    { name: { en: { en: string } } }
  >;
  if (!Object.hasOwn(planets, id)) return <>{id}</>;
  return <Link href={`/astrology/planet/${id}`}>{planets[id].name.en.en}</Link>;
}

function clock(minutes: number) {
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The neighbour a number names, or none past either end of the seventy-two. */
function neighbour(no: number): Neighbour | undefined {
  if (no < 1 || no > ANGEL_COUNT) return undefined;
  return { href: `/kabbalah/angel/${angelSlug(no)}`, label: String(no) };
}

/**
 * The page body. Synchronous, so that `renderToString` can render it: the
 * route loads the texts and hands this the angel's own two.
 */
export default function AngelPage({
  angel,
  english,
  french,
}: {
  angel: Angel;
  /** Lenain's entry for this angel, in English. */
  english: string;
  /** And as he printed it, in French. */
  french: string;
}) {
  const no = angel.no;
  const sign = signOf(no);
  const degrees = degreesOf(no);
  const invocation = invocationOf(no);
  const governed = governedDaysOf(no);
  const choir = christianChoirs[choirOf(no) - 1];
  const notes = notesOfGenius(no);
  const anchor = anchorOfGenius(no);

  return (
    <EntityFrame>
      <Trail href="/kabbalah/yhvh/72angels">The 72 Angels</Trail>
      {/* The trail and the sigil's images, in one graph. */}
      <JsonLd data={angelJsonLd(angel)} />

      <h1>
        {no}. {angel.name.en}
        {angel.name.he ? (
          <>
            {" "}
            <Hebrew>{angel.name.he}</Hebrew>
          </>
        ) : null}
      </h1>

      {angel.attribute.en ? (
        <Lede>
          “{angel.attribute.en}”
          {angel.attribute.fr ? (
            <>
              {" — "}
              <span lang="fr">
                <i>{angel.attribute.fr}</i>
              </span>
            </>
          ) : null}
        </Lede>
      ) : null}

      <EntityTable>
        <Row label="Angel">{angel.name.en}</Row>
        <Row label="Hebrew">
          {angel.name.he ? (
            <>
              <Hebrew>{angel.name.he}</Hebrew>
              {angel.name.hePointed ? (
                <>
                  {lettersOf(angel.name.hePointed) === angel.name.he
                    ? " — as the page points it: "
                    : " — as the reissue misprints it: "}
                  <Hebrew>{angel.name.hePointed}</Hebrew>
                </>
              ) : null}
            </>
          ) : null}
        </Row>
        <Row label="Rules">{angel.people.en}</Row>
        <Row label="God name">{angel.godName}</Row>
        <Row label="Choir">{choir.name.en}</Row>
        <Row label="Zodiac">
          {sign.from}–{sign.to}° of{" "}
          <Link href={`/astrology/zodiac#${sign.zodiacId}`}>
            {zodiacs[sign.zodiacId].name.en}
          </Link>
        </Row>
        <Row label="Degrees of the sphere">
          {degrees.from}–{degrees.to}
        </Row>
        <Row label="Decade">
          {decadeOf(no)} of 36, under <DecadePlanet id={planetOf(no)} />
        </Row>
        <Row label="Governs the days">
          {day(governed.from)} – {day(governed.to)}
        </Row>
        <Row label="Presides on">{presidingDaysOf(no).map(day).join(", ")}</Row>
        <Row label="Invocation">
          {clock(invocation.from)} – {clock(invocation.to)}
        </Row>
        <Row label="Psalm">
          {angel.psalm.psalm > 0 ? (
            <>
              {angel.psalm.psalm}:{angel.psalm.verse}
              {angel.psalm.la ? (
                <>
                  {" — "}
                  <span lang="la">
                    <i>{angel.psalm.la}</i>
                  </span>
                </>
              ) : null}
            </>
          ) : null}
        </Row>
        <Row label="Invoked for">{angel.invokedFor.en}</Row>
        <Row label="Influences">{angel.governs.en}</Row>
        <Row label="Born under">{angel.bornUnder.en}</Row>
        <Row label="Contrary genius">{angel.contrary.en}</Row>
      </EntityTable>

      <AngelSigil section={angelSigilSection(angel)} />

      <h2>Lenain’s entry</h2>
      <p className={styles.said}>{english}</p>

      <h2 lang="fr">Le texte de Lenain</h2>
      <p lang="fr" className={styles.said}>
        {french}
      </p>

      {notes.length ? (
        <>
          <h2>Editorial notes</h2>
          <ul className={styles.notes}>
            {notes.map((note) => (
              <li key={`${note.field}-${note.printed}`}>
                <strong>{note.field}</strong>{" "}
                <span className={styles.kind}>{note.kind}</span>
                {note.printed ? (
                  <>
                    {" · "}
                    {withHebrew(note.printed, `p-${note.field}`)}
                    {note.used ? " → " : ", kept as printed"}
                    {withHebrew(note.used, `u-${note.field}`)}
                  </>
                ) : note.used ? (
                  // Nothing is printed, but a value is used: say which.
                  <>
                    {" · "}
                    {withHebrew(note.used, `u-${note.field}`)}
                  </>
                ) : null}
                {" — "}
                {withHebrew(note.why, `w-${note.field}`)}
                <Witnesses witnesses={note.witnesses} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2>In the book</h2>
      <p>
        Printed on page{angel.printedPages.length > 1 ? "s" : ""}{" "}
        {angel.printedPages.map((page, i) => (
          <React.Fragment key={page}>
            {i ? " and " : ""}
            <a href={reissuePageUrl(page) ?? undefined} rel="noreferrer">
              {page}
            </a>
          </React.Fragment>
        ))}{" "}
        of the reissue of{" "}
        <Link href={BOOK}>
          <i>La Science Cabalistique</i>
        </Link>{" "}
        (Amiens, 1823) that this site transcribes; each page number opens that
        page of the scan, on Google Books.{" "}
        {anchor ? (
          <Link href={`${BOOK}/chapitre-6#${anchor}`}>
            Read it in the French, on the page
          </Link>
        ) : null}
      </p>

      <PrevNext
        label="Angels"
        prev={neighbour(no - 1)}
        next={neighbour(no + 1)}
      />
    </EntityFrame>
  );
}
