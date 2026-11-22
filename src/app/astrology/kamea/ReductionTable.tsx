import UiText from "@/i18n/UiText";
import styles from "./reduction.module.css";
import type { ReducedLetter } from "./sigils/reduction";

/**
 * A traced name's reduction (plan 093, decision 3), as the generator and
 * the names' pages show it: each letter, its number and the cell it falls
 * on, word by word under a heading where the name has more than one. No
 * hooks, so a server page and the generator's client page both draw it.
 */
export default function ReductionTable({
  reduction,
  caption = /*i18n*/ "Each letter, its number and its cell",
}: {
  /** Each word's letters, as `reduceOnKamea` gives them. */
  reduction: ReducedLetter[][];
  /** The caption's message. */
  caption?: string;
}) {
  if (!reduction.length) return null;
  return (
    <table className={styles.reduction}>
      <caption>
        <UiText message={caption} />
      </caption>
      <thead>
        <tr>
          <th scope="col">
            <UiText message={/*i18n*/ "Letter"} />
          </th>
          <th scope="col">
            <UiText message={/*i18n*/ "Number"} />
          </th>
          <th scope="col">
            <UiText message={/*i18n*/ "Cell"} />
          </th>
        </tr>
      </thead>
      {reduction.map((word, w) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: words in reading order
        <tbody key={w}>
          {reduction.length > 1 && (
            <tr>
              <th scope="rowgroup" colSpan={3} className={styles.word}>
                <UiText
                  message={/*i18n*/ "Word {number}"}
                  values={{ number: w + 1 }}
                />{" "}
                <span lang="he" dir="rtl" className={styles.hebrew}>
                  {word.map((letter) => letter.letter).join("")}
                </span>
              </th>
            </tr>
          )}
          {word.map((letter, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: letters in order
            <tr key={i}>
              <td lang="he" dir="rtl" className={styles.hebrew}>
                {letter.letter}
              </td>
              <td>{letter.value}</td>
              <td>{letter.cell}</td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}
