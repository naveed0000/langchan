import type { AppConfig } from "./config";

/**
 * Composition root: the one place concrete implementations (model providers,
 * vector stores, repositories) are constructed and wired into the services
 * that depend on them. Everything downstream depends on interfaces, not on
 * this file.
 */
export interface Container {
  config: AppConfig;
}

export function createContainer(config: AppConfig): Container {
  // TODO: construct and attach shared singletons (logger, db pool, model clients).
  return { config };
}
