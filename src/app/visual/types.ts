import type { ExecutionInsight, DoctrineEffectivenessInsight } from '../workflow/insights.ts';

// ============================================================================
// Re-export pure visual types from domain layer
// ============================================================================

export type {
  TemplateInput,
  TemplateOutput,
  TemplateRenderer,
  MaestroVisualType,
  DebugVisualType,
  VisualType,
  VisualResult,
  PlanGraphTask,
  PlanGraphData,
  DoctrineStats,
  StatusDashboardData,
  MemoryMapEntry,
  MemoryMapData,
  DoctrineNetworkData,
  ComponentTreeNode,
  ComponentTreeData,
  StateFlowEntry,
  StateFlowData,
  ErrorCascadeEntry,
  ErrorCascadeData,
  NetworkRequest,
  NetworkWaterfallData,
  DomDiffData,
  ConsoleEntry,
  ConsoleTimelineData,
} from '../../domain/visual-types.ts';

export {
  MAESTRO_VISUAL_TYPES,
  DEBUG_VISUAL_TYPES,
} from '../../domain/visual-types.ts';

// ============================================================================
// App-layer types (depend on app/workflow/insights.ts)
// ============================================================================

export interface ExecutionTimelineData {
  insights: ExecutionInsight[];
  knowledgeFlow: Array<{ from: string; to: string; proximity: number }>;
  coverage: { totalTasks: number; withExecMemory: number; percent: number };
  doctrineEffectiveness?: DoctrineEffectivenessInsight[];
  feature: string;
}
