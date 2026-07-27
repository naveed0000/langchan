import type { Env } from "../config/env";
import { loadTaxonomyIndexes, type NameIndex } from "../database/taxonomy";
import { readInitialConfig, writeInitialConfig } from "./config-store";
import type { InitialConfig } from "./types";

export interface NameResolutionIssue {
  level: "category" | "chapter" | "topic";
  name: string;
}

export interface AmbiguousMatch extends NameResolutionIssue {
  ids: number[];
  chosenId: number;
}

export interface PrepareReport {
  resolvedCategories: number;
  resolvedChapters: number;
  resolvedTopics: number;
  hydratedTopics: number;
  unmatched: NameResolutionIssue[];
  ambiguous: AmbiguousMatch[];
}

function resolveId(
  name: string,
  index: NameIndex,
  level: NameResolutionIssue["level"],
  report: PrepareReport,
): number | null {
  const ids = index.get(name.trim().toLowerCase());
  if (!ids) {
    report.unmatched.push({ level, name });
    return null;
  }
  if (ids.length > 1) {
    const chosenId = Math.min(...ids);
    report.ambiguous.push({ level, name, ids, chosenId });
    return chosenId;
  }
  return ids[0]!;
}

/**
 * One-time (but idempotent) preparation of storage/initial.json before a
 * generation run: fills every "id": null from the real test_series_db
 * taxonomy tables, and hydrates each topic with the status/remainingQuestions
 * fields the traversal engine mutates as it goes (docs/QnA-sprint-s2.md #1, #2).
 *
 * Safe to call on every run — already-resolved ids and already-hydrated
 * progress fields are left untouched, which is what makes resuming a crashed
 * run possible.
 */
export async function prepareInitialConfig(
  env: Env,
): Promise<{ config: InitialConfig; report: PrepareReport }> {
  const config = await readInitialConfig();
  const taxonomy = await loadTaxonomyIndexes(env);

  const report: PrepareReport = {
    resolvedCategories: 0,
    resolvedChapters: 0,
    resolvedTopics: 0,
    hydratedTopics: 0,
    unmatched: [],
    ambiguous: [],
  };
  let changed = false;

  for (const category of config.categories) {
    if (category.id === null) {
      const id = resolveId(category.name, taxonomy.subjectCategories, "category", report);
      if (id !== null) {
        category.id = id;
        report.resolvedCategories++;
        changed = true;
      }
    }

    for (const chapter of category.chapters) {
      if (chapter.id === null) {
        const id = resolveId(chapter.name, taxonomy.chapters, "chapter", report);
        if (id !== null) {
          chapter.id = id;
          report.resolvedChapters++;
          changed = true;
        }
      }

      for (const topic of chapter.topics) {
        if (topic.id === null) {
          const id = resolveId(topic.name, taxonomy.topics, "topic", report);
          if (id !== null) {
            topic.id = id;
            report.resolvedTopics++;
            changed = true;
          }
        }
        if (topic.status === undefined) {
          topic.status = topic.questioncount > 0 ? "PENDING" : "COMPLETED";
          changed = true;
        }
        if (topic.remainingQuestions === undefined) {
          topic.remainingQuestions = topic.questioncount;
          report.hydratedTopics++;
          changed = true;
        }
      }
    }
  }

  if (changed) {
    await writeInitialConfig(config);
  }

  return { config, report };
}
