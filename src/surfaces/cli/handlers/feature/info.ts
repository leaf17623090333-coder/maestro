/**
 * maestro feature-info -- show feature details.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output, renderStatusLine } from '../../../../infra/utils/output.ts';
import { MaestroError } from '../../../../domain/errors.ts';
import { handleCommandError } from '../../error-handler.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'feature-info', description: 'Show feature details\n\nExamples:\n  maestro feature-info --feature my-feat\n  maestro feature-info --feature my-feat --json' },
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
      const { featureAdapter } = services;
      const info = featureAdapter.getInfo(featureName);

      if (!info) {
        throw new MaestroError(`Feature '${featureName}' not found`);
      }

      output(info, (i) =>
        [
          renderStatusLine('Name', i.name),
          renderStatusLine('Status', i.status),
          renderStatusLine('Has plan', String(i.hasPlan)),
          renderStatusLine('Comments', String(i.commentCount)),
        ].join('\n'),
      );
    } catch (err) {
      handleCommandError('feature-info', err);
    }
  },
});
