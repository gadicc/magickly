import { createHash } from "node:crypto";
import {
  type RitualSemanticDocument,
  semanticToJrt,
  validateRitualSemantic,
} from "./semantic";

/** Exact submitted bytes become one JRT profile-1 artifact or no artifact. */
export function compileSemanticContent(source: string) {
  try {
    const parsed: unknown = JSON.parse(source);
    if (validateRitualSemantic(parsed).length) return null;
    const contentJson = JSON.stringify(
      semanticToJrt(parsed as RitualSemanticDocument),
    );
    const sha256 = (value: string) =>
      createHash("sha256").update(value, "utf8").digest("hex");
    return {
      sourceSha256: sha256(source),
      contentJson,
      contentSha256: sha256(contentJson),
    };
  } catch {
    return null;
  }
}
