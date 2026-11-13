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
import { Fragment, type ReactNode, useState } from "react";
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
 * server, and this island only opens a row's detail, an expanded row
 * under it held to the visible width, so that it does not scroll sideways
 * with a wide table.
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
            const detailId = `detail-${key}`;
            return (
              <Fragment key={key}>
                <TableRow
                  id={key}
                  sx={{
                    scrollMarginTop: "72px",
                    "&:target > td": { bgcolor: "action.selected" },
                    "& > td": { verticalAlign: "top" },
                  }}
                >
                  <TableCell sx={{ ...sticky, whiteSpace: "nowrap", pl: 0.5 }}>
                    <IconButton
                      size="small"
                      aria-expanded={expanded}
                      aria-controls={expanded ? detailId : undefined}
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
                {expanded ? (
                  <TableRow id={detailId}>
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
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
