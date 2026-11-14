"use client";
import { SessionResearchChat } from "./ResearchSessionChat";
/** Server-authenticated archive-only entry with no browser auth/session or app database import. Each operation still requires fresh API authorization. */
export function ResearchSavedAnswers({ expiresAt }: { expiresAt: number }) {
  return <SessionResearchChat expiresAt={expiresAt} readOnly />;
}
