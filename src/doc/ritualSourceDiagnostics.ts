import type { RitualSemanticDocument, RitualSemanticNode } from "./semantic";

/** Parser-owned locations; these are never written into semantic JSON. */
export interface RitualSourceLocation {
  line: number;
  column?: number;
  id?: { line: number; column: number };
}

/** Sanitized parser error with one-based coordinates in the author's source. */
export class RitualSourceError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly column?: number,
  ) {
    super(message);
    this.name = "RitualSourceError";
  }
}

/** An error belongs to these exact bytes; later typing must not show a stale marker. */
export interface RitualSourceDiagnostic {
  source: string;
  message: string;
  line?: number;
  column?: number;
}

/** Retain safe codec messages, including line-only diagnostics from Ritual Text. */
export function ritualSourceDiagnostic(
  error: unknown,
  source: string,
): RitualSourceDiagnostic {
  const message =
    error instanceof Error ? error.message : "The source is invalid";
  const line = /^Line (\d+):/.exec(message);
  return {
    source,
    message,
    line:
      error instanceof RitualSourceError
        ? error.line
        : line
          ? Number(line[1])
          : undefined,
    column: error instanceof RitualSourceError ? error.column : undefined,
  };
}

/** Resolve validator paths against parser-owned nodes without exposing source values. */
export function semanticSourceError(
  document: RitualSemanticDocument,
  issue: string,
  locations: WeakMap<RitualSemanticNode, RitualSourceLocation>,
): Error {
  const match = /^(nodes\[\d+\](?:\.children\[\d+\])*): ([a-z ]+)$/.exec(issue);
  if (!match) return new Error("Invalid semantic document");
  const indices = [...match[1].matchAll(/\[(\d+)\]/g)].map((part) =>
    Number(part[1]),
  );
  let node: RitualSemanticNode | undefined = document.nodes[indices.shift()!];
  for (const index of indices)
    node = node?.kind === "element" ? node.children?.[index] : undefined;
  const location = node && locations.get(node);
  if (!location) return new Error("Invalid semantic document");
  const position =
    match[2].endsWith("id") && location.id ? location.id : location;
  // The validator identifies a node, but does not identify individual bad
  // attribute keys. Mark the whole line rather than inventing a precise column.
  const column = /attribute|task/.test(match[2]) ? undefined : position.column;
  return new RitualSourceError(
    `Line ${position.line}: ${match[2]}`,
    position.line,
    column,
  );
}
