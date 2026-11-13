"use client";

import { Container } from "@mui/material";
import TableOfShewbread from "magick-components/gd/TableOfShewbread";
import React from "react";
import Ink from "@/drawings/Ink";
import ExportControls from "@/export/ExportControls";
import OpenSource from "@/OpenSource";

export default function CandleStickPage() {
  const ref = React.useRef<SVGSVGElement>(null);

  return (
    <Container sx={{ p: 2 }}>
      <Ink drawing="shewbread">
        <TableOfShewbread ref={ref} />
      </Ink>
      <ExportControls
        target={ref}
        filename="TableOfShewbread-magickly-export"
        link={{ slug: "table-of-shewbread", props: {} }}
      />
      <OpenSource
        files={[
          "/src/app/gd/symbols/shewbread/shewbread.tsx",
          "/packages/magick-components/src/gd/TableOfShewbread.tsx",
        ]}
      />
    </Container>
  );
}
