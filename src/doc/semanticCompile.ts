import { compileSemanticContent } from "./semanticCompilerImpl";

export const SEMANTIC_SOURCE_FORMAT = "magickli-semantic-json";
export const SEMANTIC_SOURCE_FORMAT_VERSION = "1";
/** Frozen compiler inputs. Changing validation or compilation requires a parity review. */
export const SEMANTIC_COMPILER_COMPONENTS = {
  semanticModelSha256:
    "1ec7444f8138161e4efbd306d64b6f8ea5ffda1599cf18ea3a1fe020619741fd",
  semanticCompilerImplSha256:
    "3108b1d0bdbb52ae83d70b54c018a90317c63999c4da7191b0332a08cccb654d",
  ritualNodeIdsSha256:
    "34fe5b0156fdf0018fe049eef72bcdfb0c40af90ad7500b7d91212fe54819228",
  outputProfile: "json-rich-text/1",
} as const;
export const SEMANTIC_COMPILER_VERSION = JSON.stringify(
  SEMANTIC_COMPILER_COMPONENTS,
);

/** Compile the exact submitted UTF-8 JSON source; no normalization of source bytes. */
export function compileSemanticSource(source: string) {
  const content = compileSemanticContent(source);
  return (
    content && {
      ...content,
      sourceFormat: SEMANTIC_SOURCE_FORMAT,
      sourceFormatVersion: SEMANTIC_SOURCE_FORMAT_VERSION,
      compilerVersion: SEMANTIC_COMPILER_VERSION,
      outputFormat: "json-rich-text",
      outputFormatVersion: "1",
      transformations: [] as string[],
    }
  );
}
