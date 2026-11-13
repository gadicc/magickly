import { H2, List, PageText } from "@/app/PageText";
import { SITE_REPOSITORY } from "@/seo/site";
import Link from "@/ui/Link";
import PackageCard from "./PackageCard";

/** A file in the repository, on GitHub. */
export const repositoryFile = (path: string) =>
  `${SITE_REPOSITORY}/blob/main/${path}`;

/** The data package's usage sample, exactly as its README gives it. */
export const DATA_USAGE = `import data from "magick-data";

const tiferet = data.sephirah.tiferet;
console.log(tiferet.name.roman, tiferet.planet?.symbol); // Tiferet ☉`;

/**
 * The licence policy, then a card per package (plan 080, decision 1 and
 * "The licence of a drawing that is code"). Until `magick-components` is
 * on npm (stage G), a served image of a component's drawing is credited to
 * Magick.ly under CC BY 4.0, as the hall pages and files say.
 */
export default function OpenSourceText() {
  return (
    <>
      <PageText labelledBy="licences">
        <H2 id="licences">Licences</H2>
        <p>Copyright (c) 2020–2026 Gadi Cohen.</p>
        <List>
          <li>
            <b>The app</b> is free software under the{" "}
            <Link href="https://www.gnu.org/licenses/agpl-3.0.html">
              GNU Affero General Public License
            </Link>
            , version 3 or any later version: you may use it, change it and run
            it, and anyone you serve it to may have its source (
            <Link href={repositoryFile("LICENSE.txt")}>LICENSE.txt</Link>).
          </li>
          <li>
            <b>The code of the data and the components</b> is MIT (
            <Link href={repositoryFile("packages/magick-data/LICENSE.txt")}>
              the data package&apos;s licence
            </Link>
            ,{" "}
            <Link
              href={repositoryFile("packages/magick-components/LICENSE.txt")}
            >
              the components&apos; licence
            </Link>
            ). That includes the drawings the components make: where a
            component&apos;s code is the drawing, as with the lamens and the
            temple halls&apos; art, its path data is code too, and MIT like the
            rest.
          </li>
          <li>
            <b>The data</b> is{" "}
            <Link href="https://creativecommons.org/licenses/by/4.0/">
              CC BY 4.0
            </Link>{" "}
            (
            <Link
              href={repositoryFile("packages/magick-data/LICENSE-DATA.txt")}
            >
              the licence text
            </Link>
            ), except where{" "}
            <Link
              href={`${SITE_REPOSITORY}/tree/main/packages/magick-data#sources`}
            >
              its README
            </Link>{" "}
            says no rights are asserted, as over public-domain texts and plain
            facts: use it anywhere, commercially too, as long as you credit
            Magick.ly.
          </li>
          <li>
            <b>The images the site draws or makes itself</b>, such as the Tree
            of Life, the tablets, the temple halls and its hand-drawn images,
            are CC BY 4.0 too, with credit to Magick.ly, wherever they are
            served: on its pages, as downloads or from its image API. The code
            that draws them is MIT, as above.
          </li>
          <li>
            <b>The fonts</b>: the site&apos;s text is set in Roboto and its
            Hebrew in Frank Ruhl Libre, the temple halls in subsets of Noto
            Serif and Frank Ruhl Libre, and the Tree of Life and other drawn
            images use Noto Sans, Noto Sans Hebrew, Noto Sans Symbols and Noto
            Sans Devanagari. All of these are under the SIL Open Font License
            1.1, as their authors released them; the licence texts are in the
            repository, in{" "}
            <Link href={`${SITE_REPOSITORY}/tree/main/public/fonts`}>
              <code>public/fonts</code>
            </Link>{" "}
            and{" "}
            <Link href={`${SITE_REPOSITORY}/tree/main/src/fonts/roboto`}>
              <code>src/fonts/roboto</code>
            </Link>
            .
          </li>
          <li>
            <b>Work by others</b> that the site shows, such as photographs from
            Wikimedia Commons and the places from GeoNames, keeps its own
            licence. The <Link href="/about#credits">credits</Link> on the About
            page name it.
          </li>
          <li>
            <b>The Enochian dictionary</b> is under none of these. Its entries
            come from two works whose rights are not ours to give, so it is not
            in the published data package.
          </li>
        </List>
      </PageText>
      <PageText labelledBy="packages">
        <H2 id="packages">The packages</H2>
        <p>
          Two packages hold the parts of the site most worth reusing: the data,
          and the components that draw from it.
        </p>
        <PackageCard
          name="magick-data"
          directory="packages/magick-data"
          published
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
            The site reads it as anyone else would.
          </p>
          <p>
            <Link href="/open-source/data">The data pages</Link> list every
            table, with its rows and what each of its fields means.
          </p>
        </PackageCard>
        <PackageCard
          name="magick-components"
          directory="packages/magick-components"
          published={false}
        >
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
            <Link href="/open-source/components">
              The components&apos; pages
            </Link>{" "}
            draw each one live, with its props to try and its reference.
          </p>
          <p>
            It is not on npm yet. Until it is, the components are in the
            app&apos;s repository, under <code>packages/magick-components</code>
            , where you may copy them under MIT.
          </p>
        </PackageCard>
      </PageText>
    </>
  );
}
