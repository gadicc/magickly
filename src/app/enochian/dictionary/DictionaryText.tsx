import Link from "@magick-components/Link";
import { H2, List, PageText } from "@/app/PageText";

/**
 * What the dictionary holds and how to search it, below it (plan 071,
 * decision 5); rewritten for English search (plan 074).
 */
export default function DictionaryText() {
  return (
    <PageText labelledBy="dictionary-text">
      <H2 id="dictionary-text">About the dictionary</H2>
      <p>
        This is a searchable dictionary of 1,911 Enochian words, the language
        Dee and Kelley recorded in the 1580s. Every word is shown in Latin
        letters and in the Enochian script, with its meaning.
      </p>
      <H2>How to search</H2>
      <p>
        Type an English word, such as <i>light</i> or <i>power</i>, or an
        Enochian one, such as <i>OL</i>. The search looks both ways at once:
      </p>
      <List>
        <li>a word you have spelled exactly is shown first,</li>
        <li>
          then the words that mean what you typed, and the words whose meanings
          mention it,
        </li>
        <li>
          then the words spelled with your letters, which come first when you
          have typed no English word.
        </li>
      </List>
      <p>
        The right-hand box shows the same search in Enochian letters, written
        right to left as the script runs. Tap it to type with the Enochian
        letters themselves. Enochian writes C and K, I, Y and J, and U, V and W
        each as one letter, so the search takes them as one.
      </p>
      <p>
        Tap a word to open its entry, beside the list on a wide screen or rising
        from the foot of the screen on a phone. An entry gives:
      </p>
      <List>
        <li>the word in Latin letters and in Enochian,</li>
        <li>its pronunciation, where one is recorded,</li>
        <li>each meaning, with the source it comes from,</li>
        <li>its gematria, the numerical value of its letters, where known,</li>
        <li>
          and where the Keys use the word, with Dee&apos;s English around it.
        </li>
      </List>
      <p>
        The page&apos;s address keeps your search and the word you opened, so
        you can share either. The dictionary finds words and short phrases; it
        won&apos;t translate a sentence. To meet the words in use, read{" "}
        <Link href="/enochian/keys">the Keys</Link>, where you can tap any word
        to see its entry, with Dee&apos;s own English beside it.
      </p>
      <H2>Sources</H2>
      <p>
        Each meaning names its source. EMPM is Gerald Schueler&apos;s{" "}
        <i>Enochian Magic: A Practical Manual</i>, whose scheme the
        pronunciations follow (&quot;ah&quot; for A, &quot;zod&quot; for Z). WE
        is <i>The Whole Enochian Dictionary</i>, an anonymous compilation. A few
        meanings come from the Keys themselves.
      </p>
      <H2>Related</H2>
      <List>
        <li>
          <Link href="/enochian/keys">The Enochian Keys</Link>
        </li>
        <li>
          <Link href="/enochian/tablets">The Enochian tablets</Link>
        </li>
        <li>
          <Link href="/study?tags=enochian">Flashcards</Link> for the twenty-one
          letters
        </li>
        <li>
          <Link href="/enochian">Enochian</Link>
        </li>
      </List>
    </PageText>
  );
}
