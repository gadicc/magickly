"use client";

import { Button, Snackbar } from "@mui/material";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import React from "react";
import { ritualEditorOwner } from "./ritualEditorOwner";
import { RITUAL_TASK_DELETED } from "./ritualTaskCommands";

/** Offer Undo only while deletion is still the most recent document edit. */
export function RitualTaskDeletionNotice({
  editor,
  blocked,
}: {
  editor: Editor;
  blocked: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const owner = ritualEditorOwner(editor);
  const deletionDoc = React.useRef<Editor["state"]["doc"] | null>(null);
  React.useEffect(() => {
    const update = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.getMeta(RITUAL_TASK_DELETED)) {
        deletionDoc.current = owner.state.doc;
        setOpen(true);
      } else if (transaction.docChanged) {
        deletionDoc.current = null;
        setOpen(false);
      }
    };
    owner.on("transaction", update);
    return () => {
      owner.off("transaction", update);
    };
  }, [owner]);
  React.useEffect(() => {
    if (blocked) setOpen(false);
  }, [blocked]);
  return (
    <Snackbar
      open={open && !blocked}
      autoHideDuration={6000}
      onClose={() => setOpen(false)}
      message="Task deleted"
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => {
            setOpen(false);
            if (
              !blocked &&
              owner.isEditable &&
              deletionDoc.current === owner.state.doc
            )
              owner.chain().focus().undo().run();
          }}
        >
          Undo
        </Button>
      }
    />
  );
}
