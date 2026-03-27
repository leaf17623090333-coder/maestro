/**
 * maestro memory-list -- list memory files for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output, renderTable } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'memory-list', description: 'List memory files\n\nExamples:\n  maestro memory-list --feature my-feat\n  maestro memory-list --feature my-feat --json' },
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
      const files = memoryAdapter.listWithMeta(featureName);
      output(files, (items) => {
        if (items.length === 0) return 'No memory files found.';
        const rows = items.map(f => [
          f.name,
          `${f.content.length} chars`,
          f.metadata.category ?? '-',
          f.metadata.tags?.join(', ') || '-',
          String(f.metadata.priority ?? 2),
          f.updatedAt,
        ]);
        return renderTable(['Name', 'Size', 'Category', 'Tags', 'Pri', 'Updated'], rows);
      });
    } catch (err) {
      handleCommandError('memory-list', err);
    }
  },
});
