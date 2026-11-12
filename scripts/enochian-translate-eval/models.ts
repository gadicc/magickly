/**
 * The models plan 077 calls, all through Vercel AI Gateway, and the settings
 * each kind of request runs with.
 */

/** The models by the short names the CLI takes. */
export const MODELS = {
  opus: "anthropic/claude-opus-5.5",
  fable: "anthropic/claude-fable-5.2",
  gpt: "openai/gpt-6.1-sol",
} as const;

export type ModelName = keyof typeof MODELS;

/** A gateway model id ("anthropic/claude-opus-5.5"). */
export type ModelId = (typeof MODELS)[ModelName];

/** Reasoning effort, passed as the AI SDK's portable `reasoning` option. */
export type Effort = "medium" | "high";

export const EFFORTS: readonly Effort[] = ["medium", "high"];

/** What a request is for; it sets the output allowance and the cap. */
export type RequestKind = "translate" | "judge" | "probe";

/**
 * The output tokens (thinking included) a request is expected to use, for the
 * projection made before any call (plan 077, "Models and budget": 10,000 to
 * 30,000 thinking tokens a translation at `high`). Judges and the probe write
 * much less.
 */
export const OUTPUT_ALLOWANCE: Readonly<
  Record<RequestKind, Record<Effort, number>>
> = {
  translate: { high: 25_000, medium: 12_000 },
  judge: { high: 10_000, medium: 5_000 },
  probe: { high: 8_000, medium: 4_000 },
};

/**
 * The most output a request may produce, thinking included: the hard limit
 * sent with it (`maxOutputTokens`), and so its worst case for the budget. A
 * reply cut off at this length has no answer block and counts against the
 * model, so it is set well above the allowance.
 */
export const MAX_OUTPUT_TOKENS: Readonly<
  Record<RequestKind, Record<Effort, number>>
> = {
  translate: { high: 64_000, medium: 32_000 },
  judge: { high: 32_000, medium: 32_000 },
  probe: { high: 24_000, medium: 24_000 },
};

/** The short name a model id goes by in request ids. */
export function shortName(model: string): string {
  const found = Object.entries(MODELS).find(([, id]) => id === model);
  return found ? found[0] : model.replace(/[^A-Za-z0-9.-]+/g, "_");
}

/** Reads `--model`: one of the short names. */
export function modelId(name: string): ModelId {
  if (!Object.hasOwn(MODELS, name))
    throw new Error(
      `--model must be one of ${Object.keys(MODELS).join(", ")}, not "${name}"`,
    );
  return MODELS[name as ModelName];
}

/** Reads `--effort`: a comma-separated list of efforts. */
export function efforts(list: string): Effort[] {
  const out = list.split(",").map((one) => one.trim());
  for (const one of out)
    if (!EFFORTS.includes(one as Effort))
      throw new Error(`--effort takes ${EFFORTS.join(", ")}, not "${one}"`);
  return out as Effort[];
}
