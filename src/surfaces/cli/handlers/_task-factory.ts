/**
 * Factory for task commands that share identical logic.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../services.ts';
import { output, renderStatusLine } from '../../../infra/utils/output.ts';
import { MaestroError, handleCommandError } from '../../../domain/errors.ts';
import { readStdinText } from '../../../infra/utils/stdin.ts';
import * as fs from 'fs';
import type { TaskInfo } from '../../../domain/types.ts';
import { requireFeature, FEATURE_HINT } from '../../../infra/utils/resolve.ts';

export function makeInfoCommand() {
  return defineCommand({
    meta: { name: 'task-info', description: 'Show task details\n\nExamples:\n  maestro task-info --feature my-feat --task 01-setup\n  maestro task-info --feature my-feat --task 01-setup --json' },
    args: {
      feature: { type: 'string' as const, description: 'Feature name (defaults to active feature)' },
      task: { type: 'string' as const, description: 'Task ID', required: true },
    },
    async run({ args }) {
      try {
        const services = getServices();
        const featureName = requireFeature(services, args.feature, [FEATURE_HINT]);
        const { taskPort } = services;
        const info = await taskPort.get(featureName, args.task);
        if (!info) {
          throw new MaestroError(`Task '${args.task}' not found in feature '${featureName}'`);
        }
        output(info, (t: TaskInfo) =>
          [
            renderStatusLine('ID', t.id),
            renderStatusLine('Name', t.name),
            renderStatusLine('Status', t.status),
            renderStatusLine('Origin', t.origin),
            t.planTitle ? renderStatusLine('Plan title', t.planTitle) : null,
            t.summary ? renderStatusLine('Summary', t.summary) : null,
            t.dependsOn?.length ? renderStatusLine('Depends on', t.dependsOn.join(', ')) : null,
          ].filter(Boolean).join('\n'),
        );
      } catch (err) {
        handleCommandError('task-info', err);
      }
    },
  });
}

export function makeDocReadCommand(docType: 'spec' | 'report') {
  const portMethod = docType === 'spec' ? 'readSpec' as const : 'readReport' as const;
  return defineCommand({
    meta: { name: `task-${docType}-read`, description: `Read task ${docType}\n\nExamples:\n  maestro task-${docType}-read --feature my-feat --task 01-setup\n  maestro task-${docType}-read --feature my-feat --task 01-setup --json` },
    args: {
      feature: { type: 'string' as const, description: 'Feature name (defaults to active feature)' },
      task: { type: 'string' as const, description: 'Task ID', required: true },
    },
    async run({ args }) {
      try {
        const services = getServices();
        const featureName = requireFeature(services, args.feature, [FEATURE_HINT]);
        const { taskPort } = services;
        const content = await taskPort[portMethod](featureName, args.task);
        if (content === null) {
          throw new MaestroError(`No ${docType} found for task '${args.task}'`);
        }
        output({ content }, () => content);
      } catch (err) {
        handleCommandError(`task-${docType}-read`, err);
      }
    },
  });
}

export function makeDocWriteCommand(docType: 'spec' | 'report') {
  const portMethod = docType === 'spec' ? 'writeSpec' as const : 'writeReport' as const;
  return defineCommand({
    meta: { name: `task-${docType}-write`, description: `Write task ${docType}\n\nExamples:\n  maestro task-${docType}-write --feature my-feat --task 01-setup --content "..."\n  maestro task-${docType}-write --feature my-feat --task 01-setup --file ${docType}.md\n  echo "content" | maestro task-${docType}-write --feature my-feat --task 01-setup --stdin` },
    args: {
      feature: { type: 'string' as const, description: 'Feature name (defaults to active feature)' },
      task: { type: 'string' as const, description: 'Task ID', required: true },
      content: { type: 'string' as const, description: `Task ${docType} content (or use --file / --stdin)` },
      file: { type: 'string' as const, description: `Read ${docType} content from file` },
      stdin: { type: 'boolean' as const, description: 'Read content from stdin', default: false },
    },
    async run({ args }) {
      try {
        const services = getServices();
        const featureName = requireFeature(services, args.feature, [FEATURE_HINT]);
        const { taskPort } = services;
        let rawContent = args.content;
        if (!rawContent && args.file) {
          rawContent = fs.readFileSync(args.file, 'utf-8');
        }
        if (!rawContent && args.stdin) {
          rawContent = await readStdinText();
        }
        if (!rawContent) {
          throw new MaestroError(`No ${docType} content provided`, [
            `Pass --content "..." or --file path/to/${docType}.md or --stdin`,
          ]);
        }
        // Unescape literal \n from CLI args to actual newlines
        const content = rawContent.replace(/\\n/g, '\n');
        await taskPort[portMethod](featureName, args.task, content);
        output({ task: args.task }, () =>
          `[ok] ${docType} written for task '${args.task}'`,
        );
      } catch (err) {
        handleCommandError(`task-${docType}-write`, err);
      }
    },
  });
}
