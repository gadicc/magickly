import Link from "@magick-components/Link";
import { H2, List, PageText } from "@/app/PageText";

/**
 * How to use the tablets page, below the tablet; the tablets and their
 * versions are described above it, from their notes (plan 071, decision 5).
 */
export default function TabletsText() {
  return (
    <PageText labelledBy="tablets-text">
      <H2 id="tablets-text">Using this page</H2>
      <p>
        Choose a tablet and a version. Switch between Latin and Enochian
        letters, show the reversed letters and the second letters some squares
        carry, or turn on <i>Show where the sources differ</i> to mark every
        square where the versions disagree. Tap a square to see what each
        version and source has there, and why. Each version comes with its
        sources and page references, and with how it differs from the others.
        Download the tablet as SVG or PNG.
      </p>
      <H2>Related</H2>
      <List>
        <li>
          <Link href="/enochian/keys">The Enochian Keys</Link> and{" "}
          <Link href="/enochian/dictionary">dictionary</Link>
        </li>
        <li>
          The tablets in the{" "}
          <Link href="/gd/halls">Golden Dawn temple halls</Link>: Earth in the{" "}
          <Link href="/gd/halls/zelator-1">Zelator hall</Link>, Air in the{" "}
          <Link href="/gd/halls/theoricus-1">Theoricus 32nd path hall</Link>,
          Fire in the{" "}
          <Link href="/gd/halls/philosophus-1">Philosophus 29th path hall</Link>
          , and the Tablet of Union in the{" "}
          <Link href="/gd/halls/portal-1">Portal</Link>
        </li>
      </List>
    </PageText>
  );
}
