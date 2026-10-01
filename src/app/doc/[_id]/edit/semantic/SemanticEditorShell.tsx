"use client";

import { Alert, Button } from "@mui/material";
import dynamic from "next/dynamic";
import type { RitualSemanticDocument } from "@/doc/semantic";
import type { SemanticImportReport } from "@/doc/semanticImportReport";

const SemanticEditor = dynamic(() => import("./SemanticEditor"), {
  ssr: false,
  loading: () => <p>Loading ritual editor…</p>,
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
      <Alert severity="error">
        This ritual could not be converted without changing its reader tree. Its
        saved revision is unchanged.
        <Button href={`/doc/${props.ritualId}/edit?legacy=1`}>
          Open Pug editor
        </Button>
      </Alert>
    );
  return <SemanticEditor {...props} />;
}
