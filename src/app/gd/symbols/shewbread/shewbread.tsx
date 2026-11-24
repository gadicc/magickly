"use client";

import TableOfShewbread from "magick-components/gd/TableOfShewbread";
import React from "react";
import Ink from "@/drawings/Ink";
import ToolLayout, { ToolDrawing, ToolPanel } from "@/drawings/ToolLayout";
import ExportControls from "@/export/ExportControls";
import OpenSource from "@/OpenSource";
// Relative, so site search reads its text with the page's.
import DrawnAfter from "../../../open-source/components/[name]/DrawnAfter";

export default function CandleStickPage() {
  const ref = React.useRef<SVGSVGElement>(null);

  return (
    <ToolLayout>
      <ToolDrawing>
        <Ink drawing="shewbread">
          <TableOfShewbread ref={ref} />
        </Ink>
      </ToolDrawing>
      <ToolPanel>
        <ExportControls
          target={ref}
          filename="TableOfShewbread-magickly-export"
          link={{ slug: "table-of-shewbread", props: {} }}
          // No options to keep: the page is the same for everyone.
          shareHint={null}
        />
        <DrawnAfter name="TableOfShewbread" />
        <OpenSource
          files={[
            "/src/app/gd/symbols/shewbread/shewbread.tsx",
            "/packages/magick-components/src/gd/TableOfShewbread.tsx",
          ]}
        />
      </ToolPanel>
    </ToolLayout>
  );
}
