import type { ReactNode } from "react";
import styles from "./oration.module.css";
import {
  jamesPage,
  READINGS,
  type ReadingId,
  readingAnchor,
  readingLetter,
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
 * Where James's wording differs from Dee's, each under the letter that marks
 * it in the prayer: beside the prayer from 1,200 px, below it on narrower
 * screens (`Oration` places it). Spellings alone are not noted here; the
 * text below the prayer names them.
 */
export default function ReadingNotes() {
  return (
    <>
      <h2 id="oration-readings" className={styles.label}>
        Where James differs
      </h2>
      <ul className={styles.entries}>
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
      </ul>
    </>
  );
}
