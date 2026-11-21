/** Actual additive migration subsets for focused SQL fixtures with only one table.
 * The populated upgrade suite separately applies the whole production migration.
 */
import { readFileSync } from "node:fs";

const statements = readFileSync(
  new URL("../../drizzle/0029_research_short_pilot.sql", import.meta.url),
  "utf8",
)
  .split("--> statement-breakpoint")
  .map((sql) => sql.trim())
  .filter(Boolean);
function tableDdl(table: string, count: number) {
  const selected = statements.filter((sql) =>
    sql.startsWith(`ALTER TABLE "${table}" `),
  );
  if (selected.length !== count)
    throw Error("Short pilot migration shape changed");
  return selected.join("\n");
}
export const shortResearchArtifactsDdl = tableDdl("chat_research_artifacts", 2);
export const shortResearchMaintenanceDdl = tableDdl(
  "chat_research_maintenance",
  4,
);
