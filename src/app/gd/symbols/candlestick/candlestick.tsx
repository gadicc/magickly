"use client";

import { Container } from "@mui/material";
import SevenBranchedCandleStick from "magick-components/gd/SevenBranchedCandleStick";
import React from "react";
import Ink from "@/drawings/Ink";
import ExportControls from "@/export/ExportControls";
import OpenSource from "@/OpenSource";

export default function CandleStickPage() {
  const ref = React.useRef<SVGSVGElement>(null);

  return (
    <Container sx={{ p: 2 }}>
      <Ink drawing="candlestick">
        <SevenBranchedCandleStick ref={ref} />
      </Ink>
      <ExportControls
        target={ref}
        filename="SevenBranchedCandleStick-magickly-export"
        link={{ slug: "seven-branched-candlestick", props: {} }}
      />
      <OpenSource
        files={[
          "/src/app/gd/symbols/candlestick/candlestick.tsx",
          "/packages/magick-components/src/gd/SevenBranchedCandleStick.tsx",
        ]}
      />
    </Container>
  );
}
