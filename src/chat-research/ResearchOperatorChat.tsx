"use client";
import { SessionResearchChat } from "./ResearchSessionChat";
/** Server-authenticated shell only. Every question and saved read independently checks the operator/source/native authority. */
export function ResearchOperatorChat({ expiresAt }: { expiresAt: number }) {
  return <SessionResearchChat expiresAt={expiresAt} />;
}
