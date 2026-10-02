"use client";

import Button, { type ButtonProps } from "@mui/material/Button";

/** Editor command that can stay focusable and visually steady while unavailable. */
type EditorActionButtonProps = ButtonProps & {
  /** Guard activation without native disabled styling during source synchronisation. */
  inactive?: boolean;
  /** Explain temporary unavailability without changing the button's visible label. */
  inactiveReason?: string;
};

/** aria-disabled is descriptive only, so pointer and keyboard clicks share an explicit guard. */
export default function EditorActionButton({
  inactive = false,
  inactiveReason,
  disabled,
  onClick,
  title,
  ...props
}: EditorActionButtonProps) {
  return (
    <Button
      {...props}
      type={props.type ?? "button"}
      disabled={disabled}
      aria-disabled={disabled || inactive || undefined}
      title={inactive ? inactiveReason : title}
      disableRipple={inactive || props.disableRipple}
      onClick={(event) => {
        if (disabled || inactive) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
