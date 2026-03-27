/**
 * maestro memory-archive -- archive all memory files for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'memory-archive', description: 'Archive memory files\n\nExamples:\n  maestro memory-archive --feature my-feat\n  maestro memory-archive --feature my-feat --json' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const featureName = requireFeature(services, args.feature, [FEATURE_HINT]);
      const { memoryAdapter } = services;
      const result = memoryAdapter.archive(featureName);
      output(result, (r) => {
        if (r.archived.length === 0) return 'No memory files to archive.';
        return `[ok] archived ${r.archived.length} file(s) --> ${r.archivePath}\n` +
          r.archived.map((name: string) => `  - ${name}`).join('\n');
      });
    } catch (err) {
      handleCommandError('memory-archive', err);
    }
  },
});
