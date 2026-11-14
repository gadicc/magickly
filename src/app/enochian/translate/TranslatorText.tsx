import { H2, List, PageText } from "@/app/PageText";
import Link from "@/ui/Link";

/**
 * What the translator does and how to read it, below the tool (plan 081,
 * step E; plan 071, decision 5). Our own words.
 */
export default function TranslatorText() {
  return (
    <PageText labelledBy="translator-text">
      <H2 id="translator-text">About the translator</H2>
      <p>
        This translator works by looking words up, both ways: English into
        Enochian, and Enochian into English. It looks in Dee&apos;s nineteen
        Keys first, where every Enochian word stands beside Dee&apos;s own
        English, then in our dictionary of 1,911 words. It doesn&apos;t
        understand sentences, and it never invents a word: every word it gives
        has a source, and the source is shown.
      </p>
      <p>
        Type in either box. The first takes English or Enochian in Latin
        letters; the second shows the same text in the Enochian script, written
        right to left, and opens a keypad of the twenty-one letters when you tap
        it. The translator guesses which way to read your text from how many of
        its words are English and how many are Enochian, and says which it
        chose. If it guessed wrong, use the switch. A word or two that could be
        either, such as <i>I</i>, is read both ways.
      </p>
      <H2>English into Enochian</H2>
      <p>Each English word becomes one of three things:</p>
      <List>
        <li>
          a <b>form</b>: an Enochian word, shown in Latin letters and in the
          script over the English it stands for, with where it comes from. A
          place such as Key 1.3 is the third word of the first Key; a form from
          the dictionary names the book its meaning comes from. A form that only
          nearly matches says so, and a word with other possible forms offers
          them, each with its source;
        </li>
        <li>
          a <b>rule chip</b>, for a word our grammar notes leave out or change:
          Enochian has no word for &quot;the&quot;, writes &quot;of&quot; by
          putting the owner after the thing owned, and gives most verbs one form
          for every tense. Tap a chip to read the note behind it, with its
          sources;
        </li>
        <li>
          a <b>gap</b>, for a word we have no Enochian for, with the nearest
          forms we have when there are any.
        </li>
      </List>
      <p>
        Possessives follow their noun, as Dee writes them, so &quot;her
        house&quot; becomes SALMAN TILB, and each word moved says so. Phrases
        Dee translated whole come first: &quot;over you&quot; is his VORSG, one
        word. Everyday English leaves many gaps, since the Keys say little about
        trains or telephones.
      </p>
      <H2>Enochian into English</H2>
      <p>
        The reading comes first. Where your words follow Dee&apos;s lines in the
        Keys, it gives his own English; elsewhere it goes word by word, and says
        so. Some of Dee&apos;s English runs across several Enochian words, and
        where we had to divide it between them, that division is ours and is
        marked with angle brackets.
      </p>
      <p>
        Below the reading, each word shows what it was read as and why: a place
        in the Keys, a dictionary entry, a Golden Dawn spelling from the form
        Crowley printed in 1912, or one of Aaron Leitch&apos;s spellings, with
        its page. A word written joined to another, such as DSSALMAN, DS
        &quot;which&quot; and SALMAN &quot;the house&quot;, is split by a rule
        from our notes, and the split says which rule made it. A word we
        don&apos;t have shows the nearest spellings we do.
      </p>
      <p>
        Tap any word to open its dictionary entry, beside the results on a wide
        screen or rising from the foot of the screen on a phone. A word found
        only in the Keys opens the places Dee uses it.
      </p>
      <H2>Your text stays with you</H2>
      <p>
        The translation runs in your browser, and what you type isn&apos;t sent
        anywhere. The page&apos;s address keeps your text after the # sign,
        which browsers never send to a website, so you can share a translation
        by its link.
      </p>
      <H2>Related</H2>
      <List>
        <li>
          <Link href="/enochian/dictionary">The Enochian dictionary</Link>, to
          look up one word at a time
        </li>
        <li>
          <Link href="/enochian/keys">The Enochian Keys</Link>, Dee&apos;s own
          text, word by word
        </li>
        <li>
          <Link href="/enochian">Enochian</Link>
        </li>
      </List>
    </PageText>
  );
}
