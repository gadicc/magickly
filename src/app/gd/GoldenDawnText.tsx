import { H2, H3, List, PageText } from "@/app/PageText";
import Link from "@/ui/Link";

/**
 * What the Golden Dawn section holds, below its tiles (plan 071, decision 4).
 */
export default function GoldenDawnText() {
  return (
    <PageText labelledBy="gd-text">
      <H2 id="gd-text">The Hermetic Order of the Golden Dawn</H2>
      <p>
        The Golden Dawn, founded in London in 1888, drew Kabbalah, astrology,
        alchemy, tarot and Enochian magick into one system of initiation. Its
        members rose through grades, each attributed to a Sephirah on the Tree
        of Life and conferred by ritual in a temple laid out for that grade.
        This section covers the grades, the rituals, the halls and the
        Order&apos;s symbols.
      </p>
      <H3>The grades</H3>
      <p>
        The <Link href="/gd/grades">grades</Link> climb the Tree from Malchut to
        Keter. Each one has a page:
      </p>
      <List>
        <li>
          <Link href="/gd/grade/0=0">Neophyte 0=0</Link>, the threshold, before
          the Tree
        </li>
        <li>
          <Link href="/gd/grade/1=10">Zelator 1=10</Link>: Malchut and Earth
        </li>
        <li>
          <Link href="/gd/grade/2=9">Theoricus 2=9</Link>: Yesod and Air
        </li>
        <li>
          <Link href="/gd/grade/3=8">Practicus 3=8</Link>: Hod and Water
        </li>
        <li>
          <Link href="/gd/grade/4=7">Philosophus 4=7</Link>: Netzach and Fire
        </li>
        <li>
          <Link href="/gd/grade/portal">Portal</Link>: Spirit, between the Outer
          and Inner Orders
        </li>
        <li>
          <Link href="/gd/grade/5=6">Adeptus Minor 5=6</Link>: Tiferet
        </li>
        <li>
          <Link href="/gd/grade/6=5">Adeptus Major 6=5</Link>: Gevurah
        </li>
        <li>
          <Link href="/gd/grade/7=4">Adeptus Exemptus 7=4</Link>: Chesed
        </li>
        <li>
          <Link href="/gd/grade/8=3">Magister Templi 8=3</Link>: Binah
        </li>
        <li>
          <Link href="/gd/grade/9=2">Magus 9=2</Link>: Chochmah
        </li>
        <li>
          <Link href="/gd/grade/10=1">Ipsissimus 10=1</Link>: Keter
        </li>
      </List>
      <H3>Rituals and temples</H3>
      <p>
        The <Link href="/gd/rituals">rituals</Link> page lays the grade rituals
        out for phones and tablets, among them the{" "}
        <Link href="/doc/neophyte">Neophyte</Link>,{" "}
        <Link href="/doc/zelator">Zelator</Link> and{" "}
        <Link href="/doc/theoricus">Theoricus</Link> as Israel Regardie
        published them. Members of a temple can also read its private rituals
        there. The <Link href="/gd/halls">temple halls</Link> give the floor
        plan of every Outer Order ceremony, from the{" "}
        <Link href="/gd/halls/neophyte">Neophyte hall</Link> to the Portal, with
        a <Link href="/gd/halls/editor">hall editor</Link> to design your own.
      </p>
      <H3>Sigils and symbols</H3>
      <p>
        The <Link href="/gd/sigils">Rose Cross sigil generator</Link> traces a
        Hebrew name on the Rose Cross. The{" "}
        <Link href="/gd/symbols">temple symbols</Link> are drawn as vector
        images: the <Link href="/gd/symbols/fylfot-cross">Fylfot Cross</Link>,
        the{" "}
        <Link href="/gd/symbols/candlestick">Seven-Branched Candlestick</Link>{" "}
        and the <Link href="/gd/symbols/shewbread">Table of Shewbread</Link>.
      </p>
    </PageText>
  );
}
