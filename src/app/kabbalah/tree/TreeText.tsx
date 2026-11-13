import { H2, List, PageText } from "@/app/PageText";
import Link from "@/ui/Link";

/**
 * What the Tree shows and how to set it, below the diagram (plan 071, decision 5).
 */
export default function TreeText() {
  return (
    <PageText labelledBy="tree-text">
      <H2 id="tree-text">About the Tree of Life</H2>
      <p>
        The Tree of Life is Kabbalah&apos;s map of creation: ten Sephiroth
        joined by twenty-two paths, each path carrying a Hebrew letter and a
        tarot trump. This diagram is drawn from the site&apos;s own data, and
        every sphere and path in it links to a page of its own.
      </p>
      <H2>How to use it</H2>
      <List>
        <li>
          <b>Text on each Sephirah</b>: choose what appears above, in the centre
          and below each sphere. The choices include its number; its Roman,
          Hebrew or English name; its god name, archangel and angelic order; its
          planet; its Golden Dawn grade; and its chakra, part of the soul, body
          parts, scents or stones.
        </li>
        <li>
          <b>Colour</b>: the King scale (projective) or the Queen scale
          (receptive).
        </li>
        <li>
          <b>Letter attribution</b>: the Western Hermetic tree, as the Golden
          Dawn used it, or the Hebrew tree, which gives many paths different
          letters and draws two paths in place of two of the Hermetic
          tree&apos;s.
        </li>
        <li>
          <b>Flip the tree</b> to see it from behind, as it lies on the body.
        </li>
        <li>
          <b>Show Da&apos;at</b>, the hidden Sephirah, which the Queen scale
          colours.
        </li>
      </List>
      <p>
        Download the diagram as SVG or PNG, copy it to the clipboard, or copy a
        link that opens the Tree with your settings.
      </p>
      <H2>The paths</H2>
      <p>
        Tap a sphere or path on the diagram to open its page. The paths run from
        the <Link href="/kabbalah/path/1_2">11th</Link>, Aleph and the Fool, to
        the <Link href="/kabbalah/path/9_10">32nd</Link>, Tav and the Universe.
      </p>
      <H2>Related</H2>
      <List>
        <li>
          <Link href="/gd/grades">The Golden Dawn grades</Link>, placed on the
          same Tree
        </li>
        <li>
          <Link href="/kabbalah/yhvh/72angels">
            The 72 angels of the Shem HaMephorash
          </Link>
        </li>
        <li>
          <Link href="/kabbalah">Kabbalah</Link>
        </li>
      </List>
    </PageText>
  );
}
