// API pricing per million tokens (USD, as of April 2026)
// Cache write is simplified to input price for all models.
// Formula: cost = (input - cacheRead) × inputPrice + cacheRead × cacheReadPrice + output × outputPrice

export interface ModelPricing {
  input: number;    // $/M tokens
  output: number;   // $/M tokens
  cacheRead: number; // $/M tokens
}

// Built-in pricing table keyed by model ID patterns
const BUILTIN_PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude — input priced at cache_create rate (1.25× base input)
  'claude-opus-4.6':   { input: 6.25, output: 25.00, cacheRead: 0.50 },
  'claude-opus-4.5':   { input: 6.25, output: 25.00, cacheRead: 0.50 },
  'claude-sonnet-4.6': { input: 3.75, output: 15.00, cacheRead: 0.30 },
  'claude-sonnet-4.5': { input: 3.75, output: 15.00, cacheRead: 0.30 },
  'claude-sonnet-4':   { input: 3.75, output: 15.00, cacheRead: 0.30 },
  'claude-haiku-4.5':  { input: 1.25, output: 5.00,  cacheRead: 0.10 },

  // OpenAI GPT
  'gpt-5.4':       { input: 2.50, output: 15.00, cacheRead: 0.25 },
  'gpt-5.4-mini':  { input: 0.75, output: 4.50,  cacheRead: 0.075 },
  'gpt-5.3-codex': { input: 1.75, output: 14.00, cacheRead: 0.175 },
  'gpt-5.2-codex': { input: 1.75, output: 14.00, cacheRead: 0.175 },
  'gpt-5.2':       { input: 1.75, output: 14.00, cacheRead: 0.175 },
  'gpt-5.1':       { input: 1.25, output: 10.00, cacheRead: 0.125 },
  'gpt-5-mini':    { input: 0.25, output: 2.00,  cacheRead: 0.025 },
  'gpt-4.1':       { input: 2.00, output: 8.00,  cacheRead: 0.20 },
  'gpt-4o':        { input: 2.50, output: 10.00, cacheRead: 0.25 },

  // Google Gemini
  'gemini-2.5-pro':  { input: 1.25, output: 10.00, cacheRead: 0.125 },
  'gemini-3-flash':  { input: 0.50, output: 3.00,  cacheRead: 0.05 },
  'gemini-3.1-pro':  { input: 2.00, output: 12.00, cacheRead: 0.20 },

  // xAI
  'grok-code-fast-1': { input: 0.20, output: 1.50, cacheRead: 0.02 },
};

/** Resolve pricing for a model ID, with optional user overrides */
export function getModelPricing(
  modelId: string,
  userPricing?: Record<string, Partial<ModelPricing>>,
): ModelPricing | null {
  const id = modelId.toLowerCase();

  // User overrides take priority
  if (userPricing?.[id]) {
    const base = BUILTIN_PRICING[id];
    const override = userPricing[id];
    return {
      input: override.input ?? base?.input ?? 0,
      output: override.output ?? base?.output ?? 0,
      cacheRead: override.cacheRead ?? base?.cacheRead ?? 0,
    };
  }

  // Exact match
  if (BUILTIN_PRICING[id]) return BUILTIN_PRICING[id];

  // Fuzzy match: strip trailing suffixes and try partial matches
  for (const key of Object.keys(BUILTIN_PRICING)) {
    if (id.startsWith(key) || id.includes(key)) {
      return BUILTIN_PRICING[key];
    }
  }

  return null;
}

/**
 * Estimate API cost in USD.
 *
 * Copilot's total_input_tokens includes cache_read tokens,
 * so we subtract them to get the non-cached input portion.
 */
export function estimateCost(
  pricing: ModelPricing,
  totalInputTokens: number,
  totalOutputTokens: number,
  cacheReadTokens: number,
): number {
  const nonCacheInput = Math.max(0, totalInputTokens - cacheReadTokens);
  return (
    (nonCacheInput * pricing.input +
      cacheReadTokens * pricing.cacheRead +
      totalOutputTokens * pricing.output) /
    1_000_000
  );
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}
