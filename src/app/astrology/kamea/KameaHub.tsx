import { Kamea } from "magick-components/astrology/Kamea";
import type { ReactNode } from "react";
import { H2, PageText } from "@/app/PageText";
import UiRichText from "@/i18n/UiRichText";
import UiText from "@/i18n/UiText";
import Link from "@/ui/Link";
import styles from "./kamea.module.css";
import {
  KAMEA_HUB_PATH,
  KAMEA_PLANETS,
  KAMEA_SQUARE_LABELS,
  kameaConstants,
  kameaPath,
} from "./kameaPlanets";
import { LeafLink } from "./LeafLinks";
import { leafRef, WITNESS_ITEMS } from "./witnesses";

/** An outside link, as the page's other outside links are drawn. */
function Outside({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} rel="noopener">
      {children}
    </Link>
  );
}

/** A leaf of a witness's book, linked, or opened in the lightbox if mirrored. */
function Leaf({
  item,
  leaf,
  region,
  children,
}: {
  item: string;
  leaf: number;
  /** The passage the link outlines on a mirrored leaf. */
  region?: string;
  children?: ReactNode;
}) {
  return <LeafLink leaf={leafRef(item, leaf, region)}>{children}</LeafLink>;
}

/**
 * The kameas' hub (plan 093, "Pages"): the seven squares, each linking its
 * page; what a kamea is; Agrippa's squares and the Golden Dawn's use of
 * them, a paragraph each; the method of tracing a name, in brief and in
 * our words, with Regardie's pages linked and nothing quoted; and the
 * generator. The app bar heads it ("Kameas", `pathnames.ts`).
 */
export default function KameaHub() {
  return (
    <PageText labelledBy="kameas">
      <H2 id="kameas">
        <UiText message={/*i18n*/ "The seven planetary squares"} />
      </H2>
      <p>
        <UiRichText
          message={
            /*i18n*/ "A kamea is a planet's magic square: the numbers from 1 to the square of its order, set so that every row, every column and both diagonals add up to the same sum. Seven planets have one, from Saturn's three by three to the Moon's nine by nine. Agrippa says that the magi call them the planets' sacred tables (<0>page CXLV</0>), and tells what each is said to do when it is engraved in metal, Saturn's on a plate of lead (<1>page CXLVI</1>) and the Sun's on one of gold (<2>page CXLVII</2>)."
          }
          components={{
            0: <Leaf item={WITNESS_ITEMS.agrippa1533} leaf={160} />,
            1: <Leaf item={WITNESS_ITEMS.agrippa1533} leaf={161} />,
            2: <Leaf item={WITNESS_ITEMS.agrippa1533} leaf={162} />,
          }}
        />
      </p>
      <ul className={styles.squares}>
        {KAMEA_PLANETS.map((planet) => {
          const { order, line, total } = kameaConstants(planet);
          return (
            <li key={planet}>
              <Link href={kameaPath(planet)} className={styles.card}>
                <Kamea planet={planet} label={false} />
                <span className={styles.cardName}>
                  <UiText message={KAMEA_SQUARE_LABELS[planet]} />
                </span>
                <span className={styles.cardFacts}>
                  <UiText
                    message={
                      /*i18n*/ "{order} by {order}, each line {line}, the whole {total}"
                    }
                    values={{ order, line, total }}
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p>
        <UiRichText
          message={
            /*i18n*/ "Each square has four numbers of its own: its order, its count of cells, which is also its highest number, the sum of a line and the sum of the whole. Saturn's are 3, 9, 15 and 45. The names of the planet's angels and spirits are made to add up to them, letter by letter, and each square's page lists its names with every printing's reading of them."
          }
        />
      </p>

      <H2 id="agrippa">
        <UiText message={/*i18n*/ "Agrippa's squares"} />
      </H2>
      <p>
        <UiRichText
          message={
            /*i18n*/ "Heinrich Cornelius Agrippa printed the seven squares in <0>De occulta philosophia</0> (Cologne, 1533), book II, chapter 22, each in numbers and again in Hebrew letters, with the planet's seal and the characters of the names he gives it: its intelligence and spirit, and Venus' intelligences too; the Moon has a spirit, a spirit of spirits and an intelligence of intelligences. Before them he lists, planet by planet, the divine names, intelligences and spirits whose letters add up to the squares' numbers: on <1>page CXLVIII</1>, and the Moon's on <2>page CXLIX</2>. The English translation of 1651 and Barrett's <3>The Magus</3> (1801) reprint them. The squares on this site are Agrippa's, with two slips of the 1533 printing corrected, a number each in Venus' and the Moon's; whether they are the author's or the printer's, the evidence read does not settle."
          }
          components={{
            0: <i />,
            1: <Leaf item={WITNESS_ITEMS.agrippa1533} leaf={163} />,
            2: (
              <Leaf item={WITNESS_ITEMS.agrippa1533} leaf={164} region="luna" />
            ),
            3: <i />,
          }}
        />
      </p>

      <H2 id="golden-dawn">
        <UiText message={/*i18n*/ "The Golden Dawn"} />
      </H2>
      <p>
        <UiRichText
          message={
            /*i18n*/ "The Hermetic Order of the Golden Dawn took the squares into its grades: the Moon's is drawn in the hall of the <0>second part of the Theoricus grade</0> and Venus' in that of the <1>fourth part of the Philosophus grade</1>. Israel Regardie, in <2>The Golden Dawn</2> (volume 4, Chicago, 1940), writes that while he was a member the Order no longer knew how to form sigils from the squares, that its Chiefs had taken the squares, and Aiq Bekar with them, out of its knowledge lectures, and that the method and the right form of the squares were to be had in books and manuscripts in the British Museum (<4>pages 78 and 79</4>). He sets the method out himself, and his plates give the seven squares with the seals of the planets and of their intelligences and spirits (<5>pages 81 to 86</5>). His forms of the names are often nearer to those of Crowley's <3>777</3> than to Agrippa's: Yophiel for Agrippa's Iohphiel, Bartzabel for his Barzabel."
          }
          components={{
            0: <Link href="/gd/halls/theoricus-2" />,
            1: <Link href="/gd/halls/philosophus-4" />,
            2: <i />,
            3: <i />,
            4: <Outside href={leafRef(WITNESS_ITEMS.regardie1940, 72).href} />,
            5: <Outside href={leafRef(WITNESS_ITEMS.regardie1940, 75).href} />,
          }}
        />
      </p>

      <H2 id="method">
        <UiText message={/*i18n*/ "Tracing a name on a square"} />
      </H2>
      <p>
        <UiRichText
          message={
            /*i18n*/ "In the method Regardie sets out, each letter of a name is counted at its number and found on the square. A number the square does not have is taken down to its tens or its units, as Aiq Bekar, the Qabalah of nine chambers, groups the letters: on Saturn's square of nine, Lamed's 30 becomes 3. A line drawn through the cells in the order of the letters, from a small circle at the first, is the name's sigil. He gives it on <0>pages 78 to 80</0> of volume 4, with two worked examples: Zazel on Saturn's square, and a second of his own, Taphthartharath on Mercury's."
          }
          components={{
            0: <Outside href={leafRef(WITNESS_ITEMS.regardie1940, 72).href} />,
          }}
        />
      </p>
      <p>
        <UiRichText
          message={
            /*i18n*/ "The <0>kamea sigil generator</0> traces any Hebrew name on any of the seven squares, and says what it chooses where the method is silent."
          }
          components={{ 0: <Link href={`${KAMEA_HUB_PATH}/sigils`} /> }}
        />
      </p>
    </PageText>
  );
}
