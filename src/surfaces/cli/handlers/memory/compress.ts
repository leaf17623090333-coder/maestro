/**
 * maestro memory-compress -- compress a memory file to reduce size.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { MaestroError, handleCommandError } from '../../../../domain/errors.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'memory-compress', description: 'Compress a memory file to reduce size\n\nExamples:\n  maestro memory-compress --name api-findings\n  maestro memory-compress --name api-findings --feature my-feat --json' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
    name: {
      type: 'string',
      description: 'Memory file name to compress',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const featureName = requireFeature(services, args.feature, [FEATURE_HINT]);

      const success = services.memoryAdapter.compress(featureName, args.name);
      if (!success) {
        throw new MaestroError(
          `memory '${args.name}' not found in feature '${featureName}'`,
          ['Use maestro memory-list --json to see available memories'],
        );
      }

      output({ feature: featureName, name: args.name, compressed: true }, () =>
        `[ok] compressed '${args.name}' in feature '${featureName}'`,
      );
    } catch (err) {
      handleCommandError('memory-compress', err);
    }
  },
});
