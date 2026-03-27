/**
 * maestro stage-back -- retreat one stage in the pipeline.
 */

import { defineCommand } from 'citty';
import { output } from '../../../../infra/utils/output.ts';
import { MaestroError } from '../../../../domain/errors.ts';
import { handleCommandError } from '../../error-handler.ts';
import { buildPlaybook } from '../../../../app/workflow/playbook.ts';
import { PIPELINE_STAGES, type PipelineStage } from '../../../../app/workflow/stages.ts';

export default defineCommand({
  meta: { name: 'stage-back', description: 'Retreat one stage back in the pipeline\n\nExamples:\n  maestro stage-back --current-stage execution\n  maestro stage-back --current-stage planning --json' },
  args: {
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
      if (currentIdx <= 0) {
        throw new MaestroError('Already at the first stage (discovery)');
      }

      const targetStage = PIPELINE_STAGES[currentIdx - 1];
      const playbook = buildPlaybook(targetStage);
      output({ previousStage: current, newStage: targetStage, playbook }, (r) =>
        `[ok] retreated from '${r.previousStage}' to '${r.newStage}'`,
      );
    } catch (err) {
      handleCommandError('stage-back', err);
    }
  },
});
