/**
 * maestro plan-approve -- approve feature plan.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { approvePlan } from '../../../../app/plans/approve-plan.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';

export default defineCommand({
  meta: { name: 'plan-approve', description: 'Approve feature plan' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const result = await approvePlan(services, args.feature);
      output(result, () => `[ok] plan approved for '${args.feature}'`);
    } catch (err) {
      handleCommandError('plan-approve', err);
    }
  },
});
