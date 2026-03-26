/**
 * maestro search-similar -- find sessions similar to content.
 */

import * as fs from 'node:fs';
import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output, renderTable } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';
import { requireSearchPort } from '../../../../infra/utils/resolve.ts';
import { readStdinText } from '../../../../infra/utils/stdin.ts';

export default defineCommand({
  meta: { name: 'search-similar', description: 'Find sessions similar to given content\n\nExamples:\n  maestro search-similar --content "implement auth middleware"\n  maestro search-similar --file src/auth.ts --limit 5 --json\n  echo "some code" | maestro search-similar --stdin' },
  args: {
    content: {
      type: 'string',
      description: 'Content text to find similar sessions for',
    },
    file: {
      type: 'string',
      description: 'Read content from this file path',
    },
    stdin: {
      type: 'boolean',
      description: 'Read content from stdin',
    },
    limit: {
      type: 'string',
      description: 'Max results (default: 10)',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const searchPort = requireSearchPort(services);

      let content: string;
      if (args.content) {
        content = args.content;
      } else if (args.file) {
        content = fs.readFileSync(args.file, 'utf-8');
      } else if (args.stdin) {
        content = await readStdinText();
      } else {
        throw new Error('One of --content, --file, or --stdin is required.');
      }

      const limit = args.limit ? parseInt(args.limit, 10) : undefined;
      const results = await searchPort.searchSimilar(content, { limit });

      output({ results }, () => {
        if (results.length === 0) return 'No similar sessions found.';
        return renderTable(
          ['Session', 'Agent', 'Match', 'Score'],
          results.map((r) => [r.sessionPath, r.agent, r.matchLine, String(r.score)]),
        );
      });
    } catch (err) {
      handleCommandError('search-similar', err);
    }
  },
});
