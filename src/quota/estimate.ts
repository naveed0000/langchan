/**
 * Cheap pre-flight token estimate: ~4 chars per token for the prompt plus the
 * model's configured expected output. Used only to reserve TPM budget before a
 * call — the real count from usage_metadata reconciles it afterward.
 *
 * ponytail: char/4 heuristic, no tokenizer dependency. Swap for @dqbd/tiktoken
 * or the provider's count-tokens endpoint if TPM enforcement needs to be exact.
 */
export function estimateTokens(promptText: string, expectedOutputTokens: number): number {
  return Math.ceil(promptText.length / 4) + expectedOutputTokens;
}
