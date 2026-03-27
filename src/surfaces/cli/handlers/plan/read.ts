/**
 * maestro plan-read -- read feature plan.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError, MaestroError } from '../../../../domain/errors.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'plan-read', description: 'Read feature plan\n\nExamples:\n  maestro plan-read --feature my-feat\n  maestro plan-read --feature my-feat --json' },
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
      const result = planAdapter.read(featureName);

      if (!result) {
        throw new MaestroError(`No plan found for feature '${featureName}'`, [
          'Write a plan first: maestro plan-write --feature <name> --content "..."',
        ]);
      }

      output(result, (r) => {
        const lines = [
          `status: ${r.status}`,
          `comments: ${r.comments.length}`,
          '',
          r.content,
        ];
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('plan-read', err);
    }
  },
});
