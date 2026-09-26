import Link from "@magick-components/Link";
import zodiacs from "@/../data/astrology/Zodiac";
import Data from "@/../data/data";
import { angelSlug } from "@/../data/kabbalah/angelSlugs";
import christianChoirs from "@/../data/kabbalah/ChristianChoirs";
import { anchorOfGenius, notesOfGenius } from "@/../data/kabbalah/lenain/notes";
import type { Angel } from "@/../data/kabbalah/SeventyTwoAngels";
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
} from "@/../data/kabbalah/seventyTwoAngelsDerived";
import {
  EntityFrame,
  EntityTable,
  Hebrew,
  Lede,
  type Neighbour,
  PrevNext,
  Row,
  Trail,
} from "@/components/entity";
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

/** Lenain's days belong to the year, not to one of them; 2001 is common. */
function day([month, dayOfMonth]: MonthDay) {
  return formatter.format(new Date(2001, month - 1, dayOfMonth));
}

/** The planet a decade falls under, named rather than identified. */
function planetName(id: string) {
  const planets = Data.planet as Record<
    string,
    { name: { en: { en: string } } }
  >;
  return Object.hasOwn(planets, id) ? planets[id].name.en.en : id;
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
                  {" — as Lenain points it: "}
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
          {sign.from}–{sign.to}° of {zodiacs[sign.zodiacId].name.en}
        </Row>
        <Row label="Degrees of the sphere">
          {degrees.from}–{degrees.to}
        </Row>
        <Row label="Decade">
          {/* planetOf gives the id; a reader wants the planet's name. */}
          {decadeOf(no)} of 36, under {planetName(planetOf(no))}
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
                    {note.printed}
                    {note.used ? ` → ${note.used}` : ", kept as printed"}
                  </>
                ) : null}
                {" — "}
                {note.why}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2>In the book</h2>
      <p>
        Printed on page{angel.printedPages.length > 1 ? "s" : ""}{" "}
        {angel.printedPages.join(" and ")} of{" "}
        <Link href={BOOK}>
          <i>La Science Cabalistique</i>
        </Link>
        , Amiens 1823.{" "}
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
