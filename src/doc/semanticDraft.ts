"use client";

import Dexie, { type Table } from "dexie";
import type { SqlRitualWriteRequest } from "./sqlWriteContract";

export interface SemanticDraft {
  ownerId: string;
  ritualId: string;
  baseRevisionId: string;
  baseVersion: number;
  title: string;
  /** Last valid semantic document, independent of an invalid source buffer. */
  documentJson: string;
  sourceBuffer: string;
  sourceDirty: boolean;
  sourceConflict: boolean;
  pending: Extract<SqlRitualWriteRequest, { kind: "save" }> | null;
  updatedAt: number;
}

class SemanticDraftDatabase extends Dexie {
  drafts!: Table<SemanticDraft, [string, string]>;

  constructor() {
    super("magickli-semantic-editor-v1");
    this.version(1).stores({ drafts: "[ownerId+ritualId]" });
  }
}

let database: SemanticDraftDatabase | null = null;
const db = () => (database ??= new SemanticDraftDatabase());

/** Recover only the current verified account's ritual draft. */
export function loadSemanticDraft(ownerId: string, ritualId: string) {
  return db().drafts.get([ownerId, ritualId]);
}

/** Store a semantic draft without changing the existing Pug draft schema. */
export function saveSemanticDraft(draft: SemanticDraft) {
  return db().drafts.put(draft);
}

/** A confirmed server receipt is the only automatic deletion path. */
export function clearSemanticDraft(ownerId: string, ritualId: string) {
  return db().drafts.delete([ownerId, ritualId]);
}
