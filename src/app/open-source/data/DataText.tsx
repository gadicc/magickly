import { Box } from "@mui/material";
import Data from "magick-data";
import fields from "magick-data/fields";
import type { TableName } from "magick-data/tables";
import { Fragment } from "react";
import { H2, List, PageText } from "@/app/PageText";
import { siteNav } from "@/app/siteNav";
import Link from "@/ui/Link";
import { Code } from "../PackageCard";
import Described from "./Described";
import {
  relationsOf,
  size,
  TABLE_NAMES,
  tableFields,
  tablePath,
} from "./tables";

const BARREL = `import data from "magick-data";

data.sephirah.tiferet.planet?.symbol; // "☉"`;

const ONE_TABLE = `import sephirot from "magick-data/kabbalah/sephirot";

sephirot.tiferet.planetId; // "sol", an id rather than a row`;

const SCOPED = `import planet from "magick-data/astrology/planets";
import sephirah from "magick-data/kabbalah/sephirot";
import { assemble } from "magick-data/tools";

const scoped = assemble({ planet, sephirah });
scoped.sephirah.tiferet.planet?.symbol; // "☉"`;

/** Table names as links to their pages, joined in prose. */
function Tables({ names }: { names: readonly TableName[] }) {
  return names.map((name, i) => (
    <Fragment key={name}>
      {i === 0 ? "" : i === names.length - 1 ? " and " : ", "}
      <Link href={tablePath(name)}>
        <code>{name}</code>
      </Link>
    </Fragment>
  ));
}

/** One table: its page, what it holds, where it is and how it links. */
function TableEntry({ name }: { name: TableName }) {
  const table = tableFields(name);
  const { to, from, self } = relationsOf(name);
  return (
    <Box component="li" sx={{ mb: 1.5, overflowWrap: "anywhere" }}>
      <Link href={tablePath(name)}>
        <code>{name}</code>
      </Link>
      , {table.rows} rows, <code>magick-data/{table.subpath.slice(2)}</code>:{" "}
      <Described text={table.description} />
      {to.length || from.length || self ? (
        <Box
          component="span"
          sx={{ display: "block", color: "text.secondary" }}
        >
          {to.length ? (
            <>
              Links to <Tables names={to} />
              {self ? ", and to its own rows" : ""}.{" "}
            </>
          ) : self ? (
            "Links to its own rows. "
          ) : null}
          {from.length ? (
            <>
              Linked from <Tables names={from} />.
            </>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

/** The data package's contents (plan 080, decisions 1, 4 and 6). */
export default function DataText() {
  const texts = Object.entries(fields.texts);
  return (
    <>
      <PageText labelledBy="ways-in">
        <H2 id="ways-in">Three ways in</H2>
        <p>
          The package can be read whole, a table at a time, or as a few tables
          joined. Each costs something different in bundle size and in the types
          a compiler has to work through; the package&apos;s README gives the
          figures.
        </p>
        <p>
          <b>The barrel</b> holds {Object.keys(Data).length} of the{" "}
          {TABLE_NAMES.length} tables, assembled, so that every link is a row
          rather than an id. It leaves out{" "}
          <Tables
            names={TABLE_NAMES.filter((name) => !Object.hasOwn(Data, name))}
          />
          , which link to no table and which no table links to.
        </p>
        <Code>{BARREL}</Code>
        <p>
          <b>One table</b>, by its own subpath, is the rows as written, with
          links left as ids:
        </p>
        <Code>{ONE_TABLE}</Code>
        <p>
          <b>A scoped assemble()</b> joins only the tables you name, and
          following a link outside them is a type error:
        </p>
        <Code>{SCOPED}</Code>
        <p>
          The data is under <Link href="/open-source#licences">CC BY 4.0</Link>:
          use it anywhere, as long as you credit <Link href="/">magick.ly</Link>
          .
        </p>
      </PageText>

      <PageText labelledBy="tables">
        <H2 id="tables">The tables</H2>
        <p>
          Each table is listed by the name <code>assemble()</code> and the graph
          give it, with its rows, its subpath and the tables it links to. A row
          is a plain object, and a link is an id that names a row of another
          table.
        </p>
        <List>
          {TABLE_NAMES.map((name) => (
            <TableEntry key={name} name={name} />
          ))}
        </List>
      </PageText>

      <PageText labelledBy="texts">
        <H2 id="texts">Texts and derived values</H2>
        <p>
          These subpaths hold texts, or values computed from the tables, rather
          than rows of a table. Each is shown on a page of the site.
        </p>
        <List>
          {texts.map(([subpath, text]) => (
            <Box
              component="li"
              key={subpath}
              sx={{ mb: 1.5, overflowWrap: "anywhere" }}
            >
              <code>magick-data/{subpath.slice(2)}</code>:{" "}
              <Described text={text.description} />
              <Box
                component="span"
                sx={{ display: "block", color: "text.secondary" }}
              >
                {text.size === null
                  ? "Computed in code. "
                  : `${size(text.size)} of JSON. `}
                {text.page ? (
                  <>
                    Shown on{" "}
                    <Link href={text.page}>
                      {siteNav(text.page, null).title}
                    </Link>
                    .
                  </>
                ) : null}
              </Box>
            </Box>
          ))}
        </List>
      </PageText>

      <PageText labelledBy="helpers">
        <H2 id="helpers">Helpers</H2>
        <p>
          <code>magick-data/tools</code> exports all five; <code>assemble</code>
          , <code>rowOf</code> and <code>pathTarget</code> have subpaths of
          their own as well.
        </p>
        <List>
          <li>
            <code>assemble(tables)</code> joins the tables it is given, turning
            each link into the row it names. It never throws: what it cannot
            join, it records as a problem. Calling it twice with the same tables
            returns the same object, and its rows are frozen.
          </li>
          <li>
            <code>problemsOf(assembled)</code> lists those problems: a link that
            names no row, a link one way that the other row does not return, an
            accessor that would hide a field.
          </li>
          <li>
            <code>accessorName(field, link)</code> names the accessor a link
            gives: <code>planetId</code> gives <code>planet</code>, and{" "}
            <code>planetIds</code> gives <code>planets</code>.
          </li>
          <li>
            <code>rowOf(table, id)</code> is one row by an id that is only a
            string, or <code>undefined</code>, so that an unknown id is a value
            the caller must handle.
          </li>
          <li>
            <code>pathTarget(table, path)</code> says which table and field a
            dotted path such as <code>gdGrade.planet.symbol</code> ends at, by
            walking the graph. It imports every table, so it is for builds and
            tests rather than pages.
          </li>
        </List>
      </PageText>

      <PageText labelledBy="json">
        <H2 id="json">JSON</H2>
        <p>
          For a reader that is not JavaScript, every table and text is plain
          JSON too, at <code>magick-data/json/</code> and the path of its source
          (<code>magick-data/json/kabbalah/sephirot.json</code>), and the graph
          of how the tables link is <code>magick-data/graph.json</code>. The
          JSON holds the rows as written, with links as ids.
        </p>
      </PageText>

      <PageText labelledBy="dictionary">
        <H2 id="dictionary">Not in the package</H2>
        <p>
          The <Link href="/enochian/dictionary">Enochian dictionary</Link> is
          not published. Its entries cite two works whose rights are not ours to
          give, so it stays in the app.
        </p>
      </PageText>
    </>
  );
}
