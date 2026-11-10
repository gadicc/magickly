import Link from "@magick-components/Link";
import { H2, List, PageText } from "@/app/PageText";

/**
 * How the halls follow the grades and paths, below the index (plan 071,
 * decision 5).
 */
export default function HallsText() {
  return (
    <PageText labelledBy="halls-text">
      <H2 id="halls-text">Halls and paths</H2>
      <p>
        The Neophyte&apos;s ceremony has one hall and the Zelator&apos;s two.
        From Theoricus on, a grade has a hall for each path the candidate
        travels and one in the grade&apos;s Sephirah: two for Theoricus, three
        for Practicus and four for Philosophus. The Portal, between the Outer
        and Inner Orders, has two. Each hall&apos;s page also says which sources
        its plan follows and where they disagree.
      </p>
      <H2>Related</H2>
      <List>
        <li>
          <Link href="/gd/grades">The grades</Link>:{" "}
          <Link href="/gd/grade/0=0">Neophyte</Link>,{" "}
          <Link href="/gd/grade/1=10">Zelator</Link>,{" "}
          <Link href="/gd/grade/2=9">Theoricus</Link>,{" "}
          <Link href="/gd/grade/3=8">Practicus</Link>,{" "}
          <Link href="/gd/grade/4=7">Philosophus</Link> and the{" "}
          <Link href="/gd/grade/portal">Portal</Link>
        </li>
        <li>
          <Link href="/gd/rituals">The rituals</Link>, among them the{" "}
          <Link href="/doc/neophyte">Neophyte ritual</Link>
        </li>
        <li>
          The paths on the <Link href="/kabbalah/tree">Tree of Life</Link>, from
          the <Link href="/kabbalah/path/9_10">32nd</Link> to the{" "}
          <Link href="/kabbalah/path/7_8">27th</Link>
        </li>
        <li>
          <Link href="/enochian/tablets">The Enochian tablets</Link>, which
          stand in several halls
        </li>
      </List>
    </PageText>
  );
}
