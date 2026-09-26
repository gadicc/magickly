/**
 * The pieces every entity page is built from (plan 036), extracted from the
 * angel page: the site's frame, a trail back to the list, the figure between
 * its arrows, one table of labelled rows, Hebrew and names marked with their
 * language, and the named nav that closes the page.
 *
 * ```
 * EntityFrame
 *   Trail                  a link to the list page
 *   FigureNav              ❮ figure ❯, where the entity is in a chain
 *   <h1>, Lede             the heading is the page's own
 *   EntityTable of Rows    an empty row is not rendered
 *   PrevNext               ← Previous            Next →
 * ```
 *
 * All Server Components, styled by one CSS module, and every link is the MUI
 * one the rest of the site uses. A page body built from them should be
 * synchronous, with its loads in the route, because React 19's
 * `renderToString` throws on an async child and that is how the tests render
 * a page.
 */
import Link from "@magick-components/Link";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import type { ReactNode } from "react";
import styles from "./entity.module.css";

/** A page next to this one in its chain: where it is and what it is called. */
export interface Neighbour {
  /** The neighbour's route, absolute: `/kabbalah/sephirah/netzach`. */
  href: string;
  /** Its name, as the arrows' accessible label and the nav's link text. */
  label: string;
}

/**
 * The site's frame, `Container maxWidth="sm"` with the vertical margin the
 * other pages have, and the angel page's line height and heading sizes,
 * which a plain `<h1>` and `<h2>` inside it take.
 */
export function EntityFrame({ children }: { children: ReactNode }) {
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }} className={styles.frame}>
        {children}
      </Box>
    </Container>
  );
}

/** The small link back to the list page, above everything else. */
export function Trail({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <p className={styles.trail}>
      <Link href={href}>{children}</Link>
    </p>
  );
}

/**
 * A figure between the arrows to its neighbours: ❮ figure ❯. Each arrow is
 * labelled with the neighbour's name for a screen reader, and an absent one
 * keeps its column, so the figure stays centred at either end of a chain.
 */
export function FigureNav({
  prev,
  next,
  children,
}: {
  prev?: Neighbour;
  next?: Neighbour;
  children: ReactNode;
}) {
  return (
    <div className={styles.figureNav}>
      <div className={styles.arrow}>
        {prev ? (
          <Link
            href={prev.href}
            underline="none"
            aria-label={`Previous: ${prev.label}`}
          >
            ❮
          </Link>
        ) : null}
      </div>
      <div className={styles.figure}>{children}</div>
      <div className={styles.arrow}>
        {next ? (
          <Link
            href={next.href}
            underline="none"
            aria-label={`Next: ${next.label}`}
          >
            ❯
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The sentence under the heading that says what the page is about: "Beauty,
 * the sixth Sephirah of the Tree of Life." Set a little larger than the
 * table, as the angel page sets its attribute.
 */
export function Lede({ children }: { children: ReactNode }) {
  return <p className={styles.lede}>{children}</p>;
}

/**
 * Text that qualifies what is beside it, in the secondary colour: a tree's
 * "Hebrew tree only", a term's gloss, a note that a text's source is not
 * recorded. Inline unless `block`, which sets it on a line of its own and a
 * little smaller, under the value it qualifies.
 */
export function Muted({
  block,
  children,
}: {
  block?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={block ? styles.note : styles.secondary}>{children}</span>
  );
}

/** The page's one table of correspondences; its children are `Row`s. */
export function EntityTable({ children }: { children: ReactNode }) {
  return (
    <table className={styles.table}>
      <tbody>{children}</tbody>
    </table>
  );
}

/**
 * Whether React would render nothing for a node: `null`, `undefined`, a
 * boolean, `""`, or a list of those, which is what `a && <b />` leaves when
 * `a` is falsy. A fragment or a component is something, whatever it renders,
 * since only rendering it would say.
 */
function isEmpty(node: ReactNode): boolean {
  return (
    node === null ||
    node === undefined ||
    typeof node === "boolean" ||
    node === "" ||
    (Array.isArray(node) && node.every(isEmpty))
  );
}

/**
 * One labelled row: `<th scope="row">` and its value. `aside` follows the
 * label in the secondary colour, for the world a row belongs to: "God name ·
 * Atziluth". The four worlds' names are transliterations, so pass them as
 * `<span lang="he-Latn">`.
 *
 * The row is not rendered when its children are empty (see `isEmpty`), so a
 * page can write `<Row label="Stone">{sephirah.stone}</Row>` whether or not
 * the row has a stone. It cannot see inside a component: pass `<Name>` or a
 * fragment only where there is something in it, as `value ? <Name … /> : null`.
 */
export function Row({
  label,
  aside,
  children,
}: {
  label: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  if (isEmpty(children)) return null;
  return (
    <tr>
      <th scope="row">
        {label}
        {isEmpty(aside) ? null : (
          <span className={styles.aside}> · {aside}</span>
        )}
      </th>
      <td>{children}</td>
    </tr>
  );
}

/** Hebrew, marked right-to-left in its language and set in a Hebrew face. */
export function Hebrew({ children }: { children: ReactNode }) {
  return (
    <span lang="he" dir="rtl" className={styles.hebrew}>
      {children}
    </span>
  );
}

/**
 * A name in its own script, then its romanisation in the secondary colour,
 * then its meaning in quotes: תפארת Tiferet “Beauty”. Each part is left out
 * where it is absent or empty, and nothing is rendered when all three are.
 *
 * `script` is `"he"` for Hebrew, the default, marked `lang="he" dir="rtl"`
 * with its romanisation `lang="he-Latn"`; or `"sa"` for the chakras'
 * Sanskrit, `lang="sa"` and `lang="sa-Latn"`.
 */
export function Name({
  original,
  roman,
  meaning,
  script = "he",
}: {
  original?: string | null;
  roman?: string | null;
  meaning?: string | null;
  script?: "he" | "sa";
}) {
  const parts: ReactNode[] = [];
  if (original)
    parts.push(
      script === "he" ? (
        <Hebrew key="original">{original}</Hebrew>
      ) : (
        <span key="original" lang="sa">
          {original}
        </span>
      ),
    );
  if (roman)
    parts.push(
      <span key="roman" lang={`${script}-Latn`} className={styles.secondary}>
        {roman}
      </span>,
    );
  if (meaning) parts.push(`“${meaning}”`);
  if (!parts.length) return null;
  // One space between the parts, so the text reads as it looks.
  return <>{parts.flatMap((part, i) => (i ? [" ", part] : [part]))}</>;
}

/**
 * The named nav that closes a page: `← previous` and `next →`, with an empty
 * placeholder where one side is absent so the other keeps its end. `label` is
 * the nav's accessible name, the chain's: "Angels", "Sephiroth". Nothing is
 * rendered where the entity has neither neighbour.
 */
export function PrevNext({
  label,
  prev,
  next,
}: {
  label: string;
  prev?: Neighbour;
  next?: Neighbour;
}) {
  if (!prev && !next) return null;
  return (
    <nav className={styles.prevNext} aria-label={label}>
      {prev ? <Link href={prev.href}>← {prev.label}</Link> : <span />}
      {next ? <Link href={next.href}>{next.label} →</Link> : <span />}
    </nav>
  );
}
