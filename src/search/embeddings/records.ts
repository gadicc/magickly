import { createHash } from "node:crypto";
import type { SearchCatalogue } from "../types";
import type { EmbeddingProfile } from "./profiles";

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

export function embeddingCacheKey(
  profile: EmbeddingProfile,
  input: string,
): string {
  return digest(JSON.stringify([profile, input]));
}
