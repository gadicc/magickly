"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useId, useState } from "react";
import { useFormStatus } from "react-dom";

function ConfirmButton({ form, children }: { form: string; children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      form={form}
      color="error"
      variant="contained"
      disabled={pending}
    >
      {children}
    </Button>
  );
}

/**
 * A server action behind a confirmation dialog, for changes that are hard to
 * take back. The dialog sits inside the form in React's tree, so the confirm
 * button can follow the submission's pending state, while its `form`
 * attribute submits the form the portal has moved it away from.
 */
export function ConfirmAction({
  action,
  fields,
  label,
  title,
  confirmLabel,
  size = "medium",
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Hidden form fields the action reads. */
  fields: Record<string, string>;
  /** The button that opens the dialog. */
  label: string;
  title: string;
  confirmLabel: string;
  size?: "small" | "medium";
  /** What will happen, in plain words. */
  children: React.ReactNode;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  return (
    <form
      id={formId}
      action={action}
      style={{ display: "inline" }}
      // Close at once: a refusal comes back as a message on the page, which
      // an open dialog would hide.
      onSubmit={() => setOpen(false)}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button
        type="button"
        color="error"
        variant="outlined"
        size={size}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby={`${formId}-title`}
      >
        <DialogTitle id={`${formId}-title`}>{title}</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">{children}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <ConfirmButton form={formId}>{confirmLabel}</ConfirmButton>
        </DialogActions>
      </Dialog>
    </form>
  );
}
