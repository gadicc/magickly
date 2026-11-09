"use client";
import { Checkbox, FormControlLabel } from "@mui/material";

/**
 * A labelled checkbox for a server-rendered form. `FormControlLabel` reads
 * its `control`'s props, and a `<Checkbox>` element passed to it from a
 * server component can reach the client as a lazy reference with no props,
 * which fails the render ("reading 'disabled'"). Here both are created on
 * the client, from plain values.
 */
export default function CheckboxField({
  name,
  value = "true",
  defaultChecked,
  label,
}: {
  name: string;
  value?: string;
  defaultChecked?: boolean;
  label: string;
}) {
  return (
    <FormControlLabel
      control={
        <Checkbox name={name} value={value} defaultChecked={defaultChecked} />
      }
      label={label}
    />
  );
}
