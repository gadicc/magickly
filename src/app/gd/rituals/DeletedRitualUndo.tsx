"use client";

import { Button, Snackbar } from "@mui/material";
import * as React from "react";
import { restoreRitual } from "./lifecycleActions";

/**
 * "Deleted "Title". Undo", for ten seconds after the editor deletes a
 * ritual, once. Undo restores it and goes back to its editor; a refusal stays on
 * screen until dismissed.
 */
export default function DeletedRitualUndo({
  ritualId,
  title,
  actorId,
  onRestored = (id) => window.location.assign(`/doc/${id}/edit`),
}: {
  ritualId: string;
  title: string;
  actorId: string;
  onRestored?: (ritualId: string) => void;
}) {
  const [open, setOpen] = React.useState(true);
  // Shown once: drop ?deleted= from the address so a reload does not offer
  // Undo again. The native call updates Next's router without a request,
  // which router.replace would make, re-rendering the page without this.
  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("deleted")) return;
    url.searchParams.delete("deleted");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const undo = async () => {
    setBusy(true);
    try {
      const result = await restoreRitual({
        ritualId,
        expectedActorId: actorId,
      });
      if (result.ok) {
        onRestored(ritualId);
        return;
      }
      setError(result.message);
    } catch {
      setError("It could not be restored. Restore it from Recently deleted.");
    }
    setBusy(false);
  };
  return (
    <Snackbar
      open={open}
      autoHideDuration={error || busy ? null : 10_000}
      onClose={(_, reason) => {
        if (reason !== "clickaway") setOpen(false);
      }}
      message={error ?? `Deleted “${title}”.`}
      action={
        error ? (
          <Button color="inherit" size="small" onClick={() => setOpen(false)}>
            Close
          </Button>
        ) : (
          <Button color="inherit" size="small" disabled={busy} onClick={undo}>
            Undo
          </Button>
        )
      }
    />
  );
}
