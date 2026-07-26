/**
 * Checks a draft question for correctness, clarity, and difficulty alignment
 * before it can be auto-approved. See README.md "Validation Pipeline".
 */
export interface ValidationInput {
  question: string;
  options: string[];
  correctAnswer: string;
  expectedDifficulty: "easy" | "medium" | "hard";
}

export type ValidationVerdict = "approved" | "needs_review" | "rejected";

export interface ValidationOutput {
  verdict: ValidationVerdict;
  reasons: string[];
}

export class ValidationChain {
  async invoke(_input: ValidationInput): Promise<ValidationOutput> {
    throw new Error("ValidationChain.invoke: not implemented");
  }
}
