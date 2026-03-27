/**
 * maestro stage-jump -- jump to a specific pipeline stage.
 */

import { defineCommand } from 'citty';
import { output } from '../../../../infra/utils/output.ts';
import { MaestroError } from '../../../../domain/errors.ts';
import { handleCommandError } from '../../error-handler.ts';
import { buildPlaybook } from '../../../../app/workflow/playbook.ts';
import { PIPELINE_STAGES, type PipelineStage } from '../../../../app/workflow/stages.ts';

export default defineCommand({
  meta: { name: 'stage-jump', description: 'Jump to a specific pipeline stage\n\nExamples:\n  maestro stage-jump --target execution --current-stage planning\n  maestro stage-jump --target research --current-stage discovery --json' },
  args: {
    target: {
      type: 'string',
      description: `Target stage to jump to (${PIPELINE_STAGES.join(', ')})`,
      required: true,
    },
    'current-stage': {
      type: 'string',
      description: `Current pipeline stage (${PIPELINE_STAGES.join(', ')})`,
      required: true,
    },
  },
  async run({ args }) {
    try {
      const current = args['current-stage'] as PipelineStage;
      const currentIdx = PIPELINE_STAGES.indexOf(current);
      if (currentIdx === -1) {
        throw new MaestroError(`Unknown stage: ${current}`, [`Valid stages: ${PIPELINE_STAGES.join(', ')}`]);
      }

      const target = args.target as PipelineStage;
      if (!PIPELINE_STAGES.includes(target)) {
        throw new MaestroError(`Invalid target: ${target}`, [`Valid stages: ${PIPELINE_STAGES.join(', ')}`]);
      }

      const playbook = buildPlaybook(target);
      output({ previousStage: current, newStage: target, playbook }, (r) =>
        `[ok] jumped from '${r.previousStage}' to '${r.newStage}'`,
      );
    } catch (err) {
      handleCommandError('stage-jump', err);
    }
  },
});
