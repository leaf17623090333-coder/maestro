import { readdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { dirExists } from "@/shared/lib/fs.js";

const MAESTRO_DIR = join(process.cwd(), ".maestro");
const MISSIONS_DIR = join(MAESTRO_DIR, "missions");
const SKILLS_DIR = join(MAESTRO_DIR, "skills");

const LEGACY_WORKER_BASE = "maestro:worker-base";
const AGENT_BASE = "maestro:agent-base";

type Outcome = "migrated" | "skipped" | "error";

async function renameDir(from: string, to: string, label: string): Promise<Outcome> {
  const [fromExists, toExists] = await Promise.all([dirExists(from), dirExists(to)]);
  if (!fromExists) return "skipped";
  if (toExists) {
    console.log(`[ok] ${label}: skipped -- target already exists (${to})`);
    return "skipped";
  }
  try {
    await rename(from, to);
    console.log(`[ok] ${label}: ${from} -> ${to}`);
    return "migrated";
  } catch (err) {
    console.error(`[!] ${label}: failed to rename ${from}: ${(err as Error).message}`);
    return "error";
  }
}

async function migrateMissionsWorkersDirs(): Promise<{ migrated: number; skipped: number; errors: number }> {
  const counts = { migrated: 0, skipped: 0, errors: 0 };
  if (!(await dirExists(MISSIONS_DIR))) {
    console.log("[ok] No .maestro/missions directory. Nothing to migrate.");
    return counts;
  }

  const missionDirs = await readdir(MISSIONS_DIR);
  for (const missionId of missionDirs) {
    if (missionId.startsWith(".")) continue;
    const missionPath = join(MISSIONS_DIR, missionId);
    try {
      const info = await stat(missionPath);
      if (!info.isDirectory()) continue;
    } catch {
      continue;
    }
    const from = join(missionPath, "workers");
    const to = join(missionPath, "agents");
    const result = await renameDir(from, to, `mission ${missionId}`);
    counts[result === "migrated" ? "migrated" : result === "error" ? "errors" : "skipped"] += 1;
  }
  return counts;
}

async function migrateSkillsWorkerBaseDir(): Promise<Outcome> {
  if (!(await dirExists(SKILLS_DIR))) return "skipped";
  const from = join(SKILLS_DIR, LEGACY_WORKER_BASE);
  const to = join(SKILLS_DIR, AGENT_BASE);
  return renameDir(from, to, "skill maestro:worker-base");
}

async function main(): Promise<void> {
  const missionCounts = await migrateMissionsWorkersDirs();
  const skillResult = await migrateSkillsWorkerBaseDir();

  const migrated = missionCounts.migrated + (skillResult === "migrated" ? 1 : 0);
  const skipped = missionCounts.skipped + (skillResult === "skipped" ? 1 : 0);
  const errors = missionCounts.errors + (skillResult === "error" ? 1 : 0);

  console.log(`[ok] Migrated ${migrated} directories (${skipped} skipped or already on new layout)`);
  if (errors > 0) {
    console.error(`[!] ${errors} renames failed`);
    process.exit(1);
  }
}

await main();
