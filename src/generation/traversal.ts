import type { InitialConfig, Topic, TopicRef } from "./types";

/** First non-COMPLETED topic, walking category -> chapter -> topic in array order. */
export function findNextTopic(config: InitialConfig): TopicRef | null {
  for (const category of config.categories) {
    for (const chapter of category.chapters) {
      for (const topic of chapter.topics) {
        const remaining = topic.remainingQuestions ?? topic.questioncount;
        if (topic.status !== "COMPLETED" && remaining > 0) {
          return { category, chapter, topic };
        }
      }
    }
  }
  return null;
}

/** Up to 5 batches per execution pass (docs/QnA-sprint-s2.md item 4), fewer if the topic needs fewer. */
export function allocateBatchCount(topic: Topic, batchSize: number, maxBatchesPerExecution = 5): number {
  const remaining = topic.remainingQuestions ?? topic.questioncount;
  const batchesNeeded = Math.ceil(remaining / batchSize);
  return Math.min(maxBatchesPerExecution, Math.max(0, batchesNeeded));
}

/**
 * Mutates the topic in place: subtract one batch's worth of questions and
 * mark it COMPLETED once nothing remains. Called after each individual
 * successful batch (not after the whole 5-batch group) so a crash mid-group
 * only loses the batches that hadn't completed yet — see the reconciliation
 * note in docs/sprint-s2-output.md.
 */
export function applyBatchCompletion(topic: Topic, batchSize: number): void {
  const remaining = (topic.remainingQuestions ?? topic.questioncount) - batchSize;
  topic.remainingQuestions = Math.max(0, remaining);
  if (topic.remainingQuestions === 0) {
    topic.status = "COMPLETED";
  }
}
