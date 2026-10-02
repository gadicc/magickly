import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { createUuidV7 } from "@/lib/ids";
import {
  clearSemanticPublication,
  confirmSemanticSave,
  loadSemanticDraft,
  loadSemanticPublication,
  saveSemanticDraft,
  saveSemanticPublication,
} from "./semanticDraft";

it("atomically replaces a confirmed draft with its exact durable publication", async () => {
  const ownerId = createUuidV7(),
    ritualId = createUuidV7(),
    revisionId = createUuidV7();
  const operationId = createUuidV7();
  await saveSemanticDraft({
    ownerId,
    ritualId,
    baseRevisionId: revisionId,
    baseVersion: 1,
    title: "Synthetic",
    documentJson: "{}",
    sourceBuffer: "",
    sourceDirty: false,
    sourceConflict: false,
    pending: {
      version: 3,
      kind: "save",
      operationId,
      expectedActorId: ownerId,
      ritualId,
      expectedRevisionId: revisionId,
      expectedVersion: 1,
      title: "Synthetic",
      source: "{}",
    },
    updatedAt: 1,
  });
  const request = {
    version: 1 as const,
    operationId,
    expectedActorId: ownerId,
    ritualId,
    expectedRevisionId: revisionId,
    expectedVersion: 2,
  };
  await confirmSemanticSave(request);
  expect(await loadSemanticDraft(ownerId, ritualId)).toBeUndefined();
  expect(await loadSemanticPublication(ownerId, ritualId)).toEqual(request);
  expect(
    await loadSemanticPublication(createUuidV7(), ritualId),
  ).toBeUndefined();
  const newer = { ...request, operationId: createUuidV7(), expectedVersion: 3 };
  await saveSemanticPublication(newer);
  await clearSemanticPublication(request);
  expect(await loadSemanticPublication(ownerId, ritualId)).toEqual(newer);
  await clearSemanticPublication(newer);
  expect(await loadSemanticPublication(ownerId, ritualId)).toBeUndefined();
});

it("rejects stale confirmations and competing requests without deleting newer drafts", async () => {
  const ownerId = createUuidV7(),
    ritualId = createUuidV7();
  const newer = {
    version: 1 as const,
    operationId: createUuidV7(),
    expectedActorId: ownerId,
    ritualId,
    expectedRevisionId: createUuidV7(),
    expectedVersion: 3,
  };
  await confirmSemanticSave(newer);
  await clearSemanticPublication(newer);
  const draft = {
    ownerId,
    ritualId,
    baseRevisionId: newer.expectedRevisionId,
    baseVersion: 3,
    title: "Newer unsaved work",
    documentJson: "{}",
    sourceBuffer: "",
    sourceDirty: false,
    sourceConflict: false,
    pending: null,
    updatedAt: 1,
  };
  await saveSemanticDraft(draft);
  const stale = {
    ...newer,
    operationId: createUuidV7(),
    expectedRevisionId: createUuidV7(),
    expectedVersion: 2,
  };
  expect(await confirmSemanticSave(stale)).toBe(false);
  expect(await loadSemanticDraft(ownerId, ritualId)).toEqual(draft);
  expect(await loadSemanticPublication(ownerId, ritualId)).toBeUndefined();
  await expect(saveSemanticPublication(stale)).rejects.toThrow("superseded");
  await saveSemanticPublication(newer);
  const competing = { ...newer, operationId: createUuidV7() };
  await expect(saveSemanticPublication(competing)).rejects.toThrow(
    "superseded",
  );
  await saveSemanticPublication(competing, newer.operationId);
  expect(await loadSemanticPublication(ownerId, ritualId)).toEqual(competing);
});
