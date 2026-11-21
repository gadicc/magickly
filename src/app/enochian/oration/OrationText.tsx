import type { ReactNode } from "react";
import { H2, List, PageText } from "@/app/PageText";
import Link from "@/ui/Link";
import {
  jamesPage,
  PETERSON,
  READINGS,
  type ReadingId,
  readingAnchor,
  readingLetter,
  SLOANE_3191,
} from "./readings";

/**
 * A change of wording's note: its letter, Dee's words and James's, with the
 * page of James that has them, then what we make of it.
 */
function Wording({ id, children }: { id: ReadingId; children?: ReactNode }) {
  const { dee, james, leaf } = READINGS[id];
  return (
    <li id={readingAnchor(id)}>
      <b>{readingLetter(id)}.</b> Dee: &quot;{dee.replace(/,$/, "")}&quot;.
      James,{" "}
      <a href={jamesPage(leaf)} rel="noreferrer">
        p. {leaf === 38 ? 53 : 54}
      </a>
      : {james ? <>&quot;{james}&quot;.</> : "leaves it out."} {children}
    </li>
  );
}

/**
 * Where the Oration comes from and how it is said, below it (plan 071, decision 5).
 */
export default function OrationText() {
  return (
    <PageText labelledBy="oration-text">
      <H2 id="oration-text">About the Oration</H2>
      <p>
        John Dee wrote this prayer to be said every day, three times over. In it
        he asks God for a share of true knowledge of the laws and natures of
        created things, and he recalls that an orderly form of working, the
        Heptarchic, had been given to him through the eye and ear of &quot;E.
        K.&quot;, Edward Kelley. He asks to enjoy the help of the good angels in
        that work: Michael, Gabriel, Raphael and Uriel, and those of the
        Heptarchic mystery, the seven kings and their seven princes with their
        ministers.
      </p>
      <p>
        The Heptarchic system belongs to Dee&apos;s earlier sessions, before the
        Keys and the great tables, so the Oration stands near the start of the
        Enochian work. Dee&apos;s journals of those sessions, 1581 to 1583, are
        British Library Sloane MS 3188.
      </p>
      <H2 id="oration-text-source">The text</H2>
      <p>
        Dee wrote the prayer out as chapter 5 of his{" "}
        <i>De Heptarchia Mystica</i>, in his own hand in{" "}
        <a href={SLOANE_3191} rel="noreferrer">
          British Library Sloane MS 3191
        </a>
        , ff. 45r–45v; Elias Ashmole&apos;s copy is Sloane MS 3678. The Library
        has photographed the manuscript, but its images are offline (November
        2026), so we read Dee&apos;s text in{" "}
        <a href={PETERSON} rel="noreferrer">
          Joseph H. Peterson&apos;s transcription
        </a>
        . The prayer above keeps Dee&apos;s words, punctuation and capitals, and
        Peterson&apos;s paragraph break; we have modernised the spelling, and
        read two slips in the transcription, &quot;huing GOD&quot; and &quot;foe
        euer&quot;, as &quot;living GOD&quot; and &quot;for ever&quot;. Where
        the prayer has a blank, Dee wrote his own name: &quot;thy simple servant
        John Dee&quot;.
      </p>
      <p>
        Geoffrey James printed the prayer in modern spelling in{" "}
        <i>The Enochian Magick of Dr. John Dee</i> (Llewellyn, 1994; first
        published by Heptangle in 1984 as{" "}
        <i>The Enochian Evocation of Dr. John Dee</i>), pp.{" "}
        <a href={jamesPage(38)} rel="noreferrer">
          53
        </a>
        –
        <a href={jamesPage(39)} rel="noreferrer">
          55
        </a>
        . To read along with his book, choose his version above: the prayer then
        has his words, still with Dee&apos;s punctuation and capitals. We
        compared his pages with Peterson&apos;s transcription word by word
        (November 2026). Besides spelling three words his own way
        (&quot;Æternal&quot;, &quot;forever&quot; and &quot;forme&quot;), James
        differs from Dee in five places, marked with a letter in the prayer:
      </p>
      <List>
        <Wording id="who">
          Dee&apos;s &quot;Who&quot; carries the sentence on from &quot;to have
          Compassion upon me&quot;; James starts a new one.
        </Wording>
        <Wording id="manifest">
          Without these words James&apos;s &quot;being to me made and allure
          me&quot; does not parse: most likely a slip in copying.
        </Wording>
        <Wording id="majestical" />
        <Wording id="urgent" />
        <Wording id="isagogically">
          &quot;Isagogically&quot; is Peterson&apos;s reading, that is, by way
          of introduction, which fits the &quot;(as yet,) and very briefly, unto
          me declared&quot; that follows. Only the manuscript, or Ashmole&apos;s
          copy, can settle which word Dee wrote.
        </Wording>
      </List>
      <H2>Using it</H2>
      <p>
        The blank in the prayer is where you say your own name. Dee&apos;s
        heading asks for the prayer every day, &quot;tribus vicibus, ter&quot;:
        three times, thrice. That may mean three times in a row, as James took
        it (&quot;three times successively&quot;), or three times a day, saying
        it three times at each; Dee does not say which.
      </p>
      <H2>Related</H2>
      <List>
        <li>
          <Link href="/enochian/keys">The Enochian Keys</Link>: the Calls, in
          English and Enochian
        </li>
        <li>
          <Link href="/enochian/tablets">The Enochian tablets</Link>: the four
          Watchtowers
        </li>
        <li>
          <Link href="/enochian/dictionary">The Enochian dictionary</Link>
        </li>
        <li>
          <Link href="/enochian">Enochian</Link>
        </li>
      </List>
    </PageText>
  );
}
