/**
 * Scoped, immutable service container for maestroCLI.
 *
 * createContainer() replaces the initServices() singleton pattern.
 * Returns a frozen object -- no hot-swapping, no module-level state.
 * Each surface (CLI, MCP, hooks) creates its own container instance.
 */

import { FsFeatureAdapter } from './infra/adapters/features/adapter.ts';
import { FsPlanAdapter } from './infra/adapters/plans/adapter.ts';
import { FsMemoryAdapter } from './infra/adapters/memory/adapter.ts';
import { AgentsMdAdapter } from './infra/adapters/features/agents-md.ts';
import { FsVerificationAdapter } from './infra/adapters/tasks/verification-adapter.ts';
import { resolveVerificationConfig } from './infra/adapters/tasks/verification-config.ts';
import { FsDoctrineAdapter } from './infra/adapters/doctrine/adapter.ts';
import { FsSettingsAdapter } from './infra/settings/adapter.ts';
import { FsTaskAdapter } from './infra/adapters/tasks/adapter.ts';
import { buildToolbox, ToolboxRegistry } from './infra/toolbox/registry.ts';
import { getAdapterFactory } from './infra/toolbox/loader.ts';
import { buildAgentToolsRegistry, AgentToolsRegistry } from './infra/toolbox/agents/registry.ts';
import type { AdapterContext } from './infra/toolbox/types.ts';
import type { MaestroSettings, SettingsPort } from './domain/ports/settings.ts';
import type { TaskPort } from './domain/ports/task.ts';
import type { VerificationPort } from './domain/ports/verification.ts';
import type { FeaturePort } from './domain/ports/feature.ts';
import type { PlanPort } from './domain/ports/plan.ts';
import type { MemoryPort } from './domain/ports/memory.ts';
import type { GraphPort } from './domain/ports/graph.ts';
import type { HandoffPort } from './domain/ports/handoff.ts';
import type { SearchPort } from './domain/ports/search.ts';
import type { DoctrinePort } from './domain/ports/doctrine.ts';
import type { HostBackend } from './domain/ports/host.ts';
import { createHostBackend } from './infra/adapters/host/factory.ts';
import { detectHost } from './infra/utils/host-detect.ts';
import type { AgentMemoryRetriever } from './infra/toolbox/tools/external/agent-memory/adapter.ts';

export interface MaestroContainer {
  readonly taskPort: TaskPort;
  readonly verificationPort: VerificationPort;
  readonly featureAdapter: FeaturePort;
  readonly planAdapter: PlanPort;
  readonly memoryAdapter: MemoryPort;
  readonly agentsMdAdapter: AgentsMdAdapter;
  readonly directory: string;
  readonly graphPort?: GraphPort;
  readonly handoffPort?: HandoffPort;
  readonly searchPort?: SearchPort;
  readonly doctrinePort?: DoctrinePort;
  readonly toolbox: ToolboxRegistry;
  readonly settingsPort: SettingsPort;
  readonly agentToolsRegistry: AgentToolsRegistry;
  readonly workflowRegistry?: import('./app/workflow/registry.ts').WorkflowRegistry;
  readonly taskBackend: 'fs' | 'br';
  readonly hostBackend?: HostBackend;
  readonly agentMemoryRetriever?: AgentMemoryRetriever;
}

function buildContext(
  toolbox: ToolboxRegistry,
  settings: MaestroSettings,
  directory: string,
  ports: Record<string, unknown> = {},
): (toolName: string) => AdapterContext {
  return (toolName: string) => ({
    projectRoot: directory,
    settings,
    toolConfig: settings.toolbox.config[toolName] ?? {},
    manifest: toolbox.getManifest(toolName)!,
    ports,
  });
}

function resolveTaskPort(
  toolbox: ToolboxRegistry,
  settings: MaestroSettings,
  directory: string,
): { port: TaskPort; backend: 'fs' | 'br' } {
  const makeCtx = buildContext(toolbox, settings, directory);
  if (settings.tasks.backend === 'fs') {
    return { port: new FsTaskAdapter(directory, settings.tasks.claimExpiresMinutes), backend: 'fs' };
  }
  if (settings.tasks.backend === 'br') {
    const factory = toolbox.isAvailable('br') ? getAdapterFactory('br') : null;
    if (factory) return { port: factory(makeCtx('br')) as TaskPort, backend: 'br' };
    return { port: new FsTaskAdapter(directory, settings.tasks.claimExpiresMinutes), backend: 'fs' };
  }
  const provider = toolbox.resolveProvider('tasks');
  if (provider?.name === 'br') {
    const factory = getAdapterFactory('br');
    if (factory) return { port: factory(makeCtx('br')) as TaskPort, backend: 'br' };
  }
  return { port: new FsTaskAdapter(directory, settings.tasks.claimExpiresMinutes), backend: 'fs' };
}

function resolveOptionalPort<T>(
  toolbox: ToolboxRegistry,
  portName: string,
  makeCtx: (name: string) => AdapterContext,
): T | undefined {
  const provider = toolbox.resolveProvider(portName);
  if (!provider) return undefined;
  const factory = getAdapterFactory(provider.name);
  if (!factory) return undefined;
  return factory(makeCtx(provider.name)) as T;
}

export function createContainer(
  directory: string,
  toolbox?: ToolboxRegistry,
): MaestroContainer {
  const settingsAdapter = new FsSettingsAdapter(directory);
  const settings = settingsAdapter.get();
  const tb = toolbox ?? buildToolbox(settings);

  const memoryAdapter = new FsMemoryAdapter(directory);
  const verificationConfig = resolveVerificationConfig(settings.verification);

  const { port: taskPort, backend: taskBackend } = resolveTaskPort(tb, settings, directory);
  const makeCtx = buildContext(tb, settings, directory);
  const graphPort = resolveOptionalPort<GraphPort>(tb, 'graph', makeCtx);
  const searchPort = resolveOptionalPort<SearchPort>(tb, 'search', makeCtx);

  const makeCtxWithPorts = buildContext(tb, settings, directory, {
    taskPort, memoryPort: memoryAdapter, settingsPort: settingsAdapter, taskBackend,
  });
  const handoffPort = resolveOptionalPort<HandoffPort>(tb, 'handoff', makeCtxWithPorts);

  // agentMemory: optional retrieval engine (read-only, enhances DCP)
  let agentMemoryRetriever: AgentMemoryRetriever | undefined;
  if (tb.isAvailable('agent-memory')) {
    const amFactory = getAdapterFactory('agent-memory');
    if (amFactory) {
      try {
        agentMemoryRetriever = amFactory(makeCtx('agent-memory')) as AgentMemoryRetriever;
      } catch { /* graceful: fall back to standard DCP */ }
    }
  }

  return Object.freeze({
    taskPort,
    taskBackend,
    verificationPort: new FsVerificationAdapter(verificationConfig),
    featureAdapter: new FsFeatureAdapter(directory),
    planAdapter: new FsPlanAdapter(directory),
    memoryAdapter,
    agentsMdAdapter: new AgentsMdAdapter(directory, memoryAdapter),
    directory,
    graphPort,
    handoffPort,
    searchPort,
    doctrinePort: new FsDoctrineAdapter(directory),
    toolbox: tb,
    settingsPort: settingsAdapter,
    agentToolsRegistry: buildAgentToolsRegistry(settings.agentTools),
    hostBackend: createHostBackend(detectHost(), directory) ?? undefined,
    agentMemoryRetriever,
  });
}
