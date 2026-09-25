import { Alert } from "@mui/material";
import { connection } from "next/server";
import { getCurrentSqlUserId } from "@/auth/session";
import { RITUAL_SOURCE_FORMAT } from "@/doc/compileContract";
import {
  type RitualSemanticDocument,
  semanticFromJrt,
  validateRitualSemantic,
} from "@/doc/semantic";
import { SEMANTIC_SOURCE_FORMAT } from "@/doc/semanticCompile";
import { resolveSqlRitualRouteId, sqlRitualReader } from "@/doc/sqlRuntime";
import { privateMetadata } from "@/seo/metadata";
import SemanticEditorShell from "./SemanticEditorShell";

export const metadata = privateMetadata("Edit ritual");

export default async function SemanticEditPage({
  params,
}: {
  params: Promise<{ _id: string }>;
}) {
  await connection();
  if (process.env.RITUAL_SEMANTIC_EDITOR !== "1")
    return <Alert severity="info">The new editor is not enabled.</Alert>;
  const ritualId = await resolveSqlRitualRouteId((await params)._id).catch(
    () => null,
  );
  if (!ritualId) return <Alert severity="info">Ritual is unavailable.</Alert>;
  const [actorId, current] = await Promise.all([
    getCurrentSqlUserId(),
    sqlRitualReader.getCurrentSource(ritualId),
  ]);
  if (!actorId || !current || !current.ritual.canEdit)
    return <Alert severity="info">Ritual editing is unavailable.</Alert>;
  let document: RitualSemanticDocument;
  try {
    if (current.revision.sourceFormat === SEMANTIC_SOURCE_FORMAT) {
      const value: unknown = JSON.parse(current.revision.source);
      if (validateRitualSemantic(value).length)
        return (
          <Alert severity="error">
            This semantic revision needs repair before editing.
          </Alert>
        );
      document = value as RitualSemanticDocument;
    } else if (current.revision.sourceFormat === RITUAL_SOURCE_FORMAT) {
      const rendered = await sqlRitualReader.getRendered(ritualId);
      const latest = await sqlRitualReader.getCurrentSource(ritualId);
      if (
        !rendered ||
        !latest ||
        latest.currentRevisionId !== current.currentRevisionId ||
        latest.version !== current.version
      )
        return (
          <Alert severity="info">
            This ritual changed while opening the editor. Reload to use its
            current revision.
          </Alert>
        );
      document = semanticFromJrt(JSON.parse(rendered.contentJson));
    } else {
      return (
        <Alert severity="info">
          This source format is not supported by the new editor.
        </Alert>
      );
    }
  } catch {
    return (
      <Alert severity="error">The ritual could not be converted safely.</Alert>
    );
  }
  return (
    <SemanticEditorShell
      key={ritualId}
      ritualId={ritualId}
      actorId={actorId}
      title={current.ritual.title}
      revisionId={current.currentRevisionId}
      parentVersion={current.version}
      initialDocument={document}
      importedFromLegacy={
        current.revision.sourceFormat === RITUAL_SOURCE_FORMAT
      }
    />
  );
}
