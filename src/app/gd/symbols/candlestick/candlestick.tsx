"use client";

import { Container } from "@mui/material";
import React from "react";
import SevenBranchedCandleStick from "@/components/gd/SevenBranchedCandleStick";
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
          "/src/components/gd/SevenBranchedCandleStick.tsx",
        ]}
      />
    </Container>
  );
}
