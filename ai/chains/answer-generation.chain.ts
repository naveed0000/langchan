/**
 * Derives the correct answer (and distractors, where applicable) for a
 * question from retrieved source context, independent of question-generation
 * so answers can be re-derived/audited without regenerating the question.
 */
export interface AnswerGenerationInput {
  question: string;
  context: string;
}

export interface AnswerGenerationOutput {
  correctAnswer: string;
  distractors: string[];
}

export class AnswerGenerationChain {
  async invoke(_input: AnswerGenerationInput): Promise<AnswerGenerationOutput> {
    throw new Error("AnswerGenerationChain.invoke: not implemented");
  }
}
