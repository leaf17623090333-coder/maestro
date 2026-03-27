/**
 * maestro plan-comments-clear -- clear all plan comments.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../error-handler.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'plan-comments-clear', description: 'Clear all plan comments\n\nExamples:\n  maestro plan-comments-clear --feature my-feat\n  maestro plan-comments-clear --feature my-feat --json' },
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
      const { planAdapter } = services;
      planAdapter.clearComments(featureName);

      output({ feature: featureName }, () => `[ok] comments cleared`);
    } catch (err) {
      handleCommandError('plan-comments-clear', err);
    }
  },
});
