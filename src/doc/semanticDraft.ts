"use client";

import Dexie, { type Table } from "dexie";
import {
  parseRitualPublicationRequest,
  type RitualPublicationRequestV1,
} from "../offline/ritualPublicationContract";
import type { RitualSourceDialect } from "./ritualSource";
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
  /** Missing on pre-Pug drafts; their explicit header identifies Ritual Text. */
  sourceDialect?: RitualSourceDialect;
  sourceDirty: boolean;
  sourceConflict: boolean;
  pending: Extract<SqlRitualWriteRequest, { kind: "save" }> | null;
  updatedAt: number;
}

class SemanticDraftDatabase extends Dexie {
  drafts!: Table<SemanticDraft, [string, string]>;
  publications!: Table<RitualPublicationRequestV1, [string, string]>;
  confirmations!: Table<RitualPublicationRequestV1, [string, string]>;

  constructor() {
    super("magickli-semantic-editor-v1");
    this.version(1).stores({ drafts: "[ownerId+ritualId]" });
    this.version(2).stores({
      drafts: "[ownerId+ritualId]",
      publications: "[expectedActorId+ritualId]",
    });
    this.version(3).stores({
      drafts: "[ownerId+ritualId]",
      publications: "[expectedActorId+ritualId]",
      confirmations: "[expectedActorId+ritualId]",
    });
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

/** Confirm atomically, retaining optional recovered edits against the newly saved revision. */
export async function confirmSemanticSave(
  request: RitualPublicationRequestV1,
  followUp?: SemanticDraft,
) {
  const valid = parseRitualPublicationRequest(request);
  if (!valid) throw new TypeError("Invalid publication");
  if (
    followUp &&
    (followUp.ownerId !== valid.expectedActorId ||
      followUp.ritualId !== valid.ritualId ||
      followUp.baseRevisionId !== valid.expectedRevisionId ||
      followUp.baseVersion !== valid.expectedVersion ||
      followUp.pending)
  )
    throw new TypeError("Invalid follow-up draft");
  const database = db();
  return database.transaction(
    "rw",
    database.drafts,
    database.publications,
    database.confirmations,
    async () => {
      const key: [string, string] = [valid.expectedActorId, valid.ritualId];
      const confirmed = await database.confirmations.get(key);
      const pending = await database.publications.get(key);
      const draft = await database.drafts.get(key);
      // A delayed acknowledgement from another tab must not roll back recovery.
      // A follow-up can replace only the exact pending slot that it resolves.
      if (followUp && draft?.pending?.operationId !== valid.operationId)
        return false;
      if (
        (confirmed && confirmed.expectedVersion > valid.expectedVersion) ||
        (pending &&
          (pending.expectedVersion > valid.expectedVersion ||
            (pending.expectedVersion === valid.expectedVersion &&
              pending.operationId !== valid.operationId))) ||
        (draft &&
          draft.baseVersion >= valid.expectedVersion &&
          draft.pending?.operationId !== valid.operationId)
      )
        return false;
      await database.confirmations.put(valid);
      await database.publications.put(valid);
      if (draft?.pending?.operationId === valid.operationId) {
        if (followUp) await database.drafts.put(followUp);
        else await database.drafts.delete(key);
      }
      return true;
    },
  );
}

/** Owner-scoped online publication recovery is independent of authoring drafts. */
export function loadSemanticPublication(ownerId: string, ritualId: string) {
  return db().publications.get([ownerId, ritualId]);
}
export async function saveSemanticPublication(
  request: RitualPublicationRequestV1,
  replacesOperationId?: string,
) {
  const valid = parseRitualPublicationRequest(request);
  if (!valid) throw new TypeError("Invalid publication");
  const database = db();
  await database.transaction(
    "rw",
    database.publications,
    database.confirmations,
    async () => {
      const key: [string, string] = [valid.expectedActorId, valid.ritualId];
      const confirmed = await database.confirmations.get(key);
      const current = await database.publications.get(key);
      if (
        (confirmed && confirmed.expectedVersion > valid.expectedVersion) ||
        (current &&
          (current.expectedVersion > valid.expectedVersion ||
            (current.expectedVersion === valid.expectedVersion &&
              current.operationId !== valid.operationId &&
              replacesOperationId !== current.operationId)))
      )
        throw new Error("Publication was superseded");
      await database.publications.put(valid);
    },
  );
}
/** A delayed acknowledgement must never remove a newer saved version's request. */
export async function clearSemanticPublication(
  request: RitualPublicationRequestV1,
) {
  const database = db();
  await database.transaction("rw", database.publications, async () => {
    const key: [string, string] = [request.expectedActorId, request.ritualId];
    const current = await database.publications.get(key);
    if (JSON.stringify(current) === JSON.stringify(request))
      await database.publications.delete(key);
  });
}
