/**
 * maestro handoff-ack -- acknowledge a handoff.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';
import { requireHandoffPort } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'handoff-ack', description: 'Acknowledge a handoff\n\nExamples:\n  maestro handoff-ack --thread-id abc123\n  maestro handoff-ack --thread-id abc123 --json' },
  args: {
    'thread-id': {
      type: 'string',
      description: 'Agent Mail thread ID to acknowledge',
      required: true,
      alias: 'threadId',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const handoffPort = requireHandoffPort(services);

      await handoffPort.acknowledgeHandoff(args['thread-id']);

      output({ threadId: args['thread-id'] }, () =>
        `[ok] acknowledged thread '${args['thread-id']}'`,
      );
    } catch (err) {
      handleCommandError('handoff-ack', err);
    }
  },
});
