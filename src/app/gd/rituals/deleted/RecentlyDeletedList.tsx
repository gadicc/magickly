"use client";

import {
  Alert,
  Button,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import * as React from "react";
import { cancelRemoval, restoreRitual } from "../lifecycleActions";
import PurgeRitualDialog from "./PurgeRitualDialog";

/** One row as the server formatted it, so the browser renders the same text. */
export interface DeletedRitualRow {
  ritualId: string;
  title: string;
  /** The temple or group, or "Public". */
  where: string;
  /** "Deleted by … on …". */
  deleted: string;
  /** "Removed on 30 November 2026", or how its removal stands. */
  removal: string;
  /** The removal is late: shown as a warning. */
  late: boolean;
  restorable: boolean;
  canPurge: boolean;
  canCancelRemoval: boolean;
}

/** The nightly run's last heartbeat line, for global administrators. */
export interface PurgeHeartbeatLine {
  text: string;
  warning: boolean;
}

/** Recently deleted, with Restore and Delete permanently. Every check is repeated on the server. */
export default function RecentlyDeletedList({
  rows,
  actorId,
  heartbeat,
}: {
  rows: DeletedRitualRow[];
  actorId: string;
  heartbeat?: PurgeHeartbeatLine;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [purging, setPurging] = React.useState<DeletedRitualRow | null>(null);
  const [message, setMessage] = React.useState<{
    severity: "success" | "error";
    text: string;
  } | null>(null);

  const act = async (
    row: DeletedRitualRow,
    action: typeof restoreRitual,
    done: string,
  ) => {
    setBusy(row.ritualId);
    setMessage(null);
    try {
      const result = await action({
        ritualId: row.ritualId,
        expectedActorId: actorId,
      });
      setMessage(
        result.ok
          ? { severity: "success", text: done }
          : { severity: "error", text: result.message },
      );
      if (result.ok) router.refresh();
    } catch {
      setMessage({
        severity: "error",
        text: "The change could not be made. Check your connection and try again.",
      });
    }
    setBusy(null);
  };

  return (
    <>
      {heartbeat && (
        <Alert severity={heartbeat.warning ? "warning" : "info"} sx={{ mb: 2 }}>
          {heartbeat.text}
        </Alert>
      )}
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
                sx={{ flexWrap: "wrap", gap: 1 }}
              >
                <ListItemText
                  primary={row.title}
                  secondary={
                    <>
                      {row.where} · {row.deleted}
                      <br />
                      <Typography
                        component="span"
                        variant="body2"
                        color={row.late ? "warning" : "textSecondary"}
                      >
                        {row.removal}
                      </Typography>
                    </>
                  }
                  sx={{ minWidth: 220 }}
                />
                <Stack direction="row" spacing={1}>
                  {row.restorable && (
                    <Button
                      size="small"
                      disabled={busy !== null}
                      onClick={() =>
                        act(row, restoreRitual, `Restored “${row.title}”.`)
                      }
                      aria-label={`Restore: ${row.title}`}
                    >
                      Restore
                    </Button>
                  )}
                  {row.restorable && row.canPurge && (
                    <Button
                      size="small"
                      color="error"
                      disabled={busy !== null}
                      onClick={() => setPurging(row)}
                      aria-label={`Delete permanently: ${row.title}`}
                    >
                      Delete permanently
                    </Button>
                  )}
                  {row.canCancelRemoval && (
                    <Button
                      size="small"
                      disabled={busy !== null}
                      onClick={() =>
                        act(
                          row,
                          cancelRemoval,
                          `Removal of “${row.title}” cancelled; it can be restored again.`,
                        )
                      }
                      aria-label={`Cancel removal: ${row.title}`}
                    >
                      Cancel removal
                    </Button>
                  )}
                </Stack>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
      {purging && (
        <PurgeRitualDialog
          ritualId={purging.ritualId}
          title={purging.title}
          actorId={actorId}
          open
          onClose={() => setPurging(null)}
          onDone={() => {
            setMessage({
              severity: "success",
              text: `“${purging.title}” will be removed for good within a day.`,
            });
            setPurging(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
