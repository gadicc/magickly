"use client";

import {
  Alert,
  Button,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import * as React from "react";
import { restoreRitual } from "../lifecycleActions";

/** One row as the server formatted it, so the browser renders the same text. */
export interface DeletedRitualRow {
  ritualId: string;
  title: string;
  /** The temple or group, or "Public". */
  where: string;
  /** "Deleted by … on …". */
  deleted: string;
  restorable: boolean;
}

/** Recently deleted, with Restore. Every check is repeated on the server. */
export default function RecentlyDeletedList({
  rows,
  actorId,
}: {
  rows: DeletedRitualRow[];
  actorId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{
    severity: "success" | "error";
    text: string;
  } | null>(null);

  const restore = async (row: DeletedRitualRow) => {
    setBusy(row.ritualId);
    setMessage(null);
    try {
      const result = await restoreRitual({
        ritualId: row.ritualId,
        expectedActorId: actorId,
      });
      setMessage(
        result.ok
          ? { severity: "success", text: `Restored “${row.title}”.` }
          : { severity: "error", text: result.message },
      );
      if (result.ok) router.refresh();
    } catch {
      setMessage({
        severity: "error",
        text: "It could not be restored. Check your connection and try again.",
      });
    }
    setBusy(null);
  };

  return (
    <>
      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} role="status">
          {message.text}
        </Alert>
      )}
      {rows.length === 0 ? (
        <Typography>Nothing has been deleted.</Typography>
      ) : (
        <Paper>
          <List aria-label="Recently deleted rituals">
            {rows.map((row) => (
              <ListItem
                key={row.ritualId}
                divider
                secondaryAction={
                  row.restorable ? (
                    <Button
                      size="small"
                      disabled={busy !== null}
                      onClick={() => restore(row)}
                      aria-label={`Restore ${row.title}`}
                    >
                      Restore
                    </Button>
                  ) : undefined
                }
              >
                <ListItemText
                  primary={row.title}
                  secondary={`${row.where} · ${row.deleted}${
                    row.restorable ? "" : " · Being removed"
                  }`}
                  sx={{ pr: 10 }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </>
  );
}
