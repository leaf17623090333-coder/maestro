/**
 * maestro plan-approve -- approve feature plan.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { approvePlan } from '../../../../app/plans/approve-plan.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'plan-approve', description: 'Approve feature plan\n\nExamples:\n  maestro plan-approve --feature my-feat\n  maestro plan-approve --feature my-feat --json' },
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
      const result = await approvePlan(services, featureName);
      output(result, () => `[ok] plan approved for '${featureName}'`);
    } catch (err) {
      handleCommandError('plan-approve', err);
    }
  },
});
