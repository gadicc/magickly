import type { ReactNode } from "react";
import { H2, H3, List, PageText } from "@/app/PageText";
import Link from "@/i18n/PublicLink";
import UiRichText from "@/i18n/UiRichText";
import { SITE_REPOSITORY } from "@/seo/site";

/**
 * Regardie's *The Golden Dawn*, vol. 4 (Aries Press, Chicago, 1940), on
 * archive.org: the sigil rules on p. 57 (leaf n51) and the worked figures
 * on pp. 58–60 (leaves n52–n54), as plan 088 cites them. It was never
 * renewed, so it is public domain in the US, but it is in copyright
 * elsewhere to the end of 2055 (plan 091), so its pages are linked, never
 * mirrored (`src/sources/mirroredPages.ts` holds only works out of
 * copyright everywhere).
 */
const regardiePage = (leaf: number) =>
  `https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n${leaf}/mode/1up`;

/** A sigil on this page, as a link that opens it in the generator. */
const sigilHref = (text: string) =>
  `/gd/sigils?text=${encodeURIComponent(text)}`;

const PLAN = `${SITE_REPOSITORY}/blob/main/plans/088-rose-sigil-oracle.md`;

/** An outside link, as the page's other outside links are drawn. */
function Outside({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <a href={href} rel="noreferrer">
      {children}
    </a>
  );
}

/**
 * How a Rose Cross sigil is drawn, below the generator (plan 088): the
 * Golden Dawn's rules as Regardie printed them, what his figures show
 * where the text is silent, how this generator applies them, and where to
 * read them.
 */
export default function SigilsText() {
  return (
    <PageText labelledBy="sigils-text">
      <H2 id="sigils-text">
        <UiRichText message={/*i18n*/ "How a Rose Cross sigil is drawn"} />
      </H2>
      <p>
        <UiRichText
          message={
            /*i18n*/ "The Golden Dawn drew the sigil of a name by tracing it through the letters of the Rose Cross. The rose at its centre carries the 22 letters of the Hebrew alphabet on three rings of petals: the three mother letters innermost, the seven double letters around them and the twelve single letters outside. Israel Regardie printed the Order's rules in <0>The Golden Dawn</0>, volume 4 (1940), with the sigils of Metatron, Elohim and the divine names of Binah drawn as examples. This generator follows those rules."
          }
          components={{ 0: <i /> }}
        />
      </p>

      <H3>
        <UiRichText message={/*i18n*/ "The rules"} />
      </H3>
      <List ordered>
        <li>
          <UiRichText
            message={/*i18n*/ "A small circle marks the first letter."}
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "A straight line runs from each letter to the next, in order, to the end of the word. Each word of a name is a sigil of its own; this page draws them side by side, right to left."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "Where a letter is doubled, as in the two Teths of Metatron, the line makes a crook or wave at that letter: one wave for each repeat, so a letter written three times has two."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "Where the line passes straight through a letter of the name, as Metatron's runs through Resh, a small loop beside the line marks the letter, so that the stop can be seen."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "A short bar across the line ends the sigil at the last letter."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "A final letter is traced at the place of its ordinary form, and anything else, such as vowel points, is left out."
            }
          />
        </li>
      </List>

      <H3>
        <UiRichText message={/*i18n*/ "What Regardie's figures show"} />
      </H3>
      <p>
        <UiRichText
          message={
            /*i18n*/ "The text leaves some cases open, and the worked sigils settle them:"
          }
        />
      </p>
      <List>
        <li>
          <UiRichText
            message={
              /*i18n*/ "A line that returns to a letter it has already visited, as YHVH returns to He, is drawn just beside the first visit, so the two strokes stay apart."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "A line that crosses a letter which is not in the name gets no mark."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "A line that crosses a letter of the name on its way somewhere else gets no loop either: only a letter the line passes through between its own neighbours does."
            }
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "Lines cross the centre of the rose, and each other, freely."
            }
          />
        </li>
      </List>

      <H3>
        <UiRichText message={/*i18n*/ "How this generator draws them"} />
      </H3>
      <p>
        <UiRichText
          message={
            /*i18n*/ "Regardie does not say how nearly straight a line must run to count as passing through a letter. The generator draws a loop only where the letter lies within one unit of the straight line between its neighbours, on a rose a hundred units across; any line bent more than that turns a visible corner instead."
          }
        />
      </p>
      <p>
        <UiRichText
          message={
            /*i18n*/ "Each letter's point is placed by these rules rather than adjusted by a numerical optimiser, so a name always gives the same sigil: on this page, in a downloaded image and in a shared link. Where a return or a mark would touch another line, the point moves within its letter's place until every mark stands clear. A long word can crowd the rose so that no such placement exists, and the page then says so."
          }
        />
      </p>
      <p>
        <UiRichText
          message={
            /*i18n*/ "The rose has two arrangements of the double letters. The Golden Dawn's, as The Equinox printed it in 1910, is the default; Regardie's edition of 1939 exchanges Kaph and Tau. Regardie's own sigils in volume 4 are drawn on the Golden Dawn's arrangement."
          }
        />
      </p>
      <p>
        <UiRichText
          message={
            /*i18n*/ "Try <0>Metatron</0>, <1>Elohim</1>, <2>YHVH Elohim</2> or <3>Shabbathai</3>, or the names of the <4>72 angels</4>, such as <5>Vehuiah</5>."
          }
          components={{
            0: <Link href={sigilHref("מטטרון")} />,
            1: <Link href={sigilHref("אלהים")} />,
            2: <Link href={sigilHref("יהוה אלהים")} />,
            3: <Link href={sigilHref("שבתאי")} />,
            4: <Link href="/kabbalah/yhvh/72angels" />,
            5: <Link href={sigilHref("והויה")} />,
          }}
        />
      </p>
      <p>
        <UiRichText
          message={
            /*i18n*/ "Every one of the <0>72 angels' pages</0> shows the sigil of its name, with the files to download, as <1>Vehuiah's</1> does."
          }
          components={{
            0: <Link href="/kabbalah/yhvh/72angels" />,
            1: <Link href="/kabbalah/angel/vehuiah" />,
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
              /*i18n*/ "Israel Regardie, <0>The Golden Dawn</0>, volume 4 (Aries Press, Chicago, 1940): the rules on <1>page 57</1>; Metatron and Elohim on <2>page 58</2>; the sigils of the names of Binah on <3>pages 59</3> and <4>60</4>. The scans are on archive.org. The book is in the public domain in the United States but still in copyright elsewhere, so its pages are linked rather than shown here."
            }
            components={{
              0: <i />,
              1: <Outside href={regardiePage(51)} />,
              2: <Outside href={regardiePage(52)} />,
              3: <Outside href={regardiePage(53)} />,
              4: <Outside href={regardiePage(54)} />,
            }}
          />
        </li>
        <li>
          <UiRichText
            message={
              /*i18n*/ "The rules, the figures' evidence and how the generator is tested against them, every pair and triple of letters included, are set out in <0>the project's design notes</0>."
            }
            components={{ 0: <Outside href={PLAN} /> }}
          />
        </li>
      </List>
    </PageText>
  );
}
