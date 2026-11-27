import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import React from "react";
import EnochianFont from "@/fonts/enochian";

function EnochianFontToggleBase({
  enochianFont,
  setEnochianFont,
  disabled,
}: {
  enochianFont: boolean;
  setEnochianFont: React.Dispatch<React.SetStateAction<boolean>>;
  /** Resting, where nothing on the page draws in the font. */
  disabled?: boolean;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      disabled={disabled}
      value={enochianFont}
      sx={{ m: 1 }}
      size="small"
      onChange={() => setEnochianFont(!enochianFont)}
    >
      <ToggleButton value={false} aria-label="latin">
        A
      </ToggleButton>
      <ToggleButton
        value={true}
        aria-label="enochian"
        style={EnochianFont.style}
      >
        A
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

export default function useEnochianFont() {
  const [enochianFont, setEnochianFont] = React.useState<boolean>(false);

  const EnochianFontToggle = ({ disabled }: { disabled?: boolean }) =>
    React.createElement(EnochianFontToggleBase, {
      enochianFont,
      setEnochianFont,
      disabled,
    });

  return { enochianFont, EnochianFontToggle };
}

export { EnochianFont };
