import Link from "@magick-components/Link";
import { H2, List, PageText } from "@/app/PageText";
import { SITE_REPOSITORY } from "@/seo/site";
import PackageCard from "./PackageCard";

const file = (path: string) => `${SITE_REPOSITORY}/blob/main/${path}`;

/** The data package's usage sample, as its README gives it. */
const DATA_USAGE = `import data from "magick-data";

const tiferet = data.sephirah.tiferet;
console.log(tiferet.name.roman, tiferet.planet?.symbol); // Tiferet ☉`;

/**
 * The licence policy, then a card per package (plan 080, decision 1 and
 * "The licence of a drawing that is code").
 */
export default function OpenSourceText() {
  return (
    <>
      <PageText labelledBy="licences">
        <H2 id="licences">Licences</H2>
        <p>Copyright © 2020–2026 Gadi Cohen.</p>
        <List>
          <li>
            <b>The app</b> is free software under the{" "}
            <Link href="https://www.gnu.org/licenses/agpl-3.0.html">
              GNU Affero General Public License
            </Link>
            , version 3 or any later version: you may use it, change it and run
            it, and anyone you serve it to may have its source (
            <Link href={file("LICENSE.txt")}>LICENSE.txt</Link>).
          </li>
          <li>
            <b>The packages&apos; code</b> is{" "}
            <Link href="https://opensource.org/license/mit">MIT</Link>, the
            drawings the components make included. Where a component&apos;s code
            is the drawing, as with the lamens and the temple halls&apos; art,
            its path data is code too, so you may take the drawing from the
            package under MIT.
          </li>
          <li>
            <b>The data</b> and the site&apos;s hand-drawn images are{" "}
            <Link href="https://creativecommons.org/licenses/by/4.0/">
              CC BY 4.0
            </Link>
            : use them anywhere, commercially too, as long as you credit{" "}
            <Link href="/">magick.ly</Link>. The images the site serves, on its
            pages, as downloads and from its image API, are CC BY 4.0 as well.
            Where one is a component&apos;s drawing, though, anyone may draw the
            same image from the code under MIT, so credit it as drawn by
            magick-components (MIT).
          </li>
          <li>
            <b>The fonts</b> the temple halls are lettered in, subsets of Noto
            Serif and Frank Ruhl Libre, are under the SIL Open Font License 1.1,
            as their authors released them (
            <Link href={file("public/fonts/NotoSerif-OFL.txt")}>
              Noto Serif
            </Link>
            ,{" "}
            <Link href={file("public/fonts/FrankRuhlLibre-OFL.txt")}>
              Frank Ruhl Libre
            </Link>
            ).
          </li>
          <li>
            <b>Work by others</b> that the site shows, such as photographs from
            Wikimedia Commons and the places from GeoNames, keeps its own
            licence and is credited on the{" "}
            <Link href="/about#credits">About</Link> page.
          </li>
          <li>
            <b>The Enochian dictionary</b> is under none of these. Its entries
            come from two works whose rights are not ours to give, so it stays
            in the app and out of the data package.
          </li>
        </List>
      </PageText>
      <PageText labelledBy="packages">
        <H2 id="packages">The packages</H2>
        <p>
          Two packages hold the parts of the site most worth reusing. The app
          reads them as anyone else would.
        </p>
        <PackageCard
          name="magick-data"
          directory="packages/magick-data"
          usage={DATA_USAGE}
        >
          <p>
            Magickal correspondences and reference data: the sephirot, the
            planets, the zodiac, the Hebrew and Enochian letters, the Golden
            Dawn grades, the geomantic figures and more, as typed tables of
            plain rows, with a graph of how they link and the code that joins
            them. Its code is MIT and its data CC BY 4.0. It is ES modules only,
            has no runtime dependencies, and carries its own TypeScript types.
            From 0.1.0, its releases are published by CI with npm provenance.
          </p>
        </PackageCard>
        <PackageCard name="magick-components" directory="src/components">
          <p>
            React components that draw from that data: the{" "}
            <Link href="/kabbalah/tree">Tree of Life</Link>, the{" "}
            <Link href="/enochian/tablets">Enochian tablets</Link>, the{" "}
            <Link href="/gd/sigils">Rose Cross sigils</Link>, the{" "}
            <Link href="/gd/symbols/candlestick">
              Seven-Branched Candlestick
            </Link>
            , the <Link href="/gd/symbols/shewbread">Table of Shewbread</Link>,
            the <Link href="/gd/halls">temple halls</Link> and more. Their code
            is MIT, and so are the drawings they make.
          </p>
          <p>
            It is not on npm yet. Until it is, the components are in the
            app&apos;s repository, under <code>src/components</code>.
          </p>
        </PackageCard>
      </PageText>
    </>
  );
}
