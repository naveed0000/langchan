/**
 * The LLMs you want to run, in priority order. Edit this array — the first
 * entry that connects wins. List one or many; the behavior is the same
 * (single = a list of one). Case/space-insensitive.
 *
 * Valid ids (see src/models/registry.ts to add more — one line each):
 *   "gemini"          -> gemini-2.5-flash
 *   "gemini-2.5-pro"  -> gemini-2.5-pro
 *   "openai"          -> gpt-4o-mini
 *   "gpt-4o"          -> gpt-4o
 *   "ollama"          -> local model from OLLAMA_CHAT_MODEL
 *
 * Example: ["gemini", "openai", "ollama"]
 */
export const LLM_MODELS: string[] = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini",
  "ollama",
];
