/**
 * Estimates the difficulty tier of a question from its content (and,
 * eventually, historical attempt data from modules/analytics).
 */
export interface DifficultyAnalysisInput {
  question: string;
  options: string[];
}

export interface DifficultyAnalysisOutput {
  difficulty: "easy" | "medium" | "hard";
  confidence: number;
}

export class DifficultyAnalysisChain {
  async invoke(_input: DifficultyAnalysisInput): Promise<DifficultyAnalysisOutput> {
    throw new Error("DifficultyAnalysisChain.invoke: not implemented");
  }
}
