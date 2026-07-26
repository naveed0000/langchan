/**
 * Detects whether a candidate question is a near-duplicate of an existing one
 * by embedding it and searching the question vector index. See README.md
 * "Duplicate Detection Pipeline".
 */
export interface DuplicateCheckInput {
  question: string;
  similarityThreshold?: number;
}

export interface DuplicateCheckOutput {
  isDuplicate: boolean;
  matches: Array<{ questionId: string; similarity: number }>;
}

export class DuplicateCheckChain {
  async invoke(_input: DuplicateCheckInput): Promise<DuplicateCheckOutput> {
    throw new Error("DuplicateCheckChain.invoke: not implemented");
  }
}
