/**
 * Produces a step-by-step explanation for a question's correct answer.
 * TODO: implement as an LCEL pipeline over ai/prompts + ai/models.
 */
export interface ExplanationInput {
  question: string;
  correctAnswer: string;
  context?: string;
}

export interface ExplanationOutput {
  explanation: string;
}

export class ExplanationChain {
  async invoke(_input: ExplanationInput): Promise<ExplanationOutput> {
    throw new Error("ExplanationChain.invoke: not implemented");
  }
}
