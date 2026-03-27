/**
 * maestro skill-sync -- rescan skill registry and clean up broken entries.
 */

import { defineCommand } from 'citty';
import { syncSkills } from '../../../../app/skills/sync.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../error-handler.ts';

export default defineCommand({
  meta: { name: 'skill-sync', description: 'Rescan skill registry and clean up broken entries\n\nExamples:\n  maestro skill-sync\n  maestro skill-sync --json' },
  args: {},
  async run() {
    try {
      const projectRoot = process.cwd();
      const result = syncSkills(projectRoot);
      output(result, (r) => `[ok] skill sync complete\n  discovered: ${r.discovered}\n  cleaned:    ${r.cleaned}`);
    } catch (err) {
      handleCommandError('skill-sync', err);
    }
  },
});
