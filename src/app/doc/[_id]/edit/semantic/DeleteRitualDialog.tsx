"use client";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import * as React from "react";
import {
  deleteRitual,
  loadRitualDeletion,
} from "@/app/gd/rituals/lifecycleActions";
import type { SqlRitualDeletionInfo } from "@/doc/sqlLifecycle";

/** Who loses the ritual the moment it is deleted. */
export function deletionAudience(info: SqlRitualDeletionInfo): string {
  const { scope, scopeName } = info;
  if (scope.kind === "public")
    return "Everyone loses it now, signed in or not.";
  if (scope.kind === "group")
    return `Members of the group ${scopeName || "(unnamed)"} lose it now.`;
  return `Members of ${scopeName || "this temple"} at grade ${scope.minGrade} and above lose it now.`;
}

/** What deleting does to copies on members' devices (plan 065, §6). */
export const DOWNLOADED_COPIES =
  "A copy downloaded to a member's device is removed the next time that device opens that ritual or the Downloaded rituals page while online, and in any case within 14 days.";

/**
 * Confirms deleting a ritual, saying who loses it. Everything is checked
 * again on the server; afterwards the rituals list offers Undo.
 */
export default function DeleteRitualDialog({
  ritualId,
  actorId,
  open,
  onClose,
  unsavedChanges = false,
  onDownloadDraft,
  onDeleted = (id) => window.location.assign(`/gd/rituals?deleted=${id}`),
}: {
  ritualId: string;
  actorId: string;
  open: boolean;
  onClose: () => void;
  /** The editor holds changes not yet saved or sent. */
  unsavedChanges?: boolean;
  onDownloadDraft?: () => void;
  /** Where to go once it is deleted; the URL carries the ID, never the title. */
  onDeleted?: (ritualId: string) => void;
}) {
  const [info, setInfo] = React.useState<SqlRitualDeletionInfo | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let current = true;
    setLoading(true);
    setError(null);
    const unavailable =
      "This ritual could not be loaded. Check your connection and try again.";
    loadRitualDeletion(ritualId)
      .then((next) => {
        if (!current) return;
        setInfo(next);
        if (!next) setError(unavailable);
      })
      .catch(() => {
        if (current) setError(unavailable);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [open, ritualId]);

  const confirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteRitual({ ritualId, expectedActorId: actorId });
      if (result.ok) {
        onDeleted(ritualId);
        return;
      }
      setError(result.message);
    } catch {
      setError(
        "The ritual could not be deleted. Check your connection and try again.",
      );
    }
    setDeleting(false);
  };

  return (
    <Dialog open={open} onClose={deleting ? undefined : onClose} maxWidth="sm">
      <DialogTitle>
        {info ? `Delete “${info.title}”?` : "Delete ritual"}
      </DialogTitle>
      <DialogContent>
        {loading && <DialogContentText>Loading…</DialogContentText>}
        {info && (
          <>
            <DialogContentText sx={{ mb: 2 }}>
              {deletionAudience(info)} {DOWNLOADED_COPIES} You can restore it
              from Recently deleted.
            </DialogContentText>
            {!info.canDelete && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Only a site administrator can delete a public ritual.
              </Alert>
            )}
            {unsavedChanges && (
              <Alert
                severity="warning"
                sx={{ mb: 2 }}
                action={
                  onDownloadDraft && (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={onDownloadDraft}
                    >
                      Download draft
                    </Button>
                  )
                }
              >
                Your unsaved changes stay on this device as a draft.
              </Alert>
            )}
          </>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={!info?.canDelete || deleting}
          onClick={confirm}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
