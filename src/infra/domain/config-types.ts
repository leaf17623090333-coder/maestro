import type { AgentSlug } from "@/features/session";
import type { WorkerConfig } from "@/features/agent";
import type { MemoryConfig } from "@/features/memory";
import type { WorkflowTemplate } from "@/features/mission";
import type { UiConfig } from "@/shared/domain/ui-config.js";

export interface MaestroConfig {
  readonly defaultAgent?: AgentSlug;
  readonly sourceRepo?: string;
  readonly sessionDetection?: {
    readonly enabled: boolean;
    readonly agents: readonly AgentSlug[];
    readonly staleMinutes?: number;
  };
  readonly defaultWorkflow?: string;
  readonly workflowTemplates?: Readonly<Record<string, WorkflowTemplate>>;
  readonly execution?: {
    readonly defaultWorker?: string;
  };
  readonly workers?: Readonly<Record<string, WorkerConfig>>;
  readonly ui?: UiConfig;
  readonly memory?: MemoryConfig;
}

export const DEFAULT_CONFIG: MaestroConfig = {
  sessionDetection: {
    enabled: true,
    agents: ["claude-code"],
  },
  defaultWorkflow: "plan-implement",
  execution: {
    defaultWorker: "codex",
  },
  workers: {
    "claude-code": {
      enabled: true,
      transport: "cli",
      command: "claude",
      args: ["--print"],
    },
    codex: {
      enabled: true,
      transport: "cli",
      command: "codex",
      args: [],
    },
    gemini: {
      enabled: false,
      transport: "cli",
      command: "gemini",
      args: [],
    },
  },
  ui: {
    missionControl: {
      backgroundMode: "solid",
    },
  },
  memory: {
    enabled: true,
    corrections: { enabled: true, matching: "keyword", auto_capture: "prompt", severity_default: "soft" },
    learnings: { enabled: true, compile_threshold: 5, max_age_days: 7 },
    ratchet: { enabled: false, enforcement: "warn" },
    graph: { enabled: true },
  } satisfies MemoryConfig,
};
