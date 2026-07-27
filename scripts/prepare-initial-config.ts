import { loadEnv } from "../src/config/env";
import { prepareInitialConfig } from "../src/generation/prepare-config";
import { logSuccess, logInfo, logWarn } from "../src/utils/logger";

async function main(): Promise<void> {
  const env = loadEnv();
  const { report } = await prepareInitialConfig(env);

  logSuccess(
    `Resolved ${report.resolvedCategories} categories, ${report.resolvedChapters} chapters, ${report.resolvedTopics} topics`,
  );
  logInfo(`Hydrated ${report.hydratedTopics} topics with status/remainingQuestions`);

  for (const issue of report.unmatched) {
    logWarn(`No DB match for ${issue.level} "${issue.name}"`);
  }
  for (const issue of report.ambiguous) {
    logWarn(
      `Ambiguous ${issue.level} "${issue.name}": DB has ids [${issue.ids.join(", ")}], chose ${issue.chosenId}`,
    );
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
