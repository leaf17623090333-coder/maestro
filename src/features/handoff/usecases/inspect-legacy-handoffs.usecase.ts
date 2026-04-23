import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { MAESTRO_DIR } from "@/shared/domain/defaults.js";

export async function countLegacyHandoffFiles(projectDir: string): Promise<number> {
  return (
    await Promise.all([
      countEntries(join(projectDir, MAESTRO_DIR, "handoffs")),
      countEntries(join(projectDir, MAESTRO_DIR, "launches")),
    ])
  ).reduce((sum, count) => sum + count, 0);
}

async function countEntries(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() || entry.isDirectory()).length;
  } catch {
    return 0;
  }
}
