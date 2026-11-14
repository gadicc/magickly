import { directoryUrl } from "@/app/open-source/PackageCard";
import { H2, List, PageText } from "@/app/PageText";
import Link from "@/ui/Link";

/**
 * What the components are and how to use them, below the tiles (plan 080,
 * decisions 5 and 7). The package is on npm from 0.1.0-rc.0 (stage G′),
 * and the hub's card offers the install.
 */
export default function ComponentsText() {
  return (
    <PageText labelledBy="about-the-components">
      <H2 id="about-the-components">About the components</H2>
      <p>
        These are the components of magick-components, the React package that
        draws the figures on this site from{" "}
        <Link href="/open-source#magick-data">magick-data</Link>: the{" "}
        <Link href="/kabbalah/tree">Tree of Life</Link>, the{" "}
        <Link href="/gd/halls">temple halls</Link>, the{" "}
        <Link href="/enochian/tablets">Enochian tablets</Link>, the{" "}
        <Link href="/gd/sigils">Rose Cross sigils</Link> and the rest. Each page
        draws its component live, from examples you can change: every control
        comes from the component&apos;s own props types, and the reference below
        it from their documentation.
      </p>
      <List>
        <li>
          <b>Their code is MIT</b>, the drawings it makes included, and the
          temple halls&apos; font subsets are under the SIL Open Font License.
          The <Link href="/open-source#licences">licences</Link> say more.
        </li>
        <li>
          <b>They are on npm</b> as{" "}
          <Link href="/open-source#magick-components">magick-components</Link>,
          and each page shows the line that imports its component. Their source
          is in{" "}
          <Link href={directoryUrl("packages/magick-components")}>
            the app&apos;s repository
          </Link>
          .
        </li>
        <li>
          <b>Most render on the server</b> as plain SVG, with no client code.
          The Rose Cross sigil, the Moon and Mercury run in the browser: the
          sigil spreads its letters with an optimiser, and the other two work
          from today&apos;s date.
        </li>
      </List>
    </PageText>
  );
}
