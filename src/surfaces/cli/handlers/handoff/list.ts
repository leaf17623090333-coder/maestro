/**
 * maestro handoff-list -- list handoffs for a feature.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output, renderTable } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../error-handler.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';
import { getHandoffsPath } from '../../../../infra/utils/paths.ts';
import { fileExists } from '../../../../infra/utils/fs-io.ts';

export default defineCommand({
  meta: { name: 'handoff-list', description: 'List handoffs for a feature\n\nExamples:\n  maestro handoff-list\n  maestro handoff-list --feature my-feat --json' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const feature = requireFeature(services, args.feature, [FEATURE_HINT]);
      const handoffsDir = getHandoffsPath(services.directory, feature);

      const entries: Array<{ id: string; filePath: string; createdAt: string; acknowledged: boolean }> = [];
      try {
        const files = fs.readdirSync(handoffsDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
          const filePath = path.join(handoffsDir, file);
          const stat = fs.statSync(filePath);
          const id = file.replace(/\.md$/, '');
          const ackPath = `${filePath}.ack`;
          entries.push({
            id,
            filePath,
            createdAt: stat.mtime.toISOString(),
            acknowledged: fileExists(ackPath),
          });
        }
      } catch {
        // No handoffs directory yet
      }

      output({ feature, handoffs: entries, count: entries.length }, () => {
        if (entries.length === 0) return 'No handoffs found.';
        return renderTable(
          ['ID', 'Created', 'Acked'],
          entries.map((e) => [e.id, e.createdAt, e.acknowledged ? '[ok]' : '[x]']),
        );
      });
    } catch (err) {
      handleCommandError('handoff-list', err);
    }
  },
});
