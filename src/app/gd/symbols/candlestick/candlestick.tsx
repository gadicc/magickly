"use client";

import { Container } from "@mui/material";
import SevenBranchedCandlestick from "magick-components/gd/SevenBranchedCandlestick";
import React from "react";
import Ink from "@/drawings/Ink";
import ExportControls from "@/export/ExportControls";
import OpenSource from "@/OpenSource";

export default function CandleStickPage() {
  const ref = React.useRef<SVGSVGElement>(null);

  return (
    <Container sx={{ p: 2 }}>
      <Ink drawing="candlestick">
        <SevenBranchedCandlestick ref={ref} />
      </Ink>
      <ExportControls
        target={ref}
        filename="SevenBranchedCandleStick-magickly-export"
        link={{ slug: "seven-branched-candlestick", props: {} }}
      />
      <OpenSource
        files={[
          "/src/app/gd/symbols/candlestick/candlestick.tsx",
          "/packages/magick-components/src/gd/SevenBranchedCandlestick.tsx",
        ]}
      />
    </Container>
  );
}
