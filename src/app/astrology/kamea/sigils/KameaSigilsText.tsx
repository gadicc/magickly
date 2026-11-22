import type { ReactNode } from "react";
import { H2, H3, List, PageText } from "@/app/PageText";
import Link from "@/i18n/PublicLink";
import UiRichText from "@/i18n/UiRichText";
import { SITE_REPOSITORY } from "@/seo/site";
import { kameaSigilPagePath } from "./kameaSigilState";

/**
 * Regardie's *The Golden Dawn*, vol. 4 (Aries Press, Chicago, 1940), on
 * archive.org: the method of tracing a name on a kamea on pp. 78–80
 * (leaves n72–n74), the Aiq Bekar table on p. 79 (n73). In copyright
 * where the site is read (plan 091), so its pages are linked, never
 * mirrored, and its facts are given in our own words.
 */
const regardiePage = (leaf: number) =>
  `https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n${leaf}/mode/1up`;

/**
 * Agrippa, *De occulta philosophia* (Cologne, 1533), book II, chapter 22,
 * the Library of Congress copy on archive.org: the names on leaf n163,
 * the squares from n164 (Saturn and Jupiter) to n168 (the Moon).
 */
const agrippaPage = (leaf: number) =>
  `https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n${leaf}/mode/1up`;

const PLAN = `${SITE_REPOSITORY}/blob/main/plans/093-kameas-and-their-sigils.md`;

/** A sigil on this page, as a link that opens it in the generator. */
const sigilHref = (planet: "saturn" | "mercury" | "luna", text: string) =>
  kameaSigilPagePath({ planet, text, finals: false });

/** An outside link, as the page's other outside links are drawn. */
function Outside({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <a href={href} rel="noreferrer">
      {children}
    </a>
  );
}

/**
 * How a name's sigil is traced on a kamea, below the generator (plan 093):
 * the squares, the Golden Dawn's reduction as Regardie printed it, the
 * marks, what the generator chooses where the sources are silent, and
 * where to read them.
 */
export default function KameaSigilsText() {
  return (
    <PageText labelledBy="kamea-sigils-text">
      <H2 id="kamea-sigils-text">
        <UiRichText message={/*i18n*/ "How a kamea sigil is drawn"} />
      </H2>
      <p>
        <UiRichText
          message={
            /*i18n*/ "A kamea is a planet's magic square: the numbers from one up to the square of its order, set so that every row, column and diagonal adds up to the same sum. Agrippa printed the seven in <0>De occulta philosophia</0> (1533), from Saturn's three by three to the Moon's nine by nine, with the names of each planet's intelligence and spirit, whose letters add up to the square's numbers. Israel Regardie, in <1>The Golden Dawn</1> (volume 4, 1940), sets out a method of tracing those names on the squares to draw their sigils, which he writes the Order had lost by his day (<2>page 78</2>), and this generator traces any Hebrew name by it."
          }
          components={{
            0: <i />,
            1: <i />,
            2: <Outside href={regardiePage(72)} />,
          }}
        />
      </p>

      <H3>
        <UiRichText message={/*i18n*/ "The method"} />
      </H3>
      <List ordered>
        <li>
          <UiRichText
            message={
              /*i18n*/ "Each letter is counted at its number: Aleph 1 to Tet 9, Yod 10 to Tzadi 90, Qof 100 to Tav 400."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "A number the square has is kept. A larger one is reduced by Aiq Bekar, the Qabalah of nine chambers, to its tens or its units: divided by ten until the square has it. On Saturn's square Zazel keeps 7, 1 and 7 and takes Lamed's 30 as 3; on Mercury's, Taphthartharath takes Tav's 400 as 40."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "A line runs through the cells in the order of the letters, from a small circle at the first to a short bar at the last."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "Where two letters in a row fall on one cell, the line makes a crook there; where it passes straight through a cell of the name, a small loop marks the stop; and a line that comes back to a cell it has visited is drawn just beside the first visit, as on the <0>Rose Cross sigils</0>."
            }
            components={{ 0: <Link href="/gd/sigils" /> }}
          />
        </li>
      </List>
      <p>
        <UiRichText
          message={
            /*i18n*/ "The table under the sigil shows each letter, its number and the cell it falls on."
          }
        />
      </p>

      <H3>
        <UiRichText message={/*i18n*/ "What the generator chooses"} />
      </H3>
      <List>
        <li>
          <UiRichText
            message={
              /*i18n*/ "Final letters. Aiq Bekar puts the five final forms in the hundreds from 500 to 900, but neither of Regardie's worked examples has one. A final letter counts at its ordinary letter's number unless you choose the table's values, which some of Agrippa's printed sums need."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "Words. Each word of a name is its own figure on its own square, set right to left, as the Rose Cross sigils are."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "The marks. The crook, the loop and the end bar are the Rose Cross sigil's, at a size fixed against the square. Agrippa's own characters put a circle at both ends of most figures, and Regardie's plates mostly a circle at the start and a bar or nothing at the end."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "The Moon's square. On it 10 to 80 stand in one column, so nearly every letter from Yod on falls there, and a long name runs up and down that column. A name whose marks cannot all be set clear of each other and of the square's lines is drawn as well as it can be, and the page says so."
            }
          />
        </li>
      </List>
      <p>
        <UiRichText
          message={
            /*i18n*/ "Agrippa prints the Moon's spirit of spirits as one word of fourteen letters. The list gives it so, and first divided as its romanisation divides it, Schedbarschemoth Schartathan, which is how this site traces it; that division is ours, not Agrippa's."
          }
        />
      </p>
      <p>
        <UiRichText
          message={
            /*i18n*/ "Agrippa's printed characters are largely traces of the names on the squares, drawn freely, but not every one follows this reduction, so the sigils here are not presented as his. Try <0>Agiel</0> on Saturn's square, <1>Taphthartharath</1> on Mercury's or <2>Chasmodai</2> on the Moon's, or choose a name from the list for each planet, which gives every witness's spelling where they differ."
          }
          components={{
            0: <Link href={sigilHref("saturn", "אגיאל")} />,
            1: <Link href={sigilHref("mercury", "תפתרתרת")} />,
            2: <Link href={sigilHref("luna", "חשמודאי")} />,
          }}
        />
      </p>

      <H3>
        <UiRichText message={/*i18n*/ "Sources"} />
      </H3>
      <List>
        <li>
          <UiRichText
            message={
              /*i18n*/ "Heinrich Cornelius Agrippa, <0>De occulta philosophia</0> (Cologne, 1533), book II, chapter 22: the names and their numbers on <1>leaf 163</1>, the Moon's with the squares of Saturn and Jupiter on <2>leaf 164</2>, and the Moon's square on <3>leaf 168</3>, from the Library of Congress copy on archive.org."
            }
            components={{
              0: <i />,
              1: <Outside href={agrippaPage(163)} />,
              2: <Outside href={agrippaPage(164)} />,
              3: <Outside href={agrippaPage(168)} />,
            }}
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "Israel Regardie, <0>The Golden Dawn</0>, volume 4 (Aries Press, Chicago, 1940): the method on <1>pages 78</1> to <2>80</2>, with the Aiq Bekar table on <3>page 79</3>. The book is in the public domain in the United States but still in copyright elsewhere, so its pages are linked rather than shown here."
            }
            components={{
              0: <i />,
              1: <Outside href={regardiePage(72)} />,
              2: <Outside href={regardiePage(74)} />,
              3: <Outside href={regardiePage(73)} />,
            }}
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "The names by witness, where the printings disagree, and how the generator is tested on every name and every triple of letters on each square, are set out in <0>the project's design notes</0>."
            }
            components={{ 0: <Outside href={PLAN} /> }}
          />
        </li>
      </List>
    </PageText>
  );
}
