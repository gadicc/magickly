"use client";

import dynamic from "next/dynamic";
import type { RitualSemanticDocument } from "@/doc/semantic";

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
}

export default function SemanticEditorShell(props: SemanticEditorProps) {
  return <SemanticEditor {...props} />;
}
