import Link from "@magick-components/Link";
import { H2, List, PageText } from "@/app/PageText";

/**
 * What the dictionary holds and how to search it, below it (plan 071, decision 5).
 */
export default function DictionaryText() {
  return (
    <PageText labelledBy="dictionary-text">
      <H2 id="dictionary-text">About the dictionary</H2>
      <p>
        This is a searchable dictionary of 1,911 Enochian words, the language
        Dee and Kelley recorded in the 1580s. Every word is shown in Latin
        letters and in the Enochian script.
      </p>
      <H2>How to search</H2>
      <p>
        Type into either box. The left box takes Latin letters. The right box
        shows what you type in Enochian letters, written right to left as the
        script runs. The list narrows to the words that contain what you have
        typed. Tap a word, or type it whole, to open its entry at the foot of
        the screen, which gives:
      </p>
      <List>
        <li>the word in Latin letters and in Enochian,</li>
        <li>its pronunciation, where one is recorded,</li>
        <li>each meaning, with the source it comes from,</li>
        <li>
          and its gematria, the numerical value of its letters, where known.
        </li>
      </List>
      <p>
        The dictionary looks words up from Enochian, not from English, so it
        won&apos;t translate an English sentence. To meet the words in use, read{" "}
        <Link href="/enochian/keys">the Keys</Link>. There you can tap any word
        to see its entry, with Dee&apos;s own English beside it. U and V were
        one letter in Dee&apos;s day, so a word missing under one spelling may
        be filed under the other.
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
