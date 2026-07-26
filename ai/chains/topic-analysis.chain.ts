/**
 * Classifies a chunk of source text or a question into its subject/chapter/topic,
 * used to tag ingested content and generated questions for filtered retrieval.
 */
export interface TopicAnalysisInput {
  text: string;
}

export interface TopicAnalysisOutput {
  subject: string;
  chapter: string;
  topic: string;
}

export class TopicAnalysisChain {
  async invoke(_input: TopicAnalysisInput): Promise<TopicAnalysisOutput> {
    throw new Error("TopicAnalysisChain.invoke: not implemented");
  }
}
