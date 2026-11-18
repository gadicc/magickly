import { createHash } from "node:crypto";
import type { SearchCatalogue } from "../types";
import { type EmbeddingProfile, embeddingInput } from "./profiles";

/** A page summary or passage with stable ownership and exact input identity. */
export interface EmbeddingRecord {
  id: string;
  path: string;
  title: string;
  section: string;
  text: string;
  href: string;
}

export const digest = (text: string | Uint8Array) =>
  createHash("sha256").update(text).digest("hex");

export function embeddingRecords(
  catalogue: SearchCatalogue,
): EmbeddingRecord[] {
  return catalogue.documents.flatMap((document) => [
    {
      id: `${document.path}#page`,
      path: document.path,
      title: document.title,
      section: "",
      text: [document.description, ...document.aliases].join(" "),
      href: document.path,
    },
    ...document.sections.map((section) => ({
      id: `${document.path}#${section.id}`,
      path: document.path,
      title: document.title,
      section: section.title,
      text: section.text,
      href: section.href ?? document.path,
    })),
  ]);
}

export function catalogueDigest(catalogue: SearchCatalogue): string {
  return digest(JSON.stringify(embeddingRecords(catalogue)));
}

/** The cache and row key: the complete profile plus the exact prepared input. */
export function embeddingCacheKey(
  profile: EmbeddingProfile,
  input: string,
): string {
  return digest(JSON.stringify([profile, input]));
}

/**
 * The exact text a record is embedded from: the profile's document prefix
 * with "title · section" as its title. The one recipe that publishing,
 * building and loading share (plan 087, decision 3); changing it re-keys
 * every row, so `embeddings.test.ts` pins a key.
 */
export function embeddingDocumentInput(
  profile: EmbeddingProfile,
  record: Pick<EmbeddingRecord, "title" | "section" | "text">,
): string {
  return embeddingInput(
    profile,
    "document",
    record.text,
    [record.title, record.section].filter(Boolean).join(" · "),
  );
}

/** The key naming a record's row under `profile`. */
export function embeddingRowKey(
  profile: EmbeddingProfile,
  record: Pick<EmbeddingRecord, "title" | "section" | "text">,
): string {
  return embeddingCacheKey(profile, embeddingDocumentInput(profile, record));
}
