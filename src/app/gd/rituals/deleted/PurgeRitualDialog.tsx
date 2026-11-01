"use client";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";
import * as React from "react";
import { confirmsRitualTitle } from "@/doc/ritualTitleMatch";
import { purgeRitualNow } from "../lifecycleActions";

/**
 * Deleting a ritual for good, from Recently deleted only, with its title
 * typed. Final the moment it is confirmed; the nightly run carries it out.
 * The server checks the title again.
 */
export default function PurgeRitualDialog({
  ritualId,
  title,
  actorId,
  open,
  onClose,
  onDone,
}: {
  ritualId: string;
  title: string;
  actorId: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const matches = confirmsRitualTitle(typed, title);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await purgeRitualNow({
        ritualId,
        expectedActorId: actorId,
        confirmTitle: typed,
      });
      if (result.ok) {
        onDone();
        return;
      }
      setError(result.message);
    } catch {
      setError("It could not be deleted. Check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm">
      <DialogTitle>Delete “{title}” permanently?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          This removes its text, its whole history, its images and its published
          copies, including their records, which carry its title, and every
          downloaded copy as devices check in.
        </DialogContentText>
        <DialogContentText sx={{ mb: 2 }}>
          It is final at once: nobody can restore it, even before the nightly
          run removes it, within a day, and nobody can bring it back afterwards.
        </DialogContentText>
        <TextField
          label="Type the ritual's title to confirm"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          fullWidth
          autoFocus
          disabled={busy}
          autoComplete="off"
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={!matches || busy}
          onClick={confirm}
        >
          Delete permanently
        </Button>
      </DialogActions>
    </Dialog>
  );
}
