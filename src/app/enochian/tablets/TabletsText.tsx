import { H2, List, PageText } from "@/app/PageText";
import Link from "@/ui/Link";

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
        letters, and show the reversed letters and the second letters some
        squares carry. Beside the tablet, or under it on a phone, are two tabs.{" "}
        <i>Names</i> lists the names read off the tablet, grouped as it is
        built: the three holy names, the King and the six Seniors on the Great
        Cross, then each quarter&apos;s names, and in the Golden Dawn&apos;s
        versions its Kerubic archangel and servient angels, which put a letter
        of the Tablet of Union before their names. The Tablet of Union is a
        tablet of its own here, with its four lines and its first column; Dee
        and Raphael have none. Choose a name to see its squares on the tablet,
        from its first, with how the other versions and the sources spell it,
        where it is read and its dictionary entry; tap a square to find the
        names through it, or turn on <i>Show the regions</i> to tint the crosses
        and the top rows. <i>Differences</i> marks every square where the
        versions disagree: tap one to see what each version and source has
        there, and why. Each version comes with its sources and page references,
        and with how it differs from the others. Download the tablet as SVG or
        PNG as it is shown, and use <i>Copy page link</i> to share the page with
        the tablet and version you chose.
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
