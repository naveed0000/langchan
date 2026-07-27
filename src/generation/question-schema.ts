import { z } from "zod";

export const OptionSchema = z.object({
  name: z.string(),
  isCorrect: z.boolean(),
});

/**
 * Mirrors the canonical request/response contract from the existing n8n
 * workflow (docs/QnA-sprint-s2.md item 5): one object per generated question.
 * `options` is required for Single/Multiple and absent for Numerical;
 * `inputBox` is the reverse. Zod can't express that cross-field rule
 * declaratively, so both are optional here and checked structurally in
 * worker.ts's validation step instead.
 */
export const QuestionSchema = z.object({
  question: z.string(),
  explanation: z.string(),
  hint: z.string(),
  optionType: z.enum(["Single", "Multiple", "Numerical"]),
  difficultyLevel: z.enum(["easy", "moderate", "hard"]),
  // Plain string, not z.literal(): Gemini's function-calling schema converter
  // rejects JSON Schema's "const" keyword (400 Bad Request). The system
  // prompt instructs the model to always set this to "admin" instead.
  role: z.string(),
  latex: z.array(z.string()),
  options: z.array(OptionSchema).optional(),
  inputBox: z.string().optional(),
  images: z.array(z.string()),
  subjectIds: z.array(z.number()),
  subjectCategoryIds: z.array(z.number()),
  chapterIds: z.array(z.number()),
  topicIds: z.array(z.number()),
  examCategoryIds: z.array(z.number()),
});

export type GeneratedQuestion = z.infer<typeof QuestionSchema>;

/**
 * Structured-output schemas need an object at the top level for most
 * providers' function-calling/JSON-mode implementations, so the batch is
 * wrapped rather than returned as a bare array.
 */
export const QuestionBatchSchema = z.object({
  questions: z.array(QuestionSchema),
});

export type GeneratedQuestionBatch = z.infer<typeof QuestionBatchSchema>;
