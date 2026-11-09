import { tool } from "ai";
import {
  CHAT_COMPONENT_DESCRIPTIONS,
  hallInput,
  prepareHall,
  prepareTablet,
  prepareTree,
  tabletInput,
  treeInput,
} from "./catalogue";

/**
 * Prepared for the forthcoming chat runtime; importing this module neither
 * changes existing chat behaviour nor runs a model or server image renderer.
 */
export function createChatComponentTools() {
  return {
    showTreeOfLife: tool({
      description: CHAT_COMPONENT_DESCRIPTIONS.tree,
      inputSchema: treeInput,
      execute: async (input) => prepareTree(input),
    }),
    showEnochianTablet: tool({
      description: CHAT_COMPONENT_DESCRIPTIONS.tablet,
      inputSchema: tabletInput,
      execute: async (input) => prepareTablet(input),
    }),
    showTempleHall: tool({
      description: CHAT_COMPONENT_DESCRIPTIONS.hall,
      inputSchema: hallInput,
      execute: async (input) => prepareHall(input),
    }),
  };
}
