import { compileSemanticContent } from "./semanticCompilerImpl";

export const SEMANTIC_SOURCE_FORMAT = "magickli-semantic-json";
export const SEMANTIC_SOURCE_FORMAT_VERSION = "1";
/** Frozen compiler inputs. Changing either implementation requires a parity review. */
export const SEMANTIC_COMPILER_COMPONENTS = {
  semanticModelSha256:
    "4e9e3a7cf3f4f65789f0b04cc4f89438e71a7a3cb625c17b4ea419475b745fc3",
  semanticCompilerImplSha256:
    "3108b1d0bdbb52ae83d70b54c018a90317c63999c4da7191b0332a08cccb654d",
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
