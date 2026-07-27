import { Pool } from "pg";
import type { Env } from "../config/env";

let pool: Pool | undefined;

function getPool(env: Env): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: env.DATABASE_URL });
  }
  return pool;
}

/** Name (lowercased, trimmed) -> every matching row id. More than one id means the DB has a duplicate name. */
export type NameIndex = Map<string, number[]>;

function toNameIndex(rows: Array<{ id: number; name: string }>): NameIndex {
  const index: NameIndex = new Map();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    const ids = index.get(key) ?? [];
    ids.push(row.id);
    index.set(key, ids);
  }
  return index;
}

export interface TaxonomyIndexes {
  subjectCategories: NameIndex;
  chapters: NameIndex;
  topics: NameIndex;
}

/**
 * Loads the whole taxonomy in three queries and indexes it by name, rather
 * than one query per category/chapter/topic (~100 nodes in the current
 * generation plan).
 */
export async function loadTaxonomyIndexes(env: Env): Promise<TaxonomyIndexes> {
  const db = getPool(env);
  const [categories, chapters, topics] = await Promise.all([
    db.query<{ id: number; name: string }>("SELECT id, name FROM subject_categories"),
    db.query<{ id: number; name: string }>("SELECT id, name FROM chapters"),
    db.query<{ id: number; name: string }>("SELECT id, name FROM topics"),
  ]);

  return {
    subjectCategories: toNameIndex(categories.rows),
    chapters: toNameIndex(chapters.rows),
    topics: toNameIndex(topics.rows),
  };
}

/**
 * `subjects` and `exam_categories` currently hold exactly one row each
 * (physics / jee-main) in test_series_db, so these are fixed constants
 * rather than a lookup — matching the existing n8n workflow, which hardcodes
 * subjectIds: [1] / examCategoryIds: [1].
 */
export const PHYSICS_SUBJECT_ID = 1;
export const JEE_MAIN_EXAM_CATEGORY_ID = 1;
