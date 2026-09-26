"use client";

import { Alert, Box, Button, Typography } from "@mui/material";
import dynamic from "next/dynamic";
import React from "react";
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
  const [accepted, setAccepted] = React.useState(false);
  if (props.importReport && !props.importReport.lossless)
    return (
      <Alert severity="error">
        This ritual could not be converted without changing its reader tree. Its
        saved revision is unchanged.
      </Alert>
    );
  if (props.importReport && !accepted)
    return (
      <Box sx={{ maxWidth: 720, mx: "auto", p: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Review ritual conversion
        </Typography>
        <Alert severity={props.importReport.opaqueCount ? "warning" : "info"}>
          The current revision maps to {props.importReport.elementCount} ritual
          elements and {props.importReport.textCount} text fragments. Its reader
          tree round-trips without a change.
          {props.importReport.opaqueCount > 0 && (
            <>
              {" "}
              {props.importReport.opaqueCount} unsupported legacy nodes are
              preserved as opaque content. They can be inspected in ritual
              source but cannot be edited visually yet.
            </>
          )}
        </Alert>
        <Typography sx={{ my: 2 }}>
          Opening the editor does not change the saved ritual. Saving creates a
          new semantic revision; the original Pug source stays in history.
        </Typography>
        <Button variant="contained" onClick={() => setAccepted(true)}>
          Start editing conversion
        </Button>
      </Box>
    );
  return <SemanticEditor {...props} />;
}
