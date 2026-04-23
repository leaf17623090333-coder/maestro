import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { MAESTRO_DIR } from "@/shared/domain/defaults.js";

export interface CountLegacyHandoffFilesOptions {
  readonly homeDir?: string;
}

export async function countLegacyHandoffFiles(
  projectDir: string,
  options: CountLegacyHandoffFilesOptions = {},
): Promise<number> {
  const homeRoot = options.homeDir ?? homedir();
  return (
    await Promise.all([
      countEntries(join(projectDir, MAESTRO_DIR, "handoffs")),
      countEntries(join(projectDir, MAESTRO_DIR, "launches")),
      countEntries(join(homeRoot, MAESTRO_DIR, "launches")),
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
