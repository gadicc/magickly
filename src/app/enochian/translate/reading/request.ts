import { createHash } from "node:crypto";
import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import type { ReadingPart } from "./passage.ts";
import {
  grammarMessage,
  type KeyRowRecord,
  READING_EFFORT,
  READING_MODEL,
  READING_TASK_TEXT,
  type Routing,
  readingContext,
  readingPrompt,
  readingRouting,
  SENTENCE_INSTRUCTIONS,
} from "./prompt.ts";

/**
 * The reading's request for a part (plan 081, S1 and S5): arm A3s's, as
 * the experiment builds it for the same words (`stage2b.test.ts` compares
 * the two), with the output cap step 2B measured.
 */

/**
 * The output cap, in tokens a word of the part: 2B measured 35.9 pooled and
 * 39.9 at most in one call, reasoning and the sentence included.
 */
export const OUTPUT_TOKENS_PER_WORD = 60;

/**
 * The least output cap, whatever the part's length: reasoning (about 490
 * tokens a part in 2B), the json block's fields and the sentence don't
 * shrink with the passage, so 60 a word would cut a short passage's answer
 * off (a `length` finish, billed for nothing).
 */
export const MIN_OUTPUT_TOKENS = 2_000;

/** A part's output cap: 60 tokens a word, and never under 2,000. */
export const outputCap = (words: number) =>
  Math.max(MIN_OUTPUT_TOKENS, OUTPUT_TOKENS_PER_WORD * words);

/** What the reading's prompt is built from. */
export interface ReadingPromptData {
  /** The dictionary as published (no planted knowns: those are the test's). */
  dictionary: EnochianDictionary;
  /** Every Key's rows (`rowsFromKeys`). */
  rows: readonly KeyRowRecord[];
  /** `grammar.md`, whole. */
  grammar: string;
}

/** The fixed part of every reading's request, and its version. */
export interface ReadingPrompt {
  model: string;
  effort: typeof READING_EFFORT;
  routing: Routing;
  /** The system messages: instructions, context, grammar notes. */
  instructions: readonly string[];
  /** Their characters, for the ceiling's hold. */
  instructionChars: number;
  /**
   * The prompt version (S1): a hash of the model, the effort, the routing
   * and every byte of the prompt but the passage. The store keys on it, so
   * a dictionary fix makes every stored reading old.
   */
  version: string;
}

/** The reading's prompt, built once from its data. */
export function buildReadingPrompt(data: ReadingPromptData): ReadingPrompt {
  const instructions = [
    SENTENCE_INSTRUCTIONS,
    readingContext(data.dictionary, data.rows),
    grammarMessage(data.grammar),
  ];
  const routing = readingRouting(READING_MODEL);
  return {
    model: READING_MODEL,
    effort: READING_EFFORT,
    routing,
    instructions,
    instructionChars: instructions.reduce((sum, one) => sum + one.length, 0),
    version: createHash("sha256")
      .update(
        JSON.stringify([
          READING_MODEL,
          READING_EFFORT,
          instructions,
          READING_TASK_TEXT,
          routing,
        ]),
      )
      .digest("hex"),
  };
}

/** One model call: a part's request. */
export interface PartRequest {
  instructions: readonly string[];
  /** The user message: the task and the part's numbered words. */
  prompt: string;
  maxOutputTokens: number;
  /** Characters sent, for the ceiling's hold. */
  chars: number;
}

/** A part's request. */
export function partRequest(
  prompt: ReadingPrompt,
  part: ReadingPart,
): PartRequest {
  const message = readingPrompt(part.input);
  return {
    instructions: prompt.instructions,
    prompt: message,
    maxOutputTokens: outputCap(part.words),
    chars: prompt.instructionChars + message.length,
  };
}
