/**
 * Generates exam-style questions from retrieved source content.
 * TODO: implement as an LCEL pipeline: prompt (ai/prompts) -> model (ai/models) -> parser (ai/parsers).
 */
export interface QuestionGenerationInput {
  sourceText: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface QuestionGenerationOutput {
  question: string;
  options: string[];
  correctAnswer: string;
}

export class QuestionGenerationChain {
  async invoke(_input: QuestionGenerationInput): Promise<QuestionGenerationOutput> {
    throw new Error("QuestionGenerationChain.invoke: not implemented");
  }
}
