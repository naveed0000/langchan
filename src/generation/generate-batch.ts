import { HumanMessage, SystemMessage, type AIMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PHYSICS_SUBJECT_ID, JEE_MAIN_EXAM_CATEGORY_ID } from "../database/taxonomy";
import { estimateTokens } from "../quota/estimate";
import type { TokenUsage } from "../quota/types";
import { buildSystemPrompt, buildUserContent, type BatchContext } from "./prompt-builder";
import { QuestionBatchSchema, type GeneratedQuestion, type GeneratedQuestionBatch } from "./question-schema";

export interface BatchResult {
  questions: GeneratedQuestion[];
  usage: TokenUsage;
}

/**
 * Pull real token counts off the raw AIMessage. LangChain normalizes every
 * provider's usage into `usage_metadata`; if a provider omits it (some
 * structured-output paths do), fall back to an estimate and flag it so the
 * caller knows the number isn't authoritative.
 */
function readUsage(raw: AIMessage, promptText: string, completionText: string): TokenUsage {
  const meta = raw.usage_metadata;
  if (meta && meta.total_tokens) {
    return {
      promptTokens: meta.input_tokens,
      completionTokens: meta.output_tokens,
      totalTokens: meta.total_tokens,
      estimated: false,
    };
  }
  const promptTokens = estimateTokens(promptText, 0);
  const completionTokens = estimateTokens(completionText, 0);
  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, estimated: true };
}

/**
 * One structured-output call: builds the prompt, asks the model to return
 * JSON matching QuestionBatchSchema, and hands back the typed questions.
 * Works against any BaseChatModel — the Gemini/Ollama choice happens in
 * llm.factory before this is called.
 *
 * The model cannot know real test_series_db ids, so subjectIds/
 * subjectCategoryIds/chapterIds/topicIds/examCategoryIds are stamped here
 * from context rather than trusted from the LLM's output.
 */
export async function generateQuestionBatch(
  model: BaseChatModel,
  context: BatchContext,
): Promise<BatchResult> {
  const systemPrompt = buildSystemPrompt(context);
  const userContent = buildUserContent(context);

  // includeRaw keeps the AIMessage alongside the parsed object so we can read
  // usage_metadata — plain withStructuredOutput() drops it.
  const structuredModel = model.withStructuredOutput<GeneratedQuestionBatch>(QuestionBatchSchema, {
    includeRaw: true,
  });
  const { raw, parsed } = await structuredModel.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userContent),
  ]);

  const usage = readUsage(raw as AIMessage, `${systemPrompt}\n${userContent}`, JSON.stringify(parsed));

  const questions = parsed.questions.map((question) => ({
    ...question,
    subjectIds: [PHYSICS_SUBJECT_ID],
    subjectCategoryIds: context.categoryId !== null ? [context.categoryId] : [],
    chapterIds: context.chapterId !== null ? [context.chapterId] : [],
    topicIds: context.topicId !== null ? [context.topicId] : [],
    examCategoryIds: [JEE_MAIN_EXAM_CATEGORY_ID],
  }));

  return { questions, usage };
}
