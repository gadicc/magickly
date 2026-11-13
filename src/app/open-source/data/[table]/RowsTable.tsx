"use client";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { usePathname } from "next/navigation";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import RowDetail from "./RowDetail";

/** One row as the server rendered it, with what its detail shows. */
export interface RowsTableRow {
  /** The row's key: its anchor, and the sticky first cell. */
  key: string;
  cells: ReactNode[];
  /** The row as written, for the detail's JSON. */
  json: unknown;
  /** The row's page on the site, where it has one. */
  entity?: string;
}

/** The row a fragment names, or nothing. */
function hashTarget() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

/**
 * The row the URL's fragment names. `:target` cannot be used: the app
 * router moves between pages, and to a fragment on the same one, with
 * `pushState`, which never changes it, and fires no `hashchange` either.
 * So the fragment is read when the table mounts (a link from another
 * table's page), on `hashchange` and `popstate` (a plain link on this
 * page, the browser's buttons), and just after any click, which catches
 * the router's own navigation within the page.
 */
export function useHashTarget() {
  const [target, setTarget] = useState<string | null>(null);
  const pathname = usePathname();
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read on navigation
  useEffect(() => {
    const read = () => setTarget(hashTarget());
    const soon = () => setTimeout(read, 0);
    read();
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    document.addEventListener("click", soon);
    return () => {
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
      document.removeEventListener("click", soon);
    };
  }, [pathname]);
  return target;
}

/** The selected row's tint, as a layer over the paper. */
const SELECTED =
  "linear-gradient(var(--mui-palette-action-selected), var(--mui-palette-action-selected))";

/** The first column stays put while a wide table scrolls under it. */
const sticky = {
  position: "sticky",
  left: 0,
  zIndex: 1,
  bgcolor: "background.paper",
  borderRight: 1,
  borderRightColor: "divider",
} as const;

/**
 * A table's rows (plan 080, decision 4): the cells are rendered on the
 * server, and this island opens a row's detail, an expanded row under it
 * held to the visible width, so that it does not scroll sideways with a
 * wide table, and marks the row the URL names.
 */
export default function RowsTable({
  keyHeader,
  headers,
  rows,
  label,
}: {
  keyHeader: ReactNode;
  headers: ReactNode[];
  rows: RowsTableRow[];
  label: string;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const target = useHashTarget();
  const toggle = (key: string) =>
    setOpen((was) => {
      const next = new Set(was);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <Box
      sx={{
        overflowX: "auto",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper",
        // The detail's width is this box's, whatever the table's.
        containerType: "inline-size",
      }}
    >
      <Table size="small" aria-label={label}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...sticky, zIndex: 2 }}>{keyHeader}</TableCell>
            {headers.map((header, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: columns are fixed
              <TableCell key={i} sx={{ whiteSpace: "nowrap" }}>
                {header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ key, cells, json, entity }) => {
            const expanded = open.has(key);
            const targeted = key === target;
            const detailId = `detail-${key}`;
            return (
              <Fragment key={key}>
                <TableRow
                  id={key}
                  aria-current={targeted ? "location" : undefined}
                  sx={{
                    scrollMarginTop: "72px",
                    "& > td": {
                      verticalAlign: "top",
                      ...(targeted && { bgcolor: "action.selected" }),
                    },
                  }}
                >
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{
                      ...sticky,
                      whiteSpace: "nowrap",
                      pl: 0.5,
                      fontWeight: "normal",
                      verticalAlign: "top",
                      // Opaque, so the scrolled cells do not show through.
                      ...(targeted && { backgroundImage: SELECTED }),
                    }}
                  >
                    <IconButton
                      size="small"
                      aria-expanded={expanded}
                      aria-controls={detailId}
                      aria-label={`${expanded ? "Hide" : "Show"} ${key} as JSON`}
                      onClick={() => toggle(key)}
                      sx={{ mr: 0.25, my: -0.5 }}
                    >
                      {expanded ? (
                        <KeyboardArrowDownIcon fontSize="small" />
                      ) : (
                        <KeyboardArrowRightIcon fontSize="small" />
                      )}
                    </IconButton>
                    <code>{key}</code>
                  </TableCell>
                  {cells.map((cell, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: columns are fixed
                    <TableCell key={i}>{cell}</TableCell>
                  ))}
                </TableRow>
                <TableRow id={detailId} hidden={!expanded}>
                  {expanded ? (
                    <TableCell colSpan={cells.length + 1} sx={{ p: 0 }}>
                      <Box
                        sx={{
                          position: "sticky",
                          left: 0,
                          width: "100cqi",
                          boxSizing: "border-box",
                          p: 2,
                        }}
                      >
                        <RowDetail rowKey={key} json={json} entity={entity} />
                      </Box>
                    </TableCell>
                  ) : null}
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
