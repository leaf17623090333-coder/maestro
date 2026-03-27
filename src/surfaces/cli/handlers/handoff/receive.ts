/**
 * maestro handoff-receive -- check for pending handoffs.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';
import { resolveFeature, requireHandoffPort } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'handoff-receive', description: 'Check for pending handoffs\n\nExamples:\n  maestro handoff-receive --json\n  maestro handoff-receive --agent-id worker-1 --json\n  maestro handoff-list --json   (alternative: list all handoff files)' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
    'agent-id': {
      type: 'string',
      description: 'Agent identifier to filter handoffs (optional, shows all if omitted)',
      alias: 'agentId',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const handoffPort = requireHandoffPort(services);

      const featureName = resolveFeature(services, args.feature);

      const handoffs = await handoffPort.receiveHandoffs(featureName ?? undefined, args['agent-id'] ?? '');

      output({ handoffs }, () => {
        if (handoffs.length === 0) return 'No pending handoffs.';
        return handoffs
          .map((h) => `- ${h.beadId}: ${h.beadState.title} [${h.beadState.status}]`)
          .join('\n');
      });
    } catch (err) {
      handleCommandError('handoff-receive', err);
    }
  },
});
