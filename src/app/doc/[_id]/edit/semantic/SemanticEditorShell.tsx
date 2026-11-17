"use client";

import { Alert, Button, Typography } from "@mui/material";
import dynamic from "next/dynamic";
import type { RitualSemanticDocument } from "@/doc/semantic";
import type { SemanticImportReport } from "@/doc/semanticImportReport";
import EnglishText from "@/i18n/EnglishText";
import UiText from "@/i18n/UiText";

const SemanticEditor = dynamic(() => import("./SemanticEditor"), {
  ssr: false,
  loading: () => (
    <Typography color="textSecondary" sx={{ p: 2 }}>
      <UiText message={/*i18n*/ "Loading ritual editor…"} />
    </Typography>
  ),
});

export interface SemanticEditorProps {
  ritualId: string;
  actorId: string;
  title: string;
  revisionId: string;
  parentVersion: number;
  initialDocument: RitualSemanticDocument;
  importedFromLegacy: boolean;
  importReport?: SemanticImportReport;
}

export default function SemanticEditorShell(props: SemanticEditorProps) {
  if (props.importReport && !props.importReport.lossless)
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <EnglishText>
          This ritual could not be converted without changing its reader tree.
          Its saved revision is unchanged.
        </EnglishText>
        <Button href={`/doc/${props.ritualId}/edit?legacy=1`}>
          <UiText message={/*i18n*/ "Open Pug editor"} />
        </Button>
      </Alert>
    );
  return <SemanticEditor {...props} />;
}
