import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PHYSICS_SUBJECT_ID, JEE_MAIN_EXAM_CATEGORY_ID } from "../database/taxonomy";
import { buildSystemPrompt, buildUserContent, type BatchContext } from "./prompt-builder";
import { QuestionBatchSchema, type GeneratedQuestion, type GeneratedQuestionBatch } from "./question-schema";

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
): Promise<GeneratedQuestion[]> {
  const structuredModel = model.withStructuredOutput<GeneratedQuestionBatch>(QuestionBatchSchema);
  const result = await structuredModel.invoke([
    new SystemMessage(buildSystemPrompt(context)),
    new HumanMessage(buildUserContent(context)),
  ]);

  return result.questions.map((question) => ({
    ...question,
    subjectIds: [PHYSICS_SUBJECT_ID],
    subjectCategoryIds: context.categoryId !== null ? [context.categoryId] : [],
    chapterIds: context.chapterId !== null ? [context.chapterId] : [],
    topicIds: context.topicId !== null ? [context.topicId] : [],
    examCategoryIds: [JEE_MAIN_EXAM_CATEGORY_ID],
  }));
}
