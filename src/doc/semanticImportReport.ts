import { isDeepStrictEqual } from "node:util";
import {
  type RitualSemanticDocument,
  type RitualSemanticNode,
  semanticToJrt,
} from "./semantic";

/** Counts only; raw legacy payloads never cross into the report UI. */
export interface SemanticImportReport {
  lossless: boolean;
  elementCount: number;
  textCount: number;
  opaqueCount: number;
}

/** Compare the whole JRT tree before offering an opt-in legacy conversion. */
export function createSemanticImportReport(
  jrt: unknown,
  document: RitualSemanticDocument,
): SemanticImportReport {
  const report: SemanticImportReport = {
    lossless: isDeepStrictEqual(semanticToJrt(document), jrt),
    elementCount: 0,
    textCount: 0,
    opaqueCount: 0,
  };
  const visit = (nodes: RitualSemanticNode[]) => {
    for (const node of nodes) {
      if (node.kind === "text") report.textCount++;
      else if (node.kind === "legacy") report.opaqueCount++;
      else if (node.kind === "element") {
        report.elementCount++;
        if (node.children) visit(node.children);
      }
    }
  };
  visit(document.nodes);
  return report;
}
