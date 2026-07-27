export type TopicStatus = "PENDING" | "COMPLETED";

export interface Distribution {
  easy: number;
  moderate: number;
  hard: number;
}

export interface QuestionTypeDistribution {
  single: number;
  multiple: number;
  numerical: number;
}

export interface ChapterGenerationConfig {
  batchsize: number;
  difficultydistribution: Distribution;
  questiontypedistribution: QuestionTypeDistribution;
  perbatchdistribution: {
    difficulty: Distribution;
    questiontype: QuestionTypeDistribution;
  };
}

export interface Topic {
  id: number | null;
  name: string;
  subtopics: string[];
  questioncount: number;
  /** Runtime tracking fields, absent until prepareInitialConfig() hydrates them. */
  remainingQuestions?: number;
  status?: TopicStatus;
}

export interface Chapter {
  id: number | null;
  name: string;
  questioncount: number;
  apicalls: number;
  generationconfig: ChapterGenerationConfig;
  topics: Topic[];
}

export interface Category {
  id: number | null;
  name: string;
  questioncount: number;
  apicalls: number;
  chapters: Chapter[];
}

/**
 * Matches storage/initial.json exactly (lowercase keys, no camelCase) — it is
 * both the generation plan and, once hydrated, the persistent execution
 * checkpoint (see docs/QnA-sprint-s2.md item 2).
 */
export interface InitialConfig {
  generationconfig: {
    exam: string;
    year: number;
    subject: string;
    language: string;
    totalquestions: number;
    batchsize: number;
    strictmode: boolean;
    outputformat: string;
    questionsperapicall: number;
    totalapicalls: number;
  };
  metadata: Record<string, unknown>;
  categories: Category[];
  questiondistribution: Record<string, unknown>;
  apicallsummary: Record<string, unknown>;
  responseschema: Record<string, unknown>;
}

export interface TopicRef {
  category: Category;
  chapter: Chapter;
  topic: Topic;
}
