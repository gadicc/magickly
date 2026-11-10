import Link from "@magick-components/Link";
import { Box, Container, Typography } from "@mui/material";

const h2 = { variant: "h5", component: "h2", sx: { mt: 3, mb: 1 } } as const;

/**
 * What the Keys are and where this page's words come from, below the Keys
 * themselves (plan 071, decision 4; plan 073). What each Key was checked
 * against is said under the Key, from its own record, not here.
 */
export default function KeysAbout() {
  return (
    <Container
      maxWidth="md"
      component="section"
      aria-labelledby="keys-about"
      sx={{ my: 4 }}
    >
      <Typography {...h2} id="keys-about">
        The Enochian Keys
      </Typography>
      <p>
        The Keys, or Calls, are invocations in the Enochian language, given to
        John Dee through the scryer Edward Kelley in Cracow between April and
        July 1584, with an English rendering Dee wrote down word by word for the
        first four Keys, and as running text for the rest, which this page
        divides among the words. This page has all nineteen. The nineteenth is
        the Call of the Thirty Aethyrs: one Call, said thirty times with the
        name of each Aethyr in its place, so Dee counted forty-eight Calls in
        all. Choose the Aethyr to read the Call for it.
      </p>
      <p>
        Every word is read from public-domain prints: Dee&apos;s journal as
        Meric Casaubon printed it in 1659, for Dee&apos;s spelling and his
        English, and Aleister Crowley&apos;s <i>The Equinox</i> of 1912, for the
        Golden Dawn&apos;s. Where the 1659 print is damaged, the page says so.
        It has lost parts of Keys 13 to 16, most of Keys 14 and 15, where the
        page gives Crowley&apos;s form instead, marked as his. Under each Key
        the page says what it was checked against, and what not.
      </p>

      <Typography {...h2}>Reading the Keys</Typography>
      <p>Open any Key to read it, and choose how:</p>
      <Box component="ul" sx={{ pl: 3 }}>
        <li>
          <b>English</b>: Dee&apos;s English, as continuous text.
        </li>
        <li>
          <b>Enochian</b>: the Enochian words, in Latin letters or, with the
          font switch, in the Enochian script.
        </li>
        <li>
          <b>Both</b>: every word in order, numbered (1.1, 1.2…), beside its
          English, for study or for learning a Key by heart.
        </li>
      </Box>
      <p>
        The version switch gives Dee&apos;s spelling, the default, or the Golden
        Dawn&apos;s, which joins or splits some of Dee&apos;s words as it was
        spoken in the Order. Tap any word to open its entry from the{" "}
        <Link href="/enochian/dictionary">Enochian dictionary</Link>: the
        pronunciation, the meanings from each source and the gematria. The
        dictionary comes from other transcriptions, so some words are filed
        under another spelling or as two words; the page finds those, and says
        when a word is not in it.
      </p>

      <Typography {...h2}>Related</Typography>
      <Box component="ul" sx={{ pl: 3 }}>
        <li>
          <Link href="/enochian/dictionary">The Enochian dictionary</Link>:
          every word, searchable
        </li>
        <li>
          <Link href="/enochian/tablets">The Enochian tablets</Link>: the four
          Watchtowers and the Tablet of Union
        </li>
        <li>
          <Link href="/enochian/oration">Dee&apos;s Oration to God</Link>
        </li>
        <li>
          <Link href="/enochian">Enochian</Link>
        </li>
      </Box>
    </Container>
  );
}
