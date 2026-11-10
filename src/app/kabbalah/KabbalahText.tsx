import Link from "@magick-components/Link";
import { H2, H3, List, PageText } from "@/app/PageText";

/**
 * What the Kabbalah section holds, below its tiles (plan 071, decision 4).
 */
export default function KabbalahText() {
  return (
    <PageText labelledBy="kabbalah-text">
      <H2 id="kabbalah-text">Hermetic Kabbalah</H2>
      <p>
        Kabbalah, as the Hermetic tradition and the Golden Dawn use it, maps
        creation on the Tree of Life: ten Sephiroth, or spheres, joined by
        twenty-two paths. This section gives the Tree as a diagram you can
        configure, a page for each sphere and path, and the 72 angels of the
        Shem HaMephorash.
      </p>
      <H3>The Tree of Life</H3>
      <p>
        The <Link href="/kabbalah/tree">interactive Tree of Life</Link> shows
        the names, colours and letters you choose, and exports the diagram as an
        image. Each Sephirah has its own page with its Hebrew name, god name,
        archangel, angelic host and King and Queen scale colours:
      </p>
      <List ordered>
        <li>
          <Link href="/kabbalah/sephirah/keter">Keter</Link>, the Crown
        </li>
        <li>
          <Link href="/kabbalah/sephirah/chochmah">Chochmah</Link>, Wisdom
        </li>
        <li>
          <Link href="/kabbalah/sephirah/binah">Binah</Link>, Understanding
        </li>
        <li>
          <Link href="/kabbalah/sephirah/hesed">Chesed</Link>, Mercy
        </li>
        <li>
          <Link href="/kabbalah/sephirah/gevurah">Gevurah</Link>, Strength
        </li>
        <li>
          <Link href="/kabbalah/sephirah/tiferet">Tiferet</Link>, Beauty
        </li>
        <li>
          <Link href="/kabbalah/sephirah/netzach">Netzach</Link>, Victory
        </li>
        <li>
          <Link href="/kabbalah/sephirah/hod">Hod</Link>, Splendour
        </li>
        <li>
          <Link href="/kabbalah/sephirah/yesod">Yesod</Link>, Foundation
        </li>
        <li>
          <Link href="/kabbalah/sephirah/malchut">Malchut</Link>, the Kingdom
        </li>
      </List>
      <p>
        <Link href="/kabbalah/sephirah/daat">Da&apos;at</Link>, Knowledge, is
        the hidden Sephirah, outside the count of ten. The paths are numbered 11
        to 32, from the <Link href="/kabbalah/path/1_2">11th path</Link>, Keter
        to Chochmah, to the <Link href="/kabbalah/path/9_10">32nd</Link>, Yesod
        to Malchut. Each path has a Hebrew letter and a tarot trump, and its
        page also gives the Hebrew tree&apos;s letter where it differs.
      </p>
      <H3>The Shem HaMephorash</H3>
      <p>
        The <Link href="/kabbalah/yhvh">Shem HaMephorash</Link> is the 72-fold
        name of God drawn from Exodus 14:19–21. Christian Kabbalah made each of
        its 72 parts the name of an angel. The{" "}
        <Link href="/kabbalah/yhvh/72angels">72 angels</Link> are listed with
        their dates and attributes from Lazare Lenain&apos;s{" "}
        <Link href="/books/la-science-cabalistique">
          La Science Cabalistique
        </Link>{" "}
        (1823). Each has a page of its own, with its Hebrew name, beginning with{" "}
        <Link href="/kabbalah/angel/vehuiah">Vehuiah</Link>.
      </p>
      <p>
        The Golden Dawn places its <Link href="/gd/grades">grades</Link> on the
        same Tree, from Zelator in Malchut to Ipsissimus in Keter.
      </p>
    </PageText>
  );
}
