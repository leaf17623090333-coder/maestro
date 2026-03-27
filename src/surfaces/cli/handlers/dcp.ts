/**
 * maestro dcp-preview -- DCP introspection: preview, stats, and config.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../services.ts';
import { output, renderTable } from '../../../infra/utils/output.ts';
import { MaestroError } from '../../../domain/errors.ts';
import { handleCommandError } from '../error-handler.ts';
import { requireFeature, FEATURE_HINT } from '../../../infra/utils/resolve.ts';
import { pruneContext } from '../../../app/dcp/prune-context.ts';
import { resolveDcpConfig } from '../../../app/dcp/config.ts';
import { WORKER_RULES } from '../../../app/tasks/worker-rules.ts';
import { collectMetrics, formatMetricsSummary } from '../../../app/dcp/metrics.ts';
import { COMPONENT_REGISTRY } from '../../../app/dcp/components.ts';
import { DEFAULT_SETTINGS } from '../../../domain/ports/settings.ts';

export default defineCommand({
  meta: { name: 'dcp-preview', description: 'DCP introspection: preview memory selection, stats, or config\n\nExamples:\n  maestro dcp-preview --feature my-feat --task 01-setup\n  maestro dcp-preview --feature my-feat --task 01-setup --what stats\n  maestro dcp-preview --what config\n  maestro dcp-preview --feature my-feat --task 01-setup --json' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (uses active feature if omitted)',
    },
    task: {
      type: 'string',
      description: 'Task folder ID (required for preview and stats)',
    },
    what: {
      type: 'string',
      description: 'What to show: preview (default), stats, or config',
      default: 'preview',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const what = args.what as 'preview' | 'stats' | 'config';

      if (what === 'config') {
        const dcpSettings = services.settingsPort.get().dcp;
        const resolved = resolveDcpConfig(dcpSettings);
        const data = {
          settings: resolved,
          components: COMPONENT_REGISTRY.map(c => ({
            name: c.name,
            priority: c.priority,
            protected: c.protected,
          })),
          defaults: DEFAULT_SETTINGS.dcp,
        };
        output(data, (d) => {
          const lines: string[] = ['# DCP Config'];
          lines.push(`  enabled:      ${d.settings.enabled}`);
          lines.push(`  memoryBudget: ${d.settings.memoryBudgetTokens} tokens`);
          lines.push('');
          lines.push('Components:');
          const rows = d.components.map(c => [
            c.name,
            String(c.priority),
            c.protected ? '[ok]' : '',
          ]);
          lines.push(renderTable(['Name', 'Priority', 'Protected'], rows));
          return lines.join('\n');
        });
        return;
      }

      // preview and stats both need task
      if (!args.task) {
        throw new MaestroError(`--task is required for --what ${what}`, ['Specify --task <folder-id>']);
      }

      const feature = requireFeature(services, args.feature, [FEATURE_HINT]);

      const task = await services.taskPort.get(feature, args.task);
      if (!task) {
        throw new MaestroError(`Task '${args.task}' not found in feature '${feature}'`);
      }

      const spec = await services.taskPort.readSpec(feature, args.task) ?? '(no spec)';
      const memories = services.memoryAdapter.listWithMeta(feature);
      const resolvedDcp = resolveDcpConfig(services.settingsPort.get().dcp);
      const featureInfo = services.featureAdapter.get(feature);
      const featureCreatedAt = featureInfo?.createdAt;
      const allTasks = await services.taskPort.list(feature, { includeAll: true });
      const taskDeps = allTasks.map(t => ({
        id: t.id, folder: t.folder, status: t.status, dependsOn: t.dependsOn,
      }));

      if (what === 'preview') {
        const { metrics } = pruneContext({
          featureName: feature,
          taskFolder: args.task,
          task,
          spec,
          memories,
          richContext: '',
          graphContext: '',
          workerRules: WORKER_RULES,
          dcpConfig: resolvedDcp,
          featureCreatedAt,
          allTasks: taskDeps,
        });

        output(metrics, (m) => {
          const lines: string[] = [];
          lines.push(`# DCP Preview: ${args.task}`);
          lines.push(`  feature:  ${feature}`);
          lines.push(`  enabled:  ${resolvedDcp.enabled}`);
          lines.push(`  budget:   ${resolvedDcp.memoryBudgetTokens} tokens`);
          lines.push(`  memories: ${m.memoriesIncluded}/${m.memoriesTotal} included, ${m.memoriesDropped} dropped`);
          lines.push('');

          if (m.scores.length > 0) {
            const rows = m.scores.map(s => [
              s.name,
              (Math.round(s.score * 1000) / 1000).toString(),
              s.included ? '[ok]' : '[x]',
            ]);
            lines.push(renderTable(['Memory', 'Score', 'Included'], rows));
          } else {
            lines.push('  No memories found.');
          }

          return lines.join('\n');
        });
        return;
      }

      // what === 'stats'
      const result = pruneContext({
        featureName: feature,
        taskFolder: args.task,
        task,
        spec,
        memories,
        richContext: '',
        graphContext: '',
        workerRules: WORKER_RULES,
        dcpConfig: resolvedDcp,
        featureCreatedAt,
        allTasks: taskDeps,
      });
      const metricsData = collectMetrics(result, memories);
      output({ feature, task: args.task, metrics: metricsData }, (d) => {
        return `# DCP Stats: ${d.task}\n  feature: ${d.feature}\n\n${formatMetricsSummary(d.metrics)}`;
      });

    } catch (err) {
      handleCommandError('dcp-preview', err);
    }
  },
});
