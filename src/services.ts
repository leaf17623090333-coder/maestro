/**
 * Module-level singleton for service wiring.
 *
 * citty doesn't propagate parent context to subcommands (runCommand passes
 * only rawArgs), so we use a module-level singleton. Root command calls
 * initServices() in its run() before dispatching subcommands. Each subcommand
 * calls getServices().
 *
 * v2: Toolbox-driven port resolution via ADAPTER_FACTORIES registry.
 * External adapters are resolved by tool name from manifests, not hardcoded.
 */

// Built-in adapters (not toolbox-driven, always static)
import { FsFeatureAdapter } from './infra/adapters/features/adapter.ts';
import { FsPlanAdapter } from './infra/adapters/plans/adapter.ts';
import { FsMemoryAdapter } from './infra/adapters/memory/adapter.ts';
import { AgentsMdAdapter } from './infra/adapters/features/agents-md.ts';
import { MaestroError } from './domain/errors.ts';
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

export interface MaestroServices {
  taskPort: TaskPort;
  verificationPort: VerificationPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  memoryAdapter: MemoryPort;
  agentsMdAdapter: AgentsMdAdapter;
  directory: string;
  graphPort?: GraphPort;
  handoffPort?: HandoffPort;
  searchPort?: SearchPort;
  doctrinePort?: DoctrinePort;
  // v2: toolbox + settings + agent tools + workflow
  toolbox: ToolboxRegistry;
  settingsPort: SettingsPort;
  agentToolsRegistry: AgentToolsRegistry;
  workflowRegistry?: import('./app/workflow/registry.ts').WorkflowRegistry;
  /** Resolved task backend: 'fs' or 'br'. Use this instead of resolveTaskBackend(). */
  taskBackend: 'fs' | 'br';
  /** Host backend (null for standalone). */
  hostBackend?: HostBackend;
}

let _services: MaestroServices | undefined;

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

  // Explicit backend choice overrides toolbox priority
  if (settings.tasks.backend === 'fs') {
    return { port: new FsTaskAdapter(directory, settings.tasks.claimExpiresMinutes), backend: 'fs' };
  }
  if (settings.tasks.backend === 'br') {
    const factory = toolbox.isAvailable('br') ? getAdapterFactory('br') : null;
    if (factory) return { port: factory(makeCtx('br')) as TaskPort, backend: 'br' };
    return { port: new FsTaskAdapter(directory, settings.tasks.claimExpiresMinutes), backend: 'fs' };
  }
  // 'auto': toolbox resolves by priority
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

export function initServices(
  directory: string,
  toolbox?: ToolboxRegistry,
): MaestroServices {
  const settingsAdapter = new FsSettingsAdapter(directory);
  const settings = settingsAdapter.get();
  const tb = toolbox ?? buildToolbox(settings);

  // Always built-in (not toolbox-driven)
  const memoryAdapter = new FsMemoryAdapter(directory);
  const verificationConfig = resolveVerificationConfig(settings.verification);

  // Phase 1: independent ports (no cross-port deps)
  const { port: taskPort, backend: taskBackend } = resolveTaskPort(tb, settings, directory);
  const makeCtx = buildContext(tb, settings, directory);
  const graphPort = resolveOptionalPort<GraphPort>(tb, 'graph', makeCtx);
  const searchPort = resolveOptionalPort<SearchPort>(tb, 'search', makeCtx);

  // Phase 2: dependent ports (need Phase 1 results)
  const makeCtxWithPorts = buildContext(tb, settings, directory, {
    taskPort, memoryPort: memoryAdapter, settingsPort: settingsAdapter, taskBackend,
  });
  const handoffPort = resolveOptionalPort<HandoffPort>(tb, 'handoff', makeCtxWithPorts);

  _services = {
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
  };

  return _services;
}

export function getServices(): MaestroServices {
  if (!_services) {
    throw new MaestroError(
      'Services not initialized',
      ['Run maestro from a project directory with .maestro/ or run: maestro init'],
    );
  }

  // Hot-swap taskPort when settings.tasks.backend changes
  const settings = _services.settingsPort.get();
  const { port, backend } = resolveTaskPort(_services.toolbox, settings, _services.directory);
  if (backend !== _services.taskBackend) {
    _services.taskPort = port;
    _services.taskBackend = backend;
  }

  return _services;
}
