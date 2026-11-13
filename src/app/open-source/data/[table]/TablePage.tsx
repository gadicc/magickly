import { Box, Container, Typography } from "@mui/material";
import type { Field } from "magick-data/fields";
import type { TableName } from "magick-data/tables";
import type { ReactNode } from "react";
import { H2 } from "@/app/PageText";
import Link from "@/ui/Link";
import { Code } from "../../PackageCard";
import Described from "../Described";
import {
  type Column,
  columnsOf,
  entityHref,
  fieldAnchor,
  importLine,
  type Row,
  rowHref,
  rowKeyLabel,
  rowsOf,
  tableFields,
  tablePath,
  valueAt,
} from "../tables";
import RowsTable from "./RowsTable";

/** Hebrew letters, which a cell sets in a Hebrew face. */
const HEBREW = /[\u0590-\u05ff]/;

/** Above this many characters a cell shows three lines; the detail has it all. */
const LONG = 60;

/**
 * Where an anchor stops below the app bar. A plain length: a theme callback
 * cannot cross from this Server Component into MUI's client ones.
 */
const BELOW_BAR = "72px";

/** A link to a row of another table, or this one. */
function RowLink({ table, id }: { table: string; id: string }) {
  return <Link href={rowHref(table, id)}>{id}</Link>;
}

/** The swatches for a colour, or for Malchut's four, from its CSS value. */
function Swatches({ css }: { css: string }) {
  return css.split(",").map((color) => (
    <Box
      component="span"
      key={color}
      aria-hidden
      sx={{
        display: "inline-block",
        width: "0.9em",
        height: "0.9em",
        mr: 0.5,
        verticalAlign: "-0.1em",
        border: 1,
        borderColor: "divider",
        borderRadius: 0.5,
        bgcolor: color.trim(),
      }}
    />
  ));
}

/** One value as a cell shows it. */
function Value({ field, value }: { field: Field; value: unknown }): ReactNode {
  if (value === undefined) return null;
  if (value === null)
    return (
      <Box component="span" sx={{ color: "text.secondary" }}>
        null
      </Box>
    );
  const { link } = field;
  if (link?.kind === "link") {
    const ids = Array.isArray(value) ? value.map(String) : [String(value)];
    return ids.map((id, i) => (
      <Box component="span" key={id} sx={{ whiteSpace: "nowrap" }}>
        {i ? ", " : ""}
        <RowLink table={link.to} id={id} />
      </Box>
    ));
  }
  if (Array.isArray(value))
    return field.type.kind === "tuple"
      ? JSON.stringify(value)
      : value.map(String).join(", ");
  const text = String(value);
  // A Hebrew name stands alone, so it is set in Frank Ruhl Libre (plan 079).
  if (HEBREW.test(text))
    return (
      <Box
        component="span"
        lang="he"
        dir="rtl"
        sx={{
          whiteSpace: "nowrap",
          fontFamily: '"Frank Ruhl Libre", "Noto Sans Hebrew", serif',
          fontSize: "1.15em",
        }}
      >
        {text}
      </Box>
    );
  if (text.length <= LONG)
    return (
      <Box component="span" sx={{ whiteSpace: "nowrap" }}>
        {text}
      </Box>
    );
  return (
    <Box
      component="span"
      sx={{
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        minWidth: "16rem",
      }}
    >
      {text}
    </Box>
  );
}

/** A row's cell for one column, with a swatch where the column is a colour. */
function Cell({ column, row }: { column: Column; row: Row }) {
  const { field, parent } = column;
  const value = valueAt(row, field.path);
  const web = parent && valueAt(row, `${field.path}Web`);
  if (typeof web !== "string" || value === undefined)
    return <Value field={field} value={value} />;
  return (
    <Box component="span" sx={{ whiteSpace: "nowrap" }}>
      <Swatches css={web} />
      <Value field={field} value={value} />
    </Box>
  );
}

/** What a field links to, in words. */
function LinkNote({ field }: { field: Field }) {
  const { link } = field;
  if (!link) return null;
  const many = link.many ? "ids" : "an id";
  if (link.kind === "link")
    return (
      <>
        {" · "}
        {many} in <Link href={tablePath(link.to)}>{link.to}</Link>
      </>
    );
  return (
    <>
      {" · "}
      {many} of a {link.to}
      {link.kind === "pending"
        ? ", which has no table yet"
        : ", outside the package"}
    </>
  );
}

/**
 * A field's type for its entry: the display string, or for a long object,
 * map or array of objects, what it is, since its keys are listed under it.
 */
function typeLabel({ type, display }: Field) {
  if (display.length <= LONG) return display;
  if (type.kind === "map") return `map by ${type.keys.join(", ")}`;
  if (type.kind === "array" && type.of.kind === "object")
    return "array of objects";
  return type.kind;
}

/** A field's entry in the list: its path, type and description. */
function FieldEntry({ field }: { field: Field }) {
  const depth = field.path.split(/\.|\[\]/).filter(Boolean).length - 1;
  return (
    <Box sx={{ pl: depth * 2.5, mb: 1.5 }}>
      <Box
        component="dt"
        id={fieldAnchor(field.path)}
        sx={{ scrollMarginTop: BELOW_BAR }}
      >
        <code>
          <b>{field.path}</b>
        </code>
        <Box
          component="span"
          sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
        >
          {" · "}
          <code>{typeLabel(field)}</code>
          {field.optional ? " · optional" : ""}
          {field.nullable ? " · may be null" : ""}
          <LinkNote field={field} />
          {field.columns
            ? ` · the rows show ${field.columns.join(" and ")}`
            : ""}
        </Box>
      </Box>
      <Box component="dd" sx={{ ml: 0, mt: 0.25 }}>
        <Described text={field.description} />
      </Box>
    </Box>
  );
}

/**
 * A table's page (plan 080, decision 4): the import line and counts, then
 * the rows, then the fields, all on one page. Each row is an anchor named
 * by its key, a link is a link to its row, and a column's header links to
 * its field's entry below.
 */
export default function TablePage({ table }: { table: TableName }) {
  const meta = tableFields(table);
  const rows = rowsOf(table);
  const { rowKey } = meta;
  const keyField =
    "field" in rowKey
      ? meta.fields.find((field) => field.path === rowKey.field)
      : undefined;
  const columns = columnsOf(table).filter(({ field }) => field !== keyField);
  const json = `magick-data/json/${meta.source.replace(/\.json5$/, ".json")}`;

  return (
    <Container maxWidth="lg" sx={{ my: 4 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        <code>{table}</code>
      </Typography>
      <p>
        <Described text={meta.description} />
      </p>
      <Code>{importLine(table)}</Code>
      <p>
        {meta.rows} rows, each named by its{" "}
        {keyField ? <code>{keyField.path}</code> : "key"}, and{" "}
        {meta.fields.length} fields. As JSON: <code>{json}</code>.{" "}
        <Link href="/open-source/data">All the tables</Link>
      </p>

      <Box component="section" aria-labelledby="rows">
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <H2 id="rows">Rows</H2>
          <Link href="#fields">Fields</Link>
        </Box>
        <RowsTable
          keyHeader={
            keyField ? (
              <Link href={`#${fieldAnchor(keyField.path)}`}>
                <code>{keyField.path}</code>
              </Link>
            ) : (
              "key"
            )
          }
          headers={columns.map(({ field }) => (
            <Link key={field.path} href={`#${fieldAnchor(field.path)}`}>
              <code>{field.path}</code>
            </Link>
          ))}
          rows={rows.map(([key, row]) => ({
            key,
            cells: columns.map((column) => (
              <Cell key={column.field.path} column={column} row={row} />
            )),
            json: row,
            entity: entityHref(table, key, row),
          }))}
          label={`The rows of ${table}, by ${rowKeyLabel(table)}`}
        />
      </Box>

      <Box
        component="section"
        aria-labelledby="fields"
        sx={{
          mt: 4,
          "& h2": { scrollMarginTop: BELOW_BAR },
        }}
      >
        <H2 id="fields">Fields</H2>
        {meta.rules.length ? (
          <>
            <p>
              Besides each field&apos;s type, every row must keep these rules:
            </p>
            <ul>
              {meta.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </>
        ) : null}
        <Box component="dl" sx={{ mt: 2 }}>
          {meta.fields.map((field) => (
            <FieldEntry key={field.path} field={field} />
          ))}
        </Box>
      </Box>
    </Container>
  );
}
