"use client";

import SevenBranchedCandlestick, {
  CANDLESTICK_VERSION_NOTES,
  CANDLESTICK_VERSIONS,
  type CandlestickVersionId,
  DEFAULT_CANDLESTICK_VERSION,
} from "magick-components/gd/SevenBranchedCandlestick";
import React from "react";
import { VersionNote, VersionSelect } from "@/drawings/DrawingVersion";
import Ink from "@/drawings/Ink";
import ToolLayout, {
  ToolControls,
  ToolDrawing,
  ToolPanel,
} from "@/drawings/ToolLayout";
import ExportControls from "@/export/ExportControls";
import OpenSource from "@/OpenSource";

export default function CandleStickPage() {
  const ref = React.useRef<SVGSVGElement>(null);
  const [version, setVersion] = React.useState<CandlestickVersionId>(
    DEFAULT_CANDLESTICK_VERSION,
  );

  return (
    <ToolLayout>
      <ToolControls>
        <VersionSelect
          id="candlestick-version-select"
          versions={CANDLESTICK_VERSIONS}
          notes={CANDLESTICK_VERSION_NOTES}
          defaultVersion={DEFAULT_CANDLESTICK_VERSION}
          value={version}
          onChange={setVersion}
        />
      </ToolControls>
      <ToolDrawing>
        <Ink drawing="candlestick">
          <SevenBranchedCandlestick ref={ref} version={version} />
        </Ink>
      </ToolDrawing>
      <ToolPanel>
        <ExportControls
          target={ref}
          filename={`SevenBranchedCandleStick-${version === DEFAULT_CANDLESTICK_VERSION ? "magickly-export" : `${version}-magickly-export`}`}
          link={{ slug: "seven-branched-candlestick", props: { version } }}
        />
        <VersionNote
          note={CANDLESTICK_VERSION_NOTES[version]}
          headingId="candlestick-version"
        />
        <OpenSource
          files={[
            "/src/app/gd/symbols/candlestick/candlestick.tsx",
            "/packages/magick-components/src/gd/SevenBranchedCandlestick.tsx",
          ]}
        />
      </ToolPanel>
    </ToolLayout>
  );
}
