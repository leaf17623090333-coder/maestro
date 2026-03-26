/**
 * maestro handoff-status -- check status of a specific handoff.
 */

import * as fs from 'node:fs';
import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';
import { getHandoffPath } from '../../../../infra/utils/paths.ts';
import { fileExists } from '../../../../infra/utils/fs-io.ts';

export default defineCommand({
  meta: { name: 'handoff-status', description: 'Check status of a specific handoff\n\nExamples:\n  maestro handoff-status --id maestro-1ab-implement-auth\n  maestro handoff-status --feature my-feat --id maestro-1ab-implement-auth --json' },
  args: {
    id: {
      type: 'string',
      description: 'Handoff ID (filename without .md)',
      required: true,
    },
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const feature = requireFeature(services, args.feature, [FEATURE_HINT]);
      const filePath = getHandoffPath(services.directory, feature, args.id);

      let exists = false;
      let createdAt: string | undefined;
      try {
        const stat = fs.statSync(filePath);
        exists = true;
        createdAt = stat.mtime.toISOString();
      } catch { /* file does not exist */ }

      const acknowledged = exists && fileExists(`${filePath}.ack`);
      const data = { feature, id: args.id, exists, acknowledged, filePath, createdAt };

      output(data, (d) => {
        const lines = [
          `handoff: ${d.id}`,
          `  feature:      ${d.feature}`,
          `  exists:       ${d.exists ? '[ok]' : '[x]'}`,
          `  acknowledged: ${d.acknowledged ? '[ok]' : '[x]'}`,
          `  path:         ${d.filePath}`,
        ];
        if (d.createdAt) lines.push(`  created:      ${d.createdAt}`);
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('handoff-status', err);
    }
  },
});
