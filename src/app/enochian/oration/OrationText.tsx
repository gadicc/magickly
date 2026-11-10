import Link from "@magick-components/Link";
import { H2, List, PageText } from "@/app/PageText";

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
      <H2>Using it</H2>
      <p>
        The blank in the prayer is where you say your own name. Say the whole
        prayer three times in succession, as its heading directs.
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
