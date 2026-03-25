# maestroCLI v2 Architecture

## Design Principles

1. **Subsystem modules** -- each domain owns its port, adapter, usecase, and utilities
2. **Toolbox** -- external ecosystem tools are first-class, not hardcoded
3. **Single usecase layer** -- CLI and MCP are thin surfaces calling the same usecases
4. **Unified error envelope** -- one response shape everywhere
5. **Port resolution via toolbox** -- external overrides built-in, absent means unavailable
6. **Downward-only dependencies** -- Layer 3 (surfaces) --> Layer 2 (domains) --> Layer 1 (infra) --> Layer 0 (core)

---

## Layer Model

```
LAYER 3 -- Entry points (depend on everything below)
  cli/            --> usecases in all domain modules + core/
  mcp/            --> usecases in all domain modules + core/
  hooks/          --> dcp/, workflow/, tasks/, memory/, core/, services

LAYER 2b -- Cross-cutting orchestrators (depend on multiple domains)
  dcp/            --> memory/, tasks/, doctrine/, core/
  workflow/       --> features/, plans/, tasks/, memory/, core/

LAYER 2a -- Domain modules (depend on core/ and occasionally each other)
  features/       --> core/
  plans/          --> core/
  tasks/          --> core/, plans/ (for spec extraction from plan)
  memory/         --> core/
  doctrine/       --> core/
  handoff/        --> core/ (port only; adapter in toolbox)
  search/         --> core/ (port only; adapter in toolbox)
  visual/         --> core/

LAYER 1 -- Composition + Discovery
  services.ts     --> all domain modules, toolbox/
  toolbox/        --> core/, domain port interfaces

LAYER 0 -- Foundation (no business dependencies)
  core/           --> nothing (only node:* and external packages)
  skills/         --> core/frontmatter only
```

Allowed direction: **down only**. No upward or lateral dependencies within the same layer.

---

## Directory Structure

```
src/
  core/                              # LAYER 0 -- Shared infrastructure (no business logic)
    types.ts                         # All shared types, enums, config interfaces
    errors.ts                        # MaestroError, MaestroResponse<T> envelope
    config.ts                        # ConfigPort + FsConfigAdapter (always built-in)
    output.ts                        # CLI output formatting (renderTable, etc.)
    signals.ts                       # Process signal handlers + cleanup registry
    truncation.ts                    # Response size limiting
    resolve.ts                       # requireFeature, requirePort helpers
    resolve-backend.ts               # Task backend resolution (fs vs br)
    tokens.ts                        # estimateTokens (chars/4), shared by DCP + doctrine
    frontmatter.ts                   # parseFrontmatter, parseFrontmatterRich, serializeFrontmatter
    fs-io.ts                         # writeAtomic, readJson, ensureDir
    locking.ts                       # File locking primitives
    paths.ts                         # getMaestroPath, getFeaturePath, etc.
    slug.ts                          # titleToSlug, buildTaskFolder
    validate-name.ts                 # Input sanitization
    git.ts                           # Git utilities (audit, diff, changed files)
    cli-runner.ts                    # CLI subprocess runner (used by toolbox adapters)

  toolbox/                           # LAYER 1 -- Tool management system
    tools/
      built-in/                      # Maestro's native fs-based backends
        fs-tasks/
          manifest.json
          adapter.ts                 # FsTaskAdapter -- plain-file task backend
      external/                      # Ecosystem tools (user installs separately)
        br/
          manifest.json              # provides: "tasks", overrides fs-tasks
          adapter.ts                 # BrTaskAdapter -- beads_rust CLI
        bv/
          manifest.json              # provides: "graph"
          adapter.ts                 # BvGraphAdapter -- beads viewer CLI
        cass/
          manifest.json              # provides: "search"
          adapter.ts                 # CassSearchAdapter -- cass CLI
        agent-mail/
          manifest.json              # provides: "handoff"
          adapter.ts                 # AgentMailHandoffAdapter -- agent-mail HTTP
          skills/                    # Tool-specific skills bundled with adapter
            maestro:handoff-protocol/
        git/
          manifest.json              # utility, no port
        rg/
          manifest.json              # utility, no port
        tilth/
          manifest.json              # provides: "code-intel"
    registry.ts                      # Scan dirs, detect tools, resolve port providers
    loader.ts                        # Adapter factory loading via AdapterContext
    types.ts                         # ToolManifest, ToolStatus, AdapterContext

  features/                          # LAYER 2a -- Feature lifecycle
    port.ts                          # FeaturePort interface
    adapter.ts                       # FsFeatureAdapter
    usecases.ts                      # create, list, info, active, complete
    detection.ts                     # listFeatures, findProjectRoot
    agents-md.ts                     # AgentsMdPort + AgentsMdAdapter (audit fix #10)

  plans/                             # LAYER 2a -- Plan lifecycle
    port.ts                          # PlanPort interface
    adapter.ts                       # FsPlanAdapter
    usecases.ts                      # write, read, approve, revoke, comment, clearComments
    parser.ts                        # parseTasksFromPlan, validateDependencyGraph, detectCycles
    scaffold.md                      # Plan template

  tasks/                             # LAYER 2a -- Task lifecycle (largest domain)
    port.ts                          # TaskPort interface (ONLY types -- no runtime logic)
    transitions.ts                   # VALID_TRANSITIONS, isValidTransition, isActiveTask
    usecases.ts                      # sync, translate, claim, completeTask, accept, reject, block, unblock, brief, list, info
    spec-builder.ts                  # buildSpecContent, extractPlanSection
    bead-builder.ts                  # buildBeadOpts, buildBeadDescription
    worker-rules.ts                  # WORKER_RULES constant
    verification/                    # Owned by tasks/ (tightly coupled to task lifecycle)
      port.ts                        # VerificationPort, VerificationReport, VerificationCriterion
      adapter.ts                     # FsVerificationAdapter (build, git-diff, summary, ac-match)
      config.ts                      # resolveVerificationConfig, defaults
      usecase.ts                     # verifyTask, makeAutoPass, inferTaskType
    graph/
      port.ts                        # GraphPort, GraphInsights, NextRecommendation, ExecutionPlan
      dependency.ts                  # buildEffectiveDependencies, computeRunnableAndBlocked
      proximity.ts                   # extractSourceTask, buildDownstreamMap, scoreDependencyProximity
      check.ts                       # checkDependencies (gate before claiming)

  memory/                            # LAYER 2a -- Memory lifecycle (pure memory, no DCP)
    port.ts                          # MemoryPort interface
    adapter.ts                       # FsMemoryAdapter
    usecases.ts                      # write, read, list, delete, compile, promote, archive, stats
    execution/
      writer.ts                      # buildExecutionMemory, writeExecutionMemory
      parser.ts                      # parseExecMemory, groupByTagCluster, listRecentFeatures
      inference.ts                   # inferCategory, inferTags, inferMetadata

  dcp/                               # LAYER 2b -- Dynamic Context Protocol (cross-cutting orchestrator)
    config.ts                        # resolveDcpConfig, DCP_DEFAULTS
    pruner.ts                        # pruneContext -- assembles full worker injection
    selector.ts                      # selectMemories (scoring + budget-fill)
    relevance.ts                     # scoreRelevance (5 dimensions + proximity bonus)
    budget.ts                        # fitWithinBudget (generic greedy fill)
    historical.ts                    # queryHistoricalContext

  doctrine/                          # LAYER 2a -- Doctrine compiler (cross-feature learning)
    port.ts                          # DoctrinePort, DoctrineItem, DoctrineStatus
    adapter.ts                       # FsDoctrineAdapter (fs storage + in-process cache)
    usecases.ts                      # write, read, list, deprecate, approve
    suggest.ts                       # suggestDoctrine (heuristic analysis engine)
    trace.ts                         # appendDoctrineTrace, readDoctrineTrace, collectDoctrineNames
    factory.ts                       # buildDoctrineItem (construction helper)
    config.ts                        # resolveDoctrineConfig, DOCTRINE_DEFAULTS

  handoff/                           # LAYER 2a -- Agent handoff (port only; adapter in toolbox)
    port.ts                          # HandoffPort, HandoffDocument, HandoffResult
    usecases.ts                      # send, receive, ack

  search/                            # LAYER 2a -- Session/code search (port only; adapter in toolbox)
    port.ts                          # SearchPort, SessionSearchResult
    usecases.ts                      # sessions, related

  visual/                            # LAYER 2a -- Visualization system
    usecases.ts                      # visualize, debugVisualize, gatherPlanGraph, gatherStatusDashboard
    renderer.ts                      # escapeHtml, safeStringify, sanitizeMermaid, renderTemplate
    css.ts                           # MAESTRO_CSS, GOOGLE_FONTS_LINK, CDN refs
    types.ts                         # TemplateInput, TemplateOutput (import data shapes from core/types.ts)
    templates/                       # 11 renderers (unchanged)
      plan-graph.ts
      status-dashboard.ts
      memory-map.ts
      execution-timeline.ts
      doctrine-network.ts
      state-flow.ts
      component-tree.ts
      dom-diff.ts
      error-cascade.ts
      network-waterfall.ts
      console-timeline.ts

  workflow/                          # LAYER 2b -- Workflow Engine (replaces static playbook)
    engine.ts                        # NEW: core orchestrator -- stage + collect + filter + recommend
    registry.ts                      # NEW: tool workflow metadata store (stage, category, requires, contextHint)
    recommender.ts                   # NEW: contextual recommendation builder (urgency sorting, primary/secondary)
    events.ts                        # NEW: event bus (emit/on for plan-approved, task-done, etc.)
    stages.ts                        # PipelineStage, derivePipelineStage, countTaskStatuses
    status.ts                        # checkStatus usecase (calls engine.recommend() now)
    doctor.ts                        # doctor usecase (health checks, tool validation)
    ping.ts                          # ping usecase (version + backend info)
    insights.ts                      # executionInsights usecase
    history.ts                       # history usecase
    research-tools.ts                # detectResearchTools (MCP tool detection)

  skills/                            # LAYER 1 -- Skill loading
    built-in/                        # 21 built-in skill directories (maestro methodology)
    external/                        # User/community skills
    registry.generated.ts            # Build-time generated skill content
    registry.ts                      # Skill loading, stage filtering
    aliases.ts                       # Legacy name mappings
    external-discovery.ts            # Discover from skills/ + toolbox/tools/*/skills/
    generate.ts                      # Build script for registry.generated.ts

  hooks/                             # LAYER 3 -- Claude Code hooks
    _helpers.ts                      # readStdin, writeOutput, resolveProjectDir
    sessionstart.ts                  # Pipeline guidance + research tool injection
    pre-agent.ts                     # Task spec + DCP + worker rules injection
    pretooluse.ts                    # Workflow enforcement on Bash
    posttooluse.ts                   # Event tracking after maestro MCP calls
    precompact.ts                    # State snapshot before context compression

  cli/                               # LAYER 3 -- CLI surface (thin handlers only)
    index.ts                         # Entry point, citty app setup
    registry.ts                      # Command registration (generated)
    handlers/
      feature.ts                     # create, list, info, active, complete
      plan.ts                        # write, read, approve, revoke, comment, comments-clear
      task.ts                        # sync, list, next, info, done, spec-read/write, report-read/write
      memory.ts                      # write, read, list, delete, compile, archive, stats, promote
      doctrine.ts                    # write, read, list, deprecate, suggest, approve
      handoff.ts                     # send, receive, ack
      graph.ts                       # insights, next, plan
      search.ts                      # sessions, related
      config.ts                      # get, set, agent
      visual.ts                      # visual, debug-visual
      skill.ts                       # load, list
      status.ts                      # status
      doctor.ts                      # doctor
      init.ts                        # init, install
      update.ts                      # self-update, update (CLI-only, includes self-update usecase)
      agents-md.ts                   # agents-md generation
      dcp.ts                         # dcp-preview
      history.ts                     # history
      execution-insights.ts          # execution-insights

  mcp/                               # LAYER 3 -- MCP surface (thin handlers only)
    index.ts                         # createMaestroServer, tool registration
    services-thunk.ts                # Lazy service initialization for MCP
    handlers/
      feature.ts                     # 5 tools
      plan.ts                        # 6 tools
      task.ts                        # 12 tools + brief
      memory.ts                      # 7 tools
      doctrine.ts                    # 6 tools
      handoff.ts                     # 3 tools (conditional on toolbox)
      graph.ts                       # 3 tools (conditional on toolbox)
      search.ts                      # 2 tools (conditional on toolbox)
      config.ts                      # 1 tool
      visual.ts                      # 2 tools
      skill.ts                       # 2 tools
      workflow.ts                    # status, ping, doctor, init, history, dcp, execution-insights
    respond.ts                       # MaestroResponse envelope, withErrorHandling, stripNulls
    annotations.ts                   # READONLY, MUTATING, DESTRUCTIVE
    params.ts                        # featureParam, taskParam, limitParam

  services.ts                        # LAYER 1 -- Composition root (reads toolbox, wires adapters)
  version.ts                         # VERSION constant
```

---

## Toolbox Design

### Manifest Schema

```jsonc
// toolbox/tools/external/br/manifest.json
{
  "name": "br",
  "description": "beads_rust task manager -- structured task backend with bead sync",
  "binary": "br",
  "detect": "br --version",
  "install": "cargo install beads_rust",
  "homepage": "https://github.com/user/beads_rust",

  "provides": "tasks",
  "priority": 100,
  "adapter": "./adapter.ts",

  "requires": [],
  "mcpTools": [
    "tasks_sync", "task_next", "task_claim", "task_done",
    "task_accept", "task_reject", "task_block", "task_unblock",
    "task_list", "task_info", "task_spec_read", "task_report_read"
  ]
}
```

```jsonc
// toolbox/tools/built-in/fs-tasks/manifest.json
{
  "name": "fs-tasks",
  "description": "Plain filesystem task backend -- works without external tools",
  "binary": null,
  "detect": null,
  "provides": "tasks",
  "priority": 0,
  "adapter": "./adapter.ts"
}
```

```jsonc
// toolbox/tools/external/agent-mail/manifest.json
{
  "name": "agent-mail",
  "description": "Agent coordination and handoff via mcp-agent-mail",
  "binary": null,
  "detect": null,
  "provides": "handoff",
  "priority": 100,
  "adapter": "./adapter.ts",
  "inject": ["projectRoot", "taskPort", "memoryPort", "configPort"]
}
```

### Adapter Factory Pattern

Adapters with complex dependencies use a factory function + `AdapterContext`:

```typescript
// toolbox/types.ts
interface AdapterContext {
  projectRoot: string;
  config: HiveConfig;
  ports: Partial<MaestroServices>;  // Available ports at wiring time
  toolbox: ToolboxRegistry;
}

// Each adapter exports a factory:
// toolbox/tools/external/br/adapter.ts
export function createAdapter(ctx: AdapterContext): TaskPort {
  return new BrTaskAdapter(ctx.projectRoot);
}

// toolbox/tools/external/agent-mail/adapter.ts
export function createAdapter(ctx: AdapterContext): HandoffPort {
  return new AgentMailHandoffAdapter(
    ctx.projectRoot,
    ctx.ports.taskPort!,
    ctx.ports.memoryPort!,
    ctx.ports.configPort!,
  );
}
```

### Port Resolution

```
resolvePortProvider(portName: string): ToolManifest | null

1. Scan toolbox/tools/external/ -- collect manifests where provides === portName
2. Run detect command for each -- filter to installed only
3. Scan toolbox/tools/built-in/ -- collect same (built-in with detect=null always passes)
4. Merge lists, sort by priority DESC
5. Return highest-priority installed tool, or null

"tasks": br (100, installed) > fs-tasks (0, always) --> br wins
"graph": bv (100, installed) > nothing               --> bv wins, or null if not installed
```

### Tool Detection Timing

Tool detection runs at **server creation time** (before MCP tool registration), NOT lazily.
`createMaestroServer()` awaits `scanToolbox()` to know which conditional tools to register.

---

## Unified Error Envelope

```typescript
// core/errors.ts
type MaestroResponse<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string; suggestions?: string[]; code?: string };
```

All MCP responses and CLI outputs use this shape. No `success: true/false` vs `terminal` vs inline error patterns. Every handler wraps its usecase call in `withErrorHandling()` which catches `MaestroError` and returns the envelope.

---

## CLI/MCP Parity -- completeTask usecase

The full verification + auto-reject + auto-accept state machine extracted to `tasks/usecases.ts`:

```typescript
// tasks/usecases.ts
async function completeTask(opts: CompleteTaskOpts): Promise<CompleteTaskResult> {
  const { taskPort, verificationPort, memoryPort, doctrinePort, config } = opts;

  // 1. Read task (for claimedAt, revisionCount, spec, AC)
  const task = await taskPort.get(feature, folder);
  const spec = await taskPort.readSpec(feature, folder);
  const ac = spec ? extractAcceptanceCriteria(spec) : undefined;

  // 2. Run verification
  const report = await verifyTask({
    verificationPort, config: config.verification,
    projectRoot, featureName, taskFolder: folder,
    summary, specContent: spec, acceptanceCriteria: ac,
    claimedAt: task.claimedAt,
  });

  // 3. If passed --> done
  if (report.report.passed) {
    await taskPort.done(feature, folder, summary);
    await writeExecutionMemory({ ... });
    return { status: 'done', report: report.report };
  }

  // 4. If failed --> review
  await taskPort.review(feature, folder);

  // 5. Auto-accept after maxRevisions
  if (config.verification.autoReject && task.revisionCount >= config.verification.maxRevisions) {
    await taskPort.done(feature, folder, summary);
    await writeExecutionMemory({ ... });
    return { status: 'done', warning: `Auto-accepted after ${task.revisionCount} revision(s)` };
  }

  // 6. Auto-reject to revision
  if (config.verification.autoReject) {
    const feedback = report.report.suggestions.join('; ') || 'Verification failed';
    await taskPort.revision(feature, folder, feedback, task.revisionCount + 1);
    return { status: 'revision', feedback, report: report.report };
  }

  // 7. Manual review
  return { status: 'review', report: report.report };
}
```

Both CLI and MCP call `completeTask()` -- zero divergence.

---

## Hook Bundling Constraint

Hooks are bundled as standalone `.mjs` files. They CANNOT use dynamic toolbox loading
(dynamic `import()` breaks the bundler). Hooks use `initServicesForHook()` which does
static adapter imports:

```typescript
// services.ts
export function initServicesForHook(projectRoot: string): MaestroServices {
  // Static imports only -- no toolbox scanning
  // Hooks need: taskPort, memoryPort, configPort, featurePort, doctrinePort
  // They don't need graph/search/handoff (those are MCP-time concerns)
  return {
    taskPort: new FsTaskAdapter(projectRoot),    // Always fs for hooks
    memoryPort: new FsMemoryAdapter(projectRoot),
    configPort: new FsConfigAdapter(projectRoot),
    featurePort: new FsFeatureAdapter(projectRoot),
    doctrinePort: new FsDoctrineAdapter(projectRoot),
    planPort: new FsPlanAdapter(projectRoot),
  };
}
```

---

## Skill System -- Universal Format + One-Way Sync

### Design Principle

The host agent (Claude Code, Codex) is BETTER at loading skills than maestro. It's native --
slash commands, built-in discovery, native UI. Maestro should not try to replicate this.

Instead: **maestro manages its own skills and syncs them TO the host.** The host loads them natively.

```
WRONG: maestro scans ~/.claude/skills/, reads host skills, presents in maestro_skill_list
RIGHT: maestro writes its skills TO the host's skill directory, host loads them natively
```

### Universal Skill Format

Every skill -- maestro, Claude Code, Codex -- uses the same minimal format:

```yaml
---
name: maestro:implement
description: TDD implementation workflow for executing plan tasks
---

<markdown body -- the actual workflow guidance>
```

Required fields: `name` + `description`. That's all any host needs.

Maestro-specific fields are optional, ignored by hosts that don't understand them:

```yaml
---
name: maestro:implement
description: TDD implementation workflow for executing plan tasks
stage: [execution]           # maestro workflow engine uses this
requires: [git]              # maestro toolbox checks this
chain: [maestro:tdd]         # maestro loads these after
argumentHint: "--parallel"   # maestro passes to skill
---
```

### Skill Sources (maestro-owned)

```
skills/built-in/               # 21 built-in methodology skills (shipped with maestro)
skills/external/               # User/community installed skills
toolbox/tools/*/skills/        # Tool-bundled skills (e.g., agent-mail ships handoff skill)
~/.maestro/skills/             # Global user skills (across all projects)
```

### One-Way Sync: Maestro --> Host

```
Maestro skills                           Host skill directory
--------------                           --------------------
skills/built-in/maestro:implement/   --> .claude/skills/maestro/maestro:implement/  (symlink)
skills/built-in/maestro:tdd/         --> .claude/skills/maestro/maestro:tdd/        (symlink)
skills/external/my-team:standards/   --> .claude/skills/maestro/my-team:standards/  (symlink)
toolbox/.../agent-mail/skills/...    --> .claude/skills/maestro/maestro:handoff/    (symlink)
```

SessionStart hook runs sync:

```
1. Detect host (claude-code | codex | standalone)
2. Determine target directory:
   claude-code --> .claude/skills/maestro/
   codex       --> .codex/skills/maestro/
   standalone  --> skip sync
3. Symlink all maestro-owned skills to target
4. Clean stale symlinks (removed skills, removed tools)
5. Host sees all maestro skills as native slash commands
```

### What Maestro Does NOT Do

- Does NOT scan `~/.claude/skills/` -- host already sees those
- Does NOT scan `.claude/skills/` (non-maestro) -- host already sees those
- Does NOT discover or index host skills -- host handles its own skills natively
- Does NOT bidirectionally sync -- one way only (maestro --> host)

### Referencing Host Skills in Workflow Config

If a user has a Claude Code skill they want in maestro's workflow:

```jsonc
// .maestro/settings.json
{
  "workflow": {
    "types": {
      "feature": {
        "skills": {
          "research": "defuddle"         // Claude Code skill -- referenced by name
        }
      }
    }
  }
}
```

Workflow engine says "load `defuddle` at research stage." SessionStart hook injects this
instruction. Claude Code loads the skill natively. Maestro never reads the skill file.

### Host Switching

```
Running in Claude Code:
  Sync target: .claude/skills/maestro/
  Claude Code sees maestro skills as /maestro:implement, /maestro:tdd, etc.

Switch to Codex:
  Sync target: .codex/skills/maestro/
  Codex sees maestro skills natively
  .claude/skills/maestro/ symlinks are stale but harmless

Switch to standalone CLI:
  No sync (no host skill directory)
  Skills available via maestro_skill() MCP tool only
```

Skills themselves never move. Only symlink targets change.

### Skill Management MCP Tools

```
maestro_skill_list                     # List maestro-owned skills (built-in + external + toolbox + global)
maestro_skill({ name })                # Load skill content
maestro_skill_install({ source })      # Install from URL/path to skills/external/
maestro_skill_create({ name })         # Scaffold new skill
maestro_skill_remove({ name })         # Remove from skills/external/
maestro_skill_sync                     # Re-sync symlinks to host
```

### Skill Install / Create

```
$ maestro skill install https://github.com/someone/maestro-skill-security-review
Installed to skills/external/security-review/

$ maestro skill install https://github.com/someone/skill --global
Installed to ~/.maestro/skills/

$ maestro skill create my-team:deploy-checklist --stage execution
Scaffolded skills/external/my-team:deploy-checklist/SKILL.md
```

### Updated Directory Structure

```
skills/
  built-in/                        # 21 built-in methodology skills
  external/                        # User/community installed skills
  sync.ts                          # NEW: one-way sync (symlinks to host)
  registry.ts                      # Updated: scans maestro-owned sources only
  registry.generated.ts            # Build-time generated (built-in content)
  aliases.ts                       # Legacy name mappings
  external-discovery.ts            # Updated: scans external + toolbox + global
  generate.ts                      # Build script
```

### External Skills Ecosystem

**Where external skills live:**

```
Project-level:    skills/external/<name>/SKILL.md        # committed, team shares
Global-level:     ~/.maestro/skills/<name>/SKILL.md      # user's personal skills
Tool-bundled:     toolbox/tools/**/skills/<name>/SKILL.md # comes with a tool
```

Priority: project > global > tool-bundled (same name = project wins).

**Skill structure (minimal -- one directory, one file):**

```
skills/external/my-team:deploy-checklist/
  SKILL.md           # required -- the skill content
  reference/         # optional -- supporting files
    checklist.md
    env-template.md
```

**Skill management CLI + MCP:**

```
CLI:
  maestro skill list [--stage <stage>] [--source <source>]
  maestro skill load <name> [--reference <path>]
  maestro skill create <name> [--stage <stage>]
  maestro skill install <source> [--global]
  maestro skill remove <name>
  maestro skill update <name>
  maestro skill publish <name>
  maestro skill sync

MCP (new tools):
  maestro_skill_list({ stage?, source? })
  maestro_skill({ name, reference? })                  # existing, enhanced
  maestro_skill_install({ source, global? })            # NEW
  maestro_skill_create({ name, stage? })                # NEW
  maestro_skill_remove({ name })                        # NEW
  maestro_skill_sync()                                  # NEW
```

**Create a skill:**

```
$ maestro skill create my-team:deploy-checklist --stage execution

Scaffolded skills/external/my-team:deploy-checklist/
  SKILL.md         -- template with frontmatter
  reference/       -- empty directory

Next: edit SKILL.md, test with `maestro skill load`, sync with `maestro skill sync`
```

**Install from GitHub:**

```
$ maestro skill install https://github.com/someone/maestro-skill-security-review
Installed to skills/external/security-review/

$ maestro skill install https://github.com/someone/skill --global
Installed to ~/.maestro/skills/security-review/
```

**Share a skill:** Push directory to GitHub. Others install with `maestro skill install <url>`.

**Use in workflow config:**

```jsonc
{
  "workflow": {
    "types": {
      "feature": {
        "skills": {
          "planning": "my-team:code-standards",
          "execution": "maestro:implement"
        }
      }
    }
  }
}
```

**Dev loop:**

```
$ maestro skill create my-team:api-review --stage execution
$ vim skills/external/my-team:api-review/SKILL.md
$ maestro skill load my-team:api-review              # test
$ maestro skill sync                                 # push to host
```

### Edge Cases

#### Sync & Host

| # | Edge case | Fix |
|---|---|---|
| 1 | Host switch (Claude Code to Codex) | Symlink target changes. Old stale symlinks harmless. New host gets fresh sync. |
| 2 | User's Claude Code skill in workflow config | Workflow engine says "load X". Host loads natively. Maestro doesn't read file. |
| 3 | Name collision (maestro:implement vs user's implement) | Maestro syncs to subdirectory `.claude/skills/maestro/`. No collision with user skills. |
| 4 | Symlinks break on Windows | Copy instead of symlink. Track in `.maestro/.skill-sync-manifest.json` for cleanup. |
| 5 | Standalone CLI, no host | Skills via `maestro_skill()` only. No sync needed. |
| 6 | Host doesn't support skills directory | Skip sync. `maestro_skill()` still works. |
| 7 | Sync adds latency | ~1ms per symlink. 30 skills = 30ms. Negligible. |
| 8 | Git commits synced symlinks | `.claude/skills/maestro/` gitignored by `maestro init`. |
| 9 | Tool removed, bundled skills are stale symlinks | `skill_sync` cleans broken symlinks on every run. |
| 10 | Bidirectional sync to host without skill support | Skip sync. Maestro skills work via `maestro_skill()` MCP tool regardless. Sync is enhancement. |

#### Security

| # | Edge case | Fix |
|---|---|---|
| 11 | Malicious skill from GitHub (prompt injection) | `maestro skill install` shows skill content for review before installing. `doctor` flags suspicious patterns (shell commands, file deletion). |
| 12 | Skill references dangerous shell commands (`rm -rf`, `curl \| sh`) | Skills are guidance, not execution. Skill validation scanner flags dangerous patterns: `rm -rf`, `curl \| sh`, `sudo`, `chmod 777`. Warn on install, don't block. |
| 13 | Private skill leaks into public via sync | `.claude/skills/maestro/` gitignored by default. Sync uses symlinks (not copies), symlinks not committed. |
| 14 | Skill contains secrets (API keys, tokens) | Scanner flags patterns: `sk-`, `ghp_`, `AKIA`, `Bearer `. Warn on `skill_list` and `skill install`. |

#### Performance

| # | Edge case | Fix |
|---|---|---|
| 15 | Scanning multiple directories on every `skill_list` is slow | Cache skill inventory in `.maestro/.skillcache.json` with file modification timestamps. Invalidate on `skill_install`, `skill_remove`, `skill_sync`. SessionStart uses cache. |
| 16 | Very large reference directory (100+ files, MB of data) | `maestro_skill()` loads SKILL.md only. Reference files loaded on demand via `reference:` param. Never load entire reference dir. |
| 17 | 50+ skills from all sources overflows response | Paginate: `skill_list({ stage: 'execution' })`, `skill_list({ source: 'external' })`. Default: show counts per source, not full list. |
| 18 | Built-in registry is 380KB | Build-time embedded in `registry.generated.ts`. Discovery only loads metadata (name, desc, stage), not content. Content loaded lazily on `maestro_skill()`. |

#### Compatibility

| # | Edge case | Fix |
|---|---|---|
| 19 | Claude Code updates skill format -- new frontmatter fields | Maestro reads only known fields. Unknown fields preserved, ignored. Forward-compatible by design. |
| 20 | Maestro built-in skill update changes behavior, user had override | Built-in skills versioned via `schemaVersion` in frontmatter. User overrides pin to the version they overrode. Doctor warns: "maestro:implement v3 available, you're using custom override of v2." |
| 21 | Codex skill format is TOML, not markdown | `CodexSkillAdapter` converts: reads TOML, extracts instructions field, wraps in SkillEntry with markdown body. Adapter registered per host type. |
| 22 | Frontmatter differs between sources (maestro uses `stage:`, Claude Code uses `triggers:`) | Unified `SkillEntry` interface normalizes. Each source adapter maps format to SkillEntry. `stage` inferred from `triggers` for Claude Code skills (or defaults to `['*']`). |

#### Lifecycle

| # | Edge case | Fix |
|---|---|---|
| 23 | Skill installed globally AND per-project, different content | Project wins. Doctor warns: "my-team:deploy overrides global version." `skill_list` shows both with `(shadowed)` marker. |
| 24 | Skill removed but still referenced in workflow settings | `skill_remove` checks settings for references. Warn: "my-team:deploy is referenced in workflow.types.bug.skills.planning. Remove reference?" On load: missing skill = warn + continue. |
| 25 | Install from private GitHub repo -- needs auth | `--token` flag or reads `GITHUB_TOKEN` env var. Uses `gh` CLI if available (already authed). Falls back: "Clone failed. Try: `gh auth login` then retry." |
| 26 | Skill updated at source, local copy is stale | No auto-update. Skills are installed at a point in time. `maestro skill update <name>` re-fetches. Doctor optionally flags: "skill installed 90 days ago." |
| 27 | Skill hot-reload -- user edits SKILL.md | Yes. `maestro_skill()` always reads from disk (no in-memory content cache). Skill metadata cache invalidated on file mtime change. |
| 28 | Uninstall skill that was synced to host -- orphaned symlink | `skill_remove` runs `skill_sync --clean` after removal. Cleans stale symlinks. Also cleans on next `skill_sync`. |
| 29 | Skill install overwrites existing | Prompt: "my-team:deploy already exists. Overwrite? [y/N]". CLI flag: `--force` to skip prompt. |
| 30 | Skill create with conflicting name | Error: "Skill 'X' already exists at skills/external/X/." |

#### Composition & Dependencies

| # | Edge case | Fix |
|---|---|---|
| 31 | Skill depends on a specific tool (`requires: ['bv']`) | `skill_list` shows: "maestro:graph-workflow (requires bv -- not installed)". Loading still works (guidance), but doctor flags missing tool. |
| 32 | Skill chains to another skill (`chain: ['maestro:tdd']`) | Workflow engine loads chained skills when primary skill's stage completes. Circular chain guard: max depth 3. |
| 33 | Skill has arguments (`maestro_skill({ name, args: '--parallel' })`) | Already supported: `argumentHint` in registry. Skills can declare expected arguments in frontmatter. Content adapts based on args. |
| 34 | Skill overrides built-in and REMOVES guidance (weaker) | User's choice. `doctor --verbose` shows: "Custom maestro:implement is 20 lines vs built-in 150 lines. Intentional?" Information, not enforcement. |

#### Multi-Host

| # | Edge case | Fix |
|---|---|---|
| 35 | Running inside Codex, no `~/.claude/skills/` | Skill discovery skips non-existent directories silently. Only scans host skill directories for detected host. |
| 36 | Switching hosts mid-project -- synced skills in `.claude/skills/` useless in Codex | Maestro-owned skills (built-in, external, toolbox-bundled) work everywhere via `maestro_skill()`. Host-synced skills are host-specific. On switch, re-sync to new host target. Doctor notes: "3 Claude Code skills not available in Codex." |
| 37 | Standalone CLI mode, no host skill directory | Skip sync. Skills available via `maestro_skill()` MCP tool regardless. Sync is enhancement, not requirement. |

#### Naming & Organization

| # | Edge case | Fix |
|---|---|---|
| 38 | Skill name with special characters (`my-team:api/v2-guidelines`) | Validate: alphanumeric + hyphens + colons only. Reject slashes, spaces, dots. Error with corrected suggestion. |
| 39 | External skill uses `maestro:` prefix (reserved) | `maestro:` prefix reserved for built-in. Error on install: "Prefix 'maestro:' is reserved. Use a different prefix." |
| 40 | Skill without `name:` in frontmatter | Derive name from directory name. Warn: "Using directory name 'my-skill' as skill name." |
| 41 | Windows symlinks require admin/dev mode | Copy instead of symlink. Track copies in `.maestro/.skill-sync-manifest.json`. Or skip sync on Windows with warning. |

#### External-Specific

| # | Edge case | Fix |
|---|---|---|
| 42 | External skill has no description | Warn on `skill list`: "(no description)". Block on `skill publish`: "Add a description before sharing." |
| 43 | External skill has empty body | Error on install: "SKILL.md has no content." Skills must have guidance. |
| 44 | Duplicate name across external and global | Project external wins. `skill list` shows: `my-skill (global, shadowed by project)`. |
| 45 | Skill installed from GitHub, repo later deleted | Skill is a local copy. Still works. `skill update` fails: "Source unavailable." |
| 46 | Reference file uses absolute paths | Validate on install: warn about absolute paths. Skills should use relative references only. |
| 47 | External skill directory has no SKILL.md | Skip directory. `skill list` ignores it. Doctor warns: "skills/external/broken-skill/ has no SKILL.md." |
| 48 | Skill with huge reference files (50MB) | `skill install` warns: "Reference directory is 50MB. Install anyway?" References only loaded on demand. |
| 49 | Team member adds skill, doesn't commit | Works locally but not for team. Doctor warns: "2 external skills not committed to git." |
| 50 | Global skill and project skill both exist, user wants global | `maestro skill load X --source global` to force. Default: project wins. |

---

## File Migration Map

| Current location | New location | Notes |
|---|---|---|
| **Ports** | | |
| `ports/features.ts` | `features/port.ts` | |
| `ports/plans.ts` | `plans/port.ts` | |
| `ports/tasks.ts` | `tasks/port.ts` | Remove runtime functions |
| `ports/memory.ts` | `memory/port.ts` | |
| `ports/config.ts` | `core/config.ts` | |
| `ports/doctrine.ts` | `doctrine/port.ts` | |
| `ports/graph.ts` | `tasks/graph/port.ts` | |
| `ports/search.ts` | `search/port.ts` | |
| `ports/handoff.ts` | `handoff/port.ts` | |
| `ports/verification.ts` | `tasks/verification/port.ts` | |
| **Adapters** | | |
| `adapters/fs/feature.ts` | `features/adapter.ts` | |
| `adapters/fs/plan.ts` | `plans/adapter.ts` | |
| `adapters/fs-tasks.ts` | `toolbox/tools/built-in/fs-tasks/adapter.ts` | |
| `adapters/fs/memory.ts` | `memory/adapter.ts` | |
| `adapters/fs/config.ts` | `core/config.ts` (merged) | |
| `adapters/fs/doctrine.ts` | `doctrine/adapter.ts` | |
| `adapters/br.ts` | `toolbox/tools/external/br/adapter.ts` | |
| `adapters/bv-graph.ts` | `toolbox/tools/external/bv/adapter.ts` | |
| `adapters/cass-search.ts` | `toolbox/tools/external/cass/adapter.ts` | |
| `adapters/agent-mail-handoff.ts` | `toolbox/tools/external/agent-mail/adapter.ts` | |
| `adapters/verification.ts` | `tasks/verification/adapter.ts` | Stays in tasks/ (no toolbox) |
| `adapters/agents-md.ts` | `features/agents-md.ts` | Add port interface |
| **Usecases** | | |
| `usecases/sync-plan.ts` | `tasks/usecases.ts` (merged) | |
| `usecases/translate-plan.ts` | `tasks/usecases.ts` (merged, dedup) | Fix #12 |
| `usecases/write-plan.ts` | `plans/usecases.ts` | |
| `usecases/approve-plan.ts` | `plans/usecases.ts` | |
| `usecases/complete-feature.ts` | `features/usecases.ts` | |
| `usecases/verify-task.ts` | `tasks/verification/usecase.ts` | |
| `usecases/task-brief.ts` | `tasks/usecases.ts` | |
| `usecases/prune-context.ts` | `dcp/pruner.ts` | Top-level DCP module |
| `usecases/suggest-doctrine.ts` | `doctrine/suggest.ts` | |
| `usecases/execution-insights.ts` | `workflow/insights.ts` | |
| `usecases/query-historical-context.ts` | `dcp/historical.ts` | |
| `usecases/check-status.ts` | `workflow/status.ts` | |
| `usecases/ping.ts` | `workflow/ping.ts` | Separate file |
| `usecases/doctor.ts` | `workflow/doctor.ts` | Separate file |
| `usecases/history.ts` | `workflow/history.ts` | |
| `usecases/visualize.ts` | `visual/usecases.ts` | |
| `usecases/debug-visualize.ts` | `visual/usecases.ts` (merged) | |
| `usecases/self-update.ts` | `cli/handlers/update.ts` | CLI-only |
| **Utils** | | |
| `utils/plan-parser.ts` | `plans/parser.ts` | Wire in detectCycles |
| `utils/context-selector.ts` | `dcp/selector.ts` | |
| `utils/relevance.ts` | `dcp/relevance.ts` | |
| `utils/dependency-proximity.ts` | `tasks/graph/proximity.ts` | |
| `utils/task-dependency-graph.ts` | `tasks/graph/dependency.ts` | |
| `utils/dependency-check.ts` | `tasks/graph/check.ts` | |
| `utils/dcp-config.ts` | `dcp/config.ts` | |
| `utils/budget-fill.ts` | `dcp/budget.ts` | |
| `utils/tokens.ts` | `core/tokens.ts` | |
| `utils/execution-memory.ts` | `memory/execution/writer.ts` | |
| `utils/parse-exec-memory.ts` | `memory/execution/parser.ts` | |
| `utils/memory-inference.ts` | `memory/execution/inference.ts` | |
| `utils/frontmatter.ts` | `core/frontmatter.ts` | Used by 12 files across 6 modules |
| `utils/verification-config.ts` | `tasks/verification/config.ts` | |
| `utils/doctrine-trace.ts` | `doctrine/trace.ts` | |
| `utils/doctrine-factory.ts` | `doctrine/factory.ts` | |
| `utils/doctrine-config.ts` | `doctrine/config.ts` | |
| `utils/workflow.ts` | `workflow/stages.ts` | |
| `utils/playbook.ts` | `workflow/playbook.ts` | |
| `utils/spec-builder.ts` | `tasks/spec-builder.ts` | |
| `utils/bead-builder.ts` | `tasks/bead-builder.ts` | |
| `utils/worker-rules.ts` | `tasks/worker-rules.ts` | |
| `utils/research-tools.ts` | `workflow/research-tools.ts` | |
| `utils/detection.ts` | `features/detection.ts` | |
| `utils/slug.ts` | `core/slug.ts` | |
| `utils/validate-name.ts` | `core/validate-name.ts` | |
| `utils/locking.ts` | `core/locking.ts` | |
| `utils/fs-io.ts` | `core/fs-io.ts` | |
| `utils/git.ts` | `core/git.ts` | |
| `utils/cli-runner.ts` | `core/cli-runner.ts` | |
| `utils/paths.ts` | `core/paths.ts` | |
| `utils/visual/*` | `visual/*` | Direct move |
| **Lib** | | |
| `lib/errors.ts` | `core/errors.ts` | Add unified envelope |
| `lib/output.ts` | `core/output.ts` | |
| `lib/truncation.ts` | `core/truncation.ts` | |
| `lib/signals.ts` | `core/signals.ts` | |
| `lib/resolve.ts` | `core/resolve.ts` | |
| `lib/resolve-backend.ts` | `core/resolve-backend.ts` | |
| `lib/cli-detect.ts` | `toolbox/registry.ts` (merged) | |
| **Plugins** | | |
| `plugins/*` | `toolbox/*` | Full replacement |
| **Server** | | |
| `server.ts` | `mcp/index.ts` | |
| `server/*.ts` | `mcp/handlers/*.ts` | Extract business logic to usecases |
| `server/_utils/respond.ts` | `mcp/respond.ts` | |
| `server/_utils/annotations.ts` | `mcp/annotations.ts` | |
| `server/_utils/params.ts` | `mcp/params.ts` | |
| `server/_utils/services-thunk.ts` | `mcp/services-thunk.ts` | |
| `server/_utils/resolve.ts` | `mcp/handlers/_resolve.ts` | |
| **Commands** | | |
| `cli.ts` | `cli/index.ts` | |
| `commands/*` | `cli/handlers/*` | Flatten to handler files |
| `commands/_internal/*` | `cli/registry.ts` + `cli/_generate.ts` | |
| **Other** | | |
| `services.ts` | `services.ts` | Rewrite for toolbox + add initServicesForHook() |
| `types.ts` | `core/types.ts` | |
| `version.ts` | `version.ts` | |

---

## Test Strategy

Tests stay in `src/__tests__/{unit,e2e,integration,mocks}`. Import paths updated during migration.

Mock migration:
- `InMemoryTaskPort` imports from `../../tasks/port.ts` (was `../../ports/tasks.ts`)
- `InMemoryMemoryPort` imports from `../../memory/port.ts` (was `../../ports/memory.ts`)
- Add `InMemoryFeaturePort`, `InMemoryPlanPort` mocks for consistency

Build-time generators stay adjacent to output:
- `skills/generate.ts` stays in `skills/`
- `cli/_generate.ts` for CLI registry generation

---

## Audit Fixes Addressed

| # | Finding | How it's fixed |
|---|---|---|
| 1 | task_done MCP/CLI divergence | Both call `tasks/usecases.ts:completeTask()` with full verification |
| 2 | Unvalidated external data | Toolbox adapters add Zod schemas via AdapterContext |
| 3 | detectCycles dead code | `plans/parser.ts` wires cycle detection into plan validation |
| 4 | Three error response patterns | `core/errors.ts` unified `MaestroResponse<T>` envelope |
| 5 | MCP/CLI parity gaps | Both surfaces call same usecase inventory |
| 6 | No server/CLI tests | Handlers are thin; test usecases directly |
| 7 | task_brief marked MUTATING | Separate claim from read in `tasks/usecases.ts` |
| 8 | utils imports adapter | `doctrine/factory.ts` imports from `doctrine/adapter.ts` (same module) |
| 9 | init bypasses composition root | `cli/handlers/init.ts` uses services.ts |
| 10 | AgentsMdAdapter has no port | `features/agents-md.ts` gets AgentsMdPort interface |
| 11 | Silent catch blocks | Add structured debug logging in usecases |
| 12 | Duplicate sync algorithm | `tasks/usecases.ts` has one sync, parameterized by backend |
| 13 | Mixed *Adapter/*Port naming | All service fields use `*Port` naming |
| 14 | Runtime logic in port | `tasks/transitions.ts` separate from `tasks/port.ts` |

---

## Migration Risk Register

Files ordered by migration risk (highest import count, most cross-cutting):

| File | Import count | Risk | Migrate |
|---|---|---|---|
| `types.ts` | ~50+ files | HIGH | Last (everything depends on it) |
| `services.ts` | ~30 files | HIGH | After all ports/adapters move |
| `paths.ts` | ~25 files | MEDIUM | Early (pure utility, no deps) |
| `frontmatter.ts` | ~12 files | MEDIUM | Early (pure utility) |
| `errors.ts` | ~20 files | MEDIUM | Early (add envelope, keep old exports) |
| `server/task.ts` | N/A | HIGH | Extract business logic first, then move shell |
| `build.ts` | N/A | MEDIUM | Update after all source moves complete |

---

## Settings System (Claude-style)

Two-level config with deep merge, matching Claude Code's `settings.json` pattern.

### File Locations

```
~/.maestro/settings.json          # Global -- user defaults for all projects
.maestro/settings.json            # Project -- overrides for this project
```

### Resolution Chain

```
DEFAULTS (hardcoded in core/types.ts)
  --> ~/.maestro/settings.json (global user prefs)
    --> .maestro/settings.json (project overrides)
      --> RESOLVED CONFIG
```

### Full Schema

```jsonc
{
  "toolbox": {
    "allow": ["br", "bv", "cass", "agent-mail", "tilth", "rg", "git"],
    "deny": [],
    "config": {
      "agent-mail": { "url": "http://localhost:3001" }
    },
    "portOverrides": {}
  },

  "dcp": {
    "enabled": true,
    "memoryBudgetTokens": 1024,
    "completedTaskBudgetTokens": 512,
    "relevanceThreshold": 0.1,
    "observationMasking": true
  },

  "verification": {
    "enabled": true,
    "autoReject": true,
    "maxRevisions": 2,
    "scoreThreshold": 0.7,
    "buildTimeoutMs": 30000,
    "buildCommand": null
  },

  "doctrine": {
    "enabled": true,
    "doctrineBudgetTokens": 256,
    "maxSuggestionsPerFeature": 5,
    "crossFeatureScanLimit": 20,
    "minSampleSize": 5
  },

  "tasks": {
    "claimExpiresMinutes": 120,
    "backend": "auto"
  }
}
```

### Toolbox Allow/Deny Rules

Follows Claude Code's permission model:

1. `deny` takes precedence over `allow`
2. If `allow` is empty/missing --> all installed tools are allowed by default
3. If `allow` has entries --> only those tools are allowed (allowlist mode)
4. `deny` from both global and project are merged (union)
5. `allow` from project replaces global `allow` (not merged)
6. Tool in both `allow` and `deny` --> denied

### Config Port

```typescript
// core/config.ts
interface ConfigPort {
  read(): Promise<ResolvedConfig>;
  write(key: string, value: unknown, scope: 'global' | 'project'): Promise<void>;
}
```

### CLI Commands

```
$ maestro config-set toolbox.deny '["bv"]'                      # project scope
$ maestro config-set toolbox.deny '["bv"]' --global             # global scope
$ maestro config-get verification.scoreThreshold                 # shows resolved value + source
  0.5 (from .maestro/settings.json)
```

---

## Toolbox Multi-Transport Framework

### Tool Communication Patterns

From ecosystem research, tools come in 4 transport formats:

| Transport | Examples | Communication | Adapter needed? |
|---|---|---|---|
| `cli` | br, bv, cass, rg, tilth | Subprocess, `--json` stdout | Yes -- custom normalization |
| `mcp-stdio` | Most MCP tools on npm | stdin/stdout MCP protocol | No -- auto-bridged (or optional custom) |
| `mcp-http` | agent-mail, remote MCP servers | HTTP Streamable / JSON-RPC | No -- auto-bridged (or optional custom) |
| `http` | Custom REST/GraphQL APIs | fetch() with JSON | Yes -- custom adapter |

### Transport-Aware Manifest Schema

```jsonc
// CLI binary tool
{
  "manifestVersion": 1,
  "name": "br",
  "description": "beads_rust task manager",
  "transport": "cli",
  "cli": {
    "binary": "br",
    "detect": "br --version",
    "jsonFlag": "--json",
    "retryExitCodes": [5],
    "install": "cargo install beads_rust"
  },
  "provides": "tasks",
  "priority": 100,
  "adapter": "./adapter.ts",
  "inject": ["projectRoot"],
  "requires": [],
  "platforms": ["darwin", "linux", "win32"],
  "homepage": "https://github.com/user/beads_rust",
  "mcpTools": ["tasks_sync", "task_next", "task_claim", "task_done"]
}
```

```jsonc
// MCP server tool (stdio) -- NO adapter needed
{
  "manifestVersion": 1,
  "name": "mcp-github",
  "description": "GitHub integration via MCP",
  "transport": "mcp-stdio",
  "mcp": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
  },
  "provides": "github",
  "priority": 100,
  "bridge": {
    "searchSessions": { "tool": "search_code", "map": { "query": "query" } }
  }
}
```

```jsonc
// MCP server tool (HTTP)
{
  "manifestVersion": 1,
  "name": "agent-mail",
  "description": "Agent coordination and handoff",
  "transport": "mcp-http",
  "mcp": {
    "url": "${AGENT_MAIL_URL:-http://localhost:8765}",
    "timeout": 5000
  },
  "provides": "handoff",
  "priority": 100,
  "adapter": "./adapter.ts",
  "inject": ["projectRoot", "taskPort", "memoryPort", "configPort"]
}
```

```jsonc
// HTTP API tool
{
  "manifestVersion": 1,
  "name": "my-search-api",
  "description": "Custom search service",
  "transport": "http",
  "http": {
    "baseUrl": "${MY_SEARCH_URL:-http://localhost:9200}",
    "detect": "GET /health",
    "timeout": 5000
  },
  "provides": "search",
  "priority": 100,
  "adapter": "./adapter.ts"
}
```

### Adapter SDK

```
toolbox/
  sdk/
    cli-transport.ts       -- subprocess exec, JSON parsing, retry, ENOENT handling
    http-transport.ts      -- fetch() wrapper, timeout, retry, auth, best-effort mode
    mcp-transport.ts       -- MCP client, tool calling, resource reading
    mcp-bridge.ts          -- auto-bridges MCP tools to port methods via manifest mapping
    types.ts               -- AdapterContext, TransportConfig
    test-harness.ts        -- mock transports for testing adapters without real tools
```

### AdapterContext (passed to all adapter factories)

```typescript
interface AdapterContext {
  projectRoot: string;
  config: ResolvedConfig;
  toolConfig: Record<string, unknown>;   // From settings.toolbox.config[toolName]
  manifest: ToolManifest;                // The tool's own manifest
  ports: Partial<MaestroServices>;       // Available ports (for inject dependencies)
  toolbox: ToolboxRegistry;              // For querying other tools
}
```

### Two-Phase Adapter Wiring

Adapters with cross-port dependencies (like agent-mail needing taskPort) require ordered initialization:

```
Phase 1: Resolve adapters with no port dependencies
  - tasks (br or fs-tasks) --> only needs projectRoot
  - graph (bv) --> only needs projectRoot
  - search (cass) --> needs nothing
  - verification --> needs config only

Phase 2: Resolve adapters that depend on Phase 1 ports
  - handoff (agent-mail) --> needs taskPort, memoryPort, configPort from Phase 1

The manifest `inject` field declares dependencies. The loader topologically sorts.
```

---

## User Stories

### Story 1: Creating a New Tool

Three paths based on transport type:

**Path A: Wrapping a CLI binary**

```
$ maestro toolbox create my-tool --transport cli --provides search

Scaffolded toolbox/tools/external/my-tool/
  manifest.json      -- transport: "cli", provides: "search"
  adapter.ts         -- skeleton with CliTransport + SearchPort interface
  adapter.test.ts    -- test with mock CLI responses
```

The adapter skeleton:

```typescript
import { CliTransport } from 'maestro/toolbox/sdk';
import type { SearchPort } from 'maestro/search/port';
import type { AdapterContext } from 'maestro/toolbox/types';

export function createAdapter(ctx: AdapterContext): SearchPort {
  const cli = new CliTransport(ctx.manifest.cli);
  return {
    async searchSessions(query, opts) {
      const raw = await cli.exec(['search', query, '--limit', String(opts?.limit ?? 20)]);
      return raw.results.map(r => ({
        id: r.id, title: r.title, snippet: r.excerpt, score: r.relevance,
      }));
    },
    async findRelatedSessions(sessionId) {
      const raw = await cli.exec(['related', sessionId]);
      return raw.results.map(normalize);
    },
  };
}
```

**Path B: Connecting an MCP server (no adapter needed)**

```
$ maestro toolbox add mcp-github --transport mcp-stdio \
    --command "npx" --args "-y,@modelcontextprotocol/server-github" \
    --provides github

[ok] Created toolbox/tools/external/mcp-github/
  manifest.json      -- transport: "mcp-stdio", auto-bridge enabled
  No adapter.ts needed -- MCP tools are bridged automatically.
```

For complex mapping, add a `bridge` section to manifest or drop to a custom adapter:

```
$ maestro toolbox create my-mcp --transport mcp-stdio --provides search --with-adapter
```

**Path C: Wrapping an HTTP API**

```
$ maestro toolbox create my-api --transport http --provides search

Scaffolded with HttpTransport helper in adapter.ts.
```

**Development loop (all paths):**

```
$ maestro toolbox dev my-tool

[ok] Loaded manifest.json (transport: cli, provides: search)
[ok] Tool detected: my-tool v1.2.0
[ok] Adapter compiled
[ok] Port compliance: SearchPort
     searchSessions       [ok] implemented
     findRelatedSessions  [ok] implemented

Running integration test...
  searchSessions("test") --> 3 results, schema valid [ok]

Watching for changes... (edit adapter.ts to re-run)
```

**Validation:**

```
$ maestro toolbox test my-tool

[ok] manifest.json: valid schema (v1, transport: cli)
[ok] detect: `my-tool --version` --> v1.2.0
[ok] adapter.ts: exports createAdapter function
[ok] SearchPort compliance: 2/2 methods
[ok] integration: searchSessions returned valid data
[ok] integration: findRelatedSessions returned valid data
```

**Publishing for sharing:**

```
$ maestro toolbox publish my-tool

[ok] manifest.json complete (all fields filled)
[ok] adapter.ts compiles
[ok] README.md exists
[ok] detect command works

Ready to share. Push to GitHub, others install with:
  maestro toolbox install <your-repo-url>
```

### Story 2: Installing a Tool from GitHub

Three patterns depending on what you find:

**Pattern A: Maestro-ready tool (has manifest.json)**

```
$ maestro toolbox install https://github.com/someone/maestro-meilisearch

Cloning...
[ok] manifest.json found (transport: cli, provides: search)
[ok] detect: meilisearch v1.6.0
[ok] adapter.ts found, compiled
Installed to toolbox/tools/external/meilisearch/

Resolution changed:
  search: cass (100) --> meilisearch (100, alphabetical tiebreaker)
```

**Pattern B: MCP server (no manifest, but standard MCP)**

```
$ maestro toolbox install --mcp-stdio npx -y @scope/mcp-server

[ok] npm package found
[ok] Started MCP server, discovered 12 tools
[ok] Generated manifest.json (transport: mcp-stdio)

Installed to toolbox/tools/external/mcp-server/
No adapter needed -- tools available via MCP bridge.
```

**Pattern C: Random CLI tool (no manifest)**

```
$ maestro toolbox create awesome-search --transport cli --provides search

Scaffolded. Now implement the adapter manually:
  1. Edit manifest.json (binary name, detect command)
  2. Edit adapter.ts (implement port methods)
  3. `maestro toolbox test awesome-search` to validate
```

**Install locations:**

```
$ maestro toolbox install <source>                # project: .maestro/toolbox/tools/external/
$ maestro toolbox install <source> --global       # global: ~/.maestro/toolbox/tools/external/
```

Project tools take precedence over global (same name = project wins).

**What gets committed to git:**

- `manifest.json`, `adapter.ts`, `README.md` --> committed
- `.toolcache.json` --> gitignored (detection cache)
- `node_modules/` --> gitignored

Team members clone, run `maestro doctor`, install missing tools.

### Toolbox CLI Commands

```
maestro toolbox list                              # Show all tools + status + transport
maestro toolbox create <name> --transport <type>  # Scaffold new tool
maestro toolbox add <name> --transport <type>     # Quick-add (manifest only, no adapter)
maestro toolbox install <source> [--global]       # Install from URL/path/npm
maestro toolbox dev <name>                        # Watch mode with port compliance checks
maestro toolbox test <name>                       # Full validation
maestro toolbox remove <name>                     # Remove tool
maestro toolbox publish <name>                    # Validate for sharing
```

---

## Edge Case Register

### Toolbox Resolution

| # | Edge case | Fix |
|---|---|---|
| 1 | Cross-port adapter deps (agent-mail needs taskPort) | Two-phase wiring via manifest `inject` field, topological sort |
| 2 | Detection latency (10 tools x 200ms) | Parallel `Promise.all()` + `.toolcache.json` with TTL |
| 3 | Broken external tool (malformed manifest) | Skip + warn in doctor, never crash startup |
| 4 | Same-priority port conflict | Alphabetical name tiebreaker + doctor warning |
| 5 | Config deny vs tool requires | Warn in doctor, dependent tool fails gracefully |
| 6 | Hot-swap mid-session | Not supported -- config changes take effect next session |
| 7 | Manifest version mismatch | `manifestVersion` field; unknown version = skip + warn + suggest update |
| 8 | Adapter imports missing npm packages | `runtime: "cli"` or vendor deps. Doctor validates import resolution. |
| 9 | Unknown port name in provides | Strict: skip + warn. Future: extensible ports. |
| 10 | Update breaks adapter interface | `toolbox test` checks port compliance method-by-method |
| 11 | Malicious detect command | Sanitize: no pipes/redirects/semicolons. Show manifest for review before first detect. |
| 12 | Offline / air-gapped install | Manual folder copy always works. `toolbox install` is convenience, not requirement. |
| 13 | Global vs project tool conflict | Project wins (same name). Doctor shows source (global/project). |
| 14 | Git sharing | manifest + adapter committed. Cache + deps gitignored. |

### Config Conflicts

| # | Edge case | Fix |
|---|---|---|
| 15 | Tool in `allow` but not installed | Silently skip. Doctor: `[--] bv: not installed` |
| 16 | Tool in `deny` but required by another tool | Error in doctor. Warn on startup. Don't block -- dependent just won't load. |
| 17 | Tool in both `allow` and `deny` | `deny` wins (Claude's rule) |
| 18 | Tool not in `allow` or `deny` | If `allow` empty = allowed. If `allow` has entries = denied (allowlist mode). |
| 19 | `portOverrides` to a disabled tool | Error: "Cannot override tasks to fs-tasks: fs-tasks is denied" |
| 20 | `portOverrides` to uninstalled tool | Error: "Cannot override tasks to br: br is not installed" |
| 21 | Config provided for denied tool | Silently ignore config. User may be temporarily disabling. |

### Transport-Specific

| # | Edge case | Fix |
|---|---|---|
| 22 | MCP stdio server crashes mid-session | Transport auto-restarts with backoff. Doctor warns about instability. |
| 23 | MCP server exposes 50 tools, user wants 3 | `bridge` field in manifest maps specific tools. Others ignored. |
| 24 | Tool needs env vars (API keys) | Manifest supports `${VAR:-default}` expansion (same as Claude .mcp.json) |
| 25 | npm/pip not installed for MCP server | Doctor: "mcp-github requires npx. Install Node.js." |
| 26 | Adapter written in Python, not TS | For now: TS only. Future: `"adapterRuntime": "python"`. Workaround: CLI wrapper. |
| 27 | Tool works on Mac but not Linux | Manifest `"platforms"` field. Doctor shows platform mismatch. |

### MCP Bridge

| # | Edge case | Fix |
|---|---|---|
| 28 | MCP tool returns unexpected schema | Bridge validates response against port interface. Falls back to raw data + warning. |
| 29 | MCP server requires auth (OAuth, API key) | Manifest `mcp.env` for static keys. Future: `mcp.auth: "oauth"` for interactive. |
| 30 | Two MCP tools map to the same port method | Last one in `bridge` mapping wins. Doctor warns about collision. |

### Host Task Backend

| # | Edge case | Fix |
|---|---|---|
| 31 | Claude Code tasks are session-scoped (not persistent) | Filesystem is always written alongside host. SessionStart hook recreates host tasks from filesystem state. |
| 32 | Context compression kills task references | Mirror adapter retries TaskUpdate; if task gone, recreates via TaskCreate and updates mapping. |
| 33 | Concurrent agents writing to same host | Only orchestrator mirrors to host. Workers write to filesystem via maestro MCP tools. |
| 34 | DCP needs to enumerate all tasks with deps | Always reads from filesystem (.maestro/). Host is state+display, filesystem is data. |
| 35 | task_brief needs specs + DCP + doctrine | Always reads from filesystem. Host backend handles state transitions, not heavy data. |
| 36 | User creates manual task in host outside maestro | Maestro ignores tasks without `maestroFeature` metadata. Coexistence, no conflict. |
| 37 | Stale claim expiry (claimExpiresMinutes) | Tracked via filesystem `claimedAt`. task_next checks age against filesystem, resets in both systems. |
| 38 | PreCompact hook needs state snapshot | Reads from filesystem (always current), writes snapshot. Host tasks recreated after compression. |
| 39 | Feature-scoped vs flat host task list | Prefix subjects with feature name: `[toolbox] 01-setup-types`. Filter by metadata.maestroFeature. |
| 40 | Host task ID mapping (folder name to host ID) | `host-mapping.json` per feature. Reconciled on session start. |
| 41 | Switching hosts mid-feature (Claude Code to Codex) | Filesystem is recovery source. New host recreates from filesystem. Mapping file regenerated. |
| 42 | Host task system unavailable (permissions blocked) | Graceful fallback to fs-tasks. Warn: "Host tasks unavailable, using filesystem." |
| 43 | Host adapter capability variance | `TaskAdapterCapabilities` interface: persistent?, 6-state?, deps?, specs?, metadata?. Adapter declares what it supports. |

---

## Host-Native Task Backend

### Design

Maestro auto-detects its host environment and adapts the task backend:

```
Auto-detect host
      |
      +-- Claude Code detected (session-scoped, NOT persistent)
      |     Backend: fs-tasks or br (persistent storage)
      |     Mirror: auto-recreate host tasks each session via SessionStart hook
      |     State changes: update filesystem AND host tasks
      |     Heavy data: filesystem only (specs, reports, verification, DCP)
      |
      +-- Codex detected (persistent, limited model)
      |     Backend: codex-tasks (hybrid -- state in Codex, specs on filesystem)
      |     Mirror: none needed (Codex persists)
      |     State changes: write to Codex + filesystem backup
      |
      +-- Standalone CLI (no host)
            Backend: fs-tasks or br
            Mirror: none
            State changes: filesystem only
```

### Key Principle

The filesystem is **always** written to, regardless of host. It is the recovery mechanism and the
data source for DCP, specs, reports, and verification. The host backend is an **acceleration layer**
for state management and native UI display.

```
Host backend handles:     State transitions, display, task listing, native UI
Filesystem always has:    Specs, reports, verification, DCP data, doctrine traces, mapping
```

### Host Detection

```typescript
function detectHost(): 'claude-code' | 'codex' | 'standalone' {
  // Claude Code: MCP context present, or CLAUDE_CODE env var
  if (process.env.CLAUDE_CODE || mcpContextAvailable()) return 'claude-code';
  // Codex: CODEX env var or .codex/ directory
  if (process.env.CODEX || existsSync('.codex/')) return 'codex';
  return 'standalone';
}
```

### Claude Code Task Mapping

Claude Code's task system supports:
- `TaskCreate`: subject, description, metadata (arbitrary key/value)
- `TaskUpdate`: status (pending/in_progress/completed), addBlockedBy, addBlocks, owner, metadata
- `TaskGet`: full task details
- `TaskList`: all tasks

Maestro stores rich data in the `metadata` field:

```typescript
TaskCreate({
  subject: "[toolbox] 01-setup-types",
  description: "Implement ToolManifest, AdapterContext, port resolution...",
  metadata: {
    maestroFeature: "toolbox-refactor",
    maestroFolder: "01-setup-types",
    maestroStatus: "pending",        // full 6-state model stored here
    revisionCount: 0,
    verificationScore: null,
    claimedAt: null,
    specPath: ".maestro/features/toolbox-refactor/tasks/01-setup-types/spec.md",
  }
});
```

State mapping:

```
Maestro state     Host status       Host metadata.maestroStatus
-----------       -----------       ---------------------------
pending           pending           "pending"
claimed           in_progress       "claimed"
done              completed         "done"
blocked           pending           "blocked"    (+ blockedBy deps)
review            in_progress       "review"
revision          in_progress       "revision"
```

### Session Lifecycle

```
SessionStart hook:
  1. Read all tasks from .maestro/ filesystem
  2. TaskList to see what host already has
  3. Match by metadata.maestroFolder
  4. Create missing tasks, update stale statuses
  5. Save host-mapping.json
  --> User sees full task list immediately in native UI

During execution:
  maestro_task_claim --> update filesystem + TaskUpdate host task
  maestro_task_done  --> update filesystem + TaskUpdate host task
  (orchestrator handles all host updates, not workers)

Session ends:
  Host tasks disappear (session-scoped)
  Filesystem persists all state
  Next session: SessionStart recreates everything
```

### Host Adapter Capabilities

```typescript
interface TaskAdapterCapabilities {
  persistent: boolean;           // Survives session restart?
  stateModel: '3-state' | '6-state';
  supportsDependencies: boolean;
  supportsMetadata: boolean;
  supportsSpecs: boolean;        // Can store spec.md content?
  supportsVerification: boolean;
}

// Capability matrix:
//                   persistent  6-state  deps   specs  verification  metadata
// fs-tasks          yes         yes      yes    yes    yes           yes
// br                yes         yes      yes    yes    yes           yes
// claude-code       NO          no       yes    no     no            yes
// codex             yes?        no       ?      no     no            ?
```

### Settings

```jsonc
{
  "tasks": {
    "backend": "auto",                // auto | fs-tasks | br | host
    "mirror": "auto",                 // auto | claude-code | codex | none
    "hostReconcileOnStart": true      // recreate host tasks from filesystem each session
  }
}
```

`backend: "auto"` resolution:
1. Detect host environment
2. Claude Code detected --> backend=fs-tasks, mirror=claude-code
3. Codex detected --> backend=codex-tasks (hybrid)
4. Standalone --> backend=fs-tasks (or br if installed and allowed)

`backend: "host"` forces host as primary (only works if host is persistent).
`backend: "fs-tasks"` or `"br"` forces specific backend, ignores host. `mirror: "auto"` still pushes display to host.

---

## Workflow Gaps (from audit)

### Tools missing from playbook stages (should be added)

| Tool | Missing from | Why it matters |
|---|---|---|
| `plan_approve` | approval | The trigger for approval --> execution transition |
| `feature_create` | discovery | How does a feature start? First tool in discovery. |
| `task_brief` | execution | Compiled agent context -- workers need this |
| `task_info` | execution | Inspect task details |
| `task_spec_read` | execution | Workers read specs |
| `doctrine_suggest` | done | Part of the "done" flow per CLAUDE.md |
| `doctrine_approve` | done | Approve suggested doctrines |
| `doctrine_write` | done | Write new doctrines from learnings |
| `memory_delete` | research, planning | Cleanup bad/outdated memories |
| `memory_compile` | execution | Compile context for workers |
| `status` | (all stages) | Called at session start. Should be meta/universal. |

### Conditional tools (add when external tool available)

| Tool | Depends on | Stage |
|---|---|---|
| `graph_insights` | bv | execution |
| `graph_next` | bv | execution |
| `graph_plan` | bv | execution |
| `search_sessions` | cass | research, execution |
| `search_related` | cass | research |
| `handoff_send` | agent-mail | execution |
| `handoff_receive` | agent-mail | execution |
| `handoff_ack` | agent-mail | execution |

### CLI-only commands needing MCP equivalents

| CLI command | Why it needs MCP |
|---|---|
| `config-set` | Agents should be able to configure maestro |
| `memory-archive` | Agents should be able to archive memories |
| `task-spec-write` | Agents should be able to write specs |
| `task-report-write` | Agents should be able to write reports |

### Stats

```
Total MCP tools:     57
In playbook:         21 (37%)
Missing from stages: 36 (63%)
  Should be added:   11 (workflow bugs)
  Conditional:        8 (add when tool available)
  Meta/utility:      17 (stage-independent)

CLI-only commands:    9
  Should have MCP:    4
  Correctly CLI-only: 5
```

---

## Workflow Engine v2

### Problem

The current `playbook.ts` is a static lookup table. 36 of 57 MCP tools (63%) are invisible to agents
because they aren't listed in any playbook stage. Adding a new tool requires manually editing playbook.ts.
Conditional tools (graph, search, handoff) are completely absent.

### Design: 3-Layer Architecture

**Layer 1 -- Tool Registry (self-declaring metadata)**

Each MCP tool declares its workflow metadata at registration time. No central playbook file.

```typescript
// When registering an MCP tool:
registerTool({
  name: 'plan_approve',
  // ... schema, handler ...
  workflow: {
    stage: ['planning'],              // which pipeline stages this appears in
    category: 'primary',              // primary | conditional | meta | utility
    requires: [],                     // toolbox dependencies (auto-hide if missing)
    trigger: 'plan-approved',         // event emitted on success
    prerequisites: ['plan_write'],    // tools that should run before this
    contextHint: (state) =>           // dynamic recommendation based on state
      state.planExists && !state.planApproved
        ? 'Plan is written but not approved. Ready to approve?'
        : undefined,
  }
});
```

**Layer 2 -- Contextual Recommendations (smart, not static)**

The engine looks at current state and recommends the specific next action:

```typescript
interface WorkflowRecommendation {
  primary: {
    tool: string;
    reason: string;
    args?: Record<string, unknown>;
  };
  secondary?: { tool: string; reason: string; }[];
  available: {
    primary: string[];
    conditional: string[];
    meta: string[];
    utility: string[];
  };
  stage: PipelineStage;
  progress: { tasksTotal: number; tasksDone: number; percentage: number; };
}
```

Contextual decision tree:

```
No feature                             --> feature_create
Feature + no memories                  --> memory_write + explore
Feature + memories, no plan            --> plan_write
Plan exists, not approved              --> plan_approve
Plan approved, no tasks                --> tasks_sync
Tasks exist, task in review            --> task_accept/reject (URGENT)
Tasks exist, task in revision          --> task_claim (retry)
Tasks exist, runnable tasks            --> task_claim
All tasks done                         --> feature_complete
Feature complete                       --> doctrine_suggest, memory_promote
```

**Layer 3 -- Event-Driven Transitions (reactive, not polled)**

PostToolUse hook emits events. The engine reacts:

| Event | Engine response |
|---|---|
| `plan-approved` | Load maestro:implement, recommend tasks_sync |
| `tasks-synced` | Recommend task_next then task_claim |
| `task-done` + all complete | Recommend feature_complete |
| `task-failed-verification` | URGENT: surface revision, deprioritize new claims |
| `tool-installed` | Conditional tools appear in playbook |

### 4 Tool Categories

```
PRIMARY       Core workflow -- shown prominently, actively recommended
CONDITIONAL   Shown only when external tool installed and allowed in toolbox
META          Always available, not stage-specific (status, doctor, visual)
UTILITY       Available but not actively recommended (list, info, read operations)
```

### Stage x Category Matrix

| Stage | Primary | Conditional | Meta | Utility |
|---|---|---|---|---|
| Discovery | feature_create, memory_write, skill | search_sessions* | status, skill_list, ping | feature_list, memory_list, memory_delete |
| Research | memory_write, memory_read, skill | search_sessions*, search_related* | status | memory_list, memory_delete, memory_stats |
| Planning | plan_write, plan_approve, memory_read | | status | plan_read, plan_comment, plan_revoke, plan_comments_clear |
| Approval | tasks_sync | | status | plan_read |
| Execution | task_claim, task_done, task_brief, task_accept, task_reject | graph_insights*, graph_next*, graph_plan*, handoff_send*, handoff_receive*, handoff_ack* | status, visual, debug_visual | task_list, task_info, task_spec_read, task_next, task_block, task_unblock, memory_compile |
| Done | feature_complete, doctrine_suggest, doctrine_approve, doctrine_write | | status, visual, execution_insights | memory_promote, doctrine_list, doctrine_read, doctrine_deprecate, memory_stats |

`*` = only shown if external tool installed and allowed

### New Files

```
workflow/
  engine.ts         # Core: stage --> collect tools --> filter --> recommend
  registry.ts       # Tool workflow metadata store (populated at MCP server startup)
  recommender.ts    # Runs contextHints, sorts by urgency, builds WorkflowRecommendation
  events.ts         # Event bus: emit('plan-approved'), on('task-failed-verification', handler)
```

### Playbook Generation Flow

```
maestro_status called
  --> derivePipelineStage(projectState)             [stages.ts]
  --> collectToolsForStage(stage)                   [registry.ts]
      --> all tools where workflow.stage includes current stage
  --> filterByToolbox(tools, toolboxRegistry)        [engine.ts]
      --> remove conditional tools where requires not installed
      --> remove tools denied in settings
  --> addMetaTools(tools)                            [engine.ts]
      --> append tools where category = 'meta'
  --> runContextHints(tools, projectState)           [recommender.ts]
      --> for each tool, call contextHint(state)
      --> sort: urgent (review/revision) > primary > secondary
  --> buildRecommendation(rankedTools, progress)     [recommender.ts]
      --> return WorkflowRecommendation
```

### New MCP Tools Needed (from gap analysis)

| New MCP tool | Mirrors CLI command | Why |
|---|---|---|
| `config_set` | `config-set` | Agents should configure maestro |
| `memory_archive` | `memory-archive` | Agents should archive old memories |
| `task_spec_write` | `task-spec-write` | Agents should write specs |
| `task_report_write` | `task-report-write` | Agents should write reports |

### Tool Consolidation

| Issue | Fix |
|---|---|
| `ping` vs `doctor` overlap | Merge or differentiate: `ping` = fast version check, `doctor` = full diagnostics |
| `task_next` vs `task_list` | Clarify: `task_next` = recommended + DCP context, `task_list` = raw enumeration |
| `memory_list` vs `memory_compile` | Clarify: `memory_list` = enumeration, `memory_compile` = DCP-scored selection |

---

## Flexible Pipeline + Skill-Driven Workflow

### Problem

The current pipeline is a rigid 6-stage sequence. Every work type (feature, bug, chore) goes through
all 6 stages. Skills exist but aren't loaded automatically -- agents must manually call `maestro_skill()`.
Tools are hardcoded per stage instead of being driven by skills.

### Work Types with Configurable Pipelines

```
feature:      discovery --> research --> planning --> approval --> execution --> done  (full ceremony)
bug:          planning --> execution --> done                                         (skip discovery/research, no approval)
chore:        execution --> done                                                     (minimal -- just do it)
hotfix:       execution --> done                                                     (emergency, no verification)
spike:        discovery --> research --> done                                         (research only, no implementation)
custom:       user-defined via settings.json
```

```typescript
interface WorkType {
  name: string;
  pipeline: PipelineStage[];
  requiredStages: PipelineStage[];          // must visit (can't skip)
  optionalStages: PipelineStage[];          // can skip
  skills: Record<PipelineStage, string>;    // which skill to load at each stage
  planRequired: boolean;
  approvalRequired: boolean;
}
```

Feature creation takes a type:

```
$ maestro feature-create "fix auth bug" --type bug
Pipeline: planning --> execution --> done
Loaded skill: maestro:debugging

$ maestro feature-create "fix typo" --type chore
Pipeline: execution --> done
No plan needed.
Loaded skill: maestro:implement
```

### Plan Requirements per Work Type

```
feature:  minLength: 100, requiresDiscovery: true, requiresNonGoals: true
bug:      minLength: 20,  requiresDiscovery: false, requiresNonGoals: false
chore:    minLength: 0 (no plan at all)
hotfix:   minLength: 0 (no plan at all)
spike:    minLength: 50,  requiresDiscovery: true, requiresNonGoals: false
```

For `chore`/`hotfix` with no plan: skip `tasks_sync`. Create a single implicit task from feature name.
`task_done` completes the feature directly.

For `approvalRequired: false` types: `plan_write` triggers auto-approval internally. No explicit
`plan_approve` needed.

### Skills AS the Workflow

**Key shift: skills drive the workflow, the engine just manages transitions and loads skills.**

```
BEFORE (hardcoded):
  workflow engine: "in execution, recommend task_claim, task_done"
  skills: documentation the agent optionally reads

AFTER (skill-driven):
  workflow engine: "entering execution, load the execution skill"
  skill content: "claim a task, implement with TDD, verify, call task_done"
  tools: discovered by agent from skill content, not hardcoded in engine
```

SessionStart hook auto-loads the right skill:

```
SessionStart:
  1. Read active feature + work type from .maestro/
  2. Derive current stage from project state
  3. Look up skill for this stage from work type config
  4. Inject skill summary into agent context (lazy -- full load on demand)
  --> Agent automatically knows what to do
  --> No manual maestro_skill() call needed
```

### Stage Navigation

New MCP tool: `maestro_stage`

```
maestro_stage({ action: 'next' })      # normal forward transition
maestro_stage({ action: 'skip' })      # skip current stage (only if optional)
maestro_stage({ action: 'back' })      # go to previous stage
maestro_stage({ action: 'jump', target: 'planning' })  # jump to specific stage
```

Guards:
- `skip`: only for `optionalStages`. Required stages can't be skipped.
- `jump` forward: validates all required stages between current and target are complete.
- `back`: always allowed. Artifacts (plan, tasks) preserved.

### User-Configurable Work Types + Skills

```jsonc
// .maestro/settings.json
{
  "workflow": {
    "types": {
      "bug": {
        "skills": {
          "planning": "my-team:bug-triage",         // override default skill
          "execution": "my-team:impl-standards"
        }
      },
      "security-fix": {                              // entirely new work type
        "pipeline": ["research", "planning", "approval", "execution", "done"],
        "requiredStages": ["planning", "approval", "execution", "done"],
        "skills": {
          "research": "my-team:security-audit",
          "planning": "maestro:design",
          "execution": "maestro:implement"
        },
        "planRequired": true,
        "approvalRequired": true
      }
    }
  }
}
```

### Multiple Concurrent Features

Each feature has its own pipeline, stage, and skill context:

```
$ maestro status

Active features:
  [1] toolbox-refactor    (feature)   execution  4/7 tasks done
  [2] fix-auth-bug        (bug)       planning   writing plan
  [3] update-readme       (chore)     execution  1/1 tasks done

Switch: maestro feature-active <name>
```

Switching features reloads the skill and DCP context for that feature.

### Edge Cases -- Pipeline Navigation

| # | Edge case | Fix |
|---|---|---|
| 1 | Go back to planning after tasks exist | `tasks_sync` handles: keeps done tasks, creates new, removes orphaned pending. Warn user. |
| 2 | Go back to planning after tasks are DONE | Don't delete done tasks. New `tasks_sync` creates additional tasks. Done tasks preserved as history. |
| 3 | Skip all optional stages to done with no work | Guard: at least `requiredStages` must be visited. Error if no tasks/summary. |
| 4 | Jump forward past required stages | Validate all required stages between current and target are complete. Error with specific missing stage. |
| 5 | Jump back creates inconsistent state | Allow. Plan and tasks persist. Agent revises, then returns. State is additive, not destructive. |
| 6 | Circular navigation (back and forth 4+ times) | Allow but `doctor` warns: "Feature has re-entered planning 4 times. Consider simplifying scope." |

### Edge Cases -- Work Types

| # | Edge case | Fix |
|---|---|---|
| 7 | Chore with no plan -- how does tasks_sync work? | Skip `tasks_sync`. Create single implicit task from feature name. `task_done` completes feature. |
| 8 | Change work type mid-feature | `maestro_feature_update({ type: 'feature' })`. Recalculates pipeline. Existing artifacts preserved. |
| 9 | Custom work type conflicts with built-in name | User overrides specified fields. Unspecified fall back to built-in defaults. Doctor warns. |
| 10 | Custom work type with invalid pipeline | Validate at config load: `done` must be last, stages from known set. Error with fix suggestion. |
| 11 | Hotfix bypasses verification | Intentional. Doctor flags: "Completed as hotfix with no verification." Settings can disable hotfix type. |
| 12 | Spike completes without implementation | For spike, `feature_complete` requires memories (research output), not tasks. |
| 13 | Unknown work type (typo) | Validate against known types. Error with fuzzy suggestion: "Did you mean 'feature'?" |

### Edge Cases -- Skills

| # | Edge case | Fix |
|---|---|---|
| 14 | Skill not found for a stage | Warn, continue without skill. Tools still available via workflow engine. |
| 15 | Custom skill doesn't mention right tools | Not enforced. Skills are guidance, not enforcement. Tools still work. |
| 16 | Multiple skills for one stage | Priority: user custom > stage default > tool-bundled. One primary, tool-bundled additive. |
| 17 | Skill references tools that don't exist | Agent gets error on call. Skill is still useful guidance even with one tool missing. |
| 18 | Skill is 10K tokens, bloats context | Lazy loading: SessionStart injects summary (name + 200 chars). Full load on `maestro_skill()`. |

### Edge Cases -- Concurrent Features

| # | Edge case | Fix |
|---|---|---|
| 19 | Multiple features at different stages | Skill loads for active feature. `feature_active` switches context. |
| 20 | Two features both in execution | Independent task state. Switching reloads skill + DCP context. |
| 21 | Concurrent features with conflicting file changes | Git/merge problem, not workflow. Doctor can warn about overlapping files. |
| 22 | Multiple agents on different features | Each agent gets feature-scoped DCP context. Feature isolation via memory/task scoping. |
| 23 | Feature depends on another feature's output | Not supported (features are independent). Workaround: promote memories from A, start B. |

### Edge Cases -- Transitions & Events

| # | Edge case | Fix |
|---|---|---|
| 24 | Event conflicts with manual stage jump | Events suggest, don't force. Recommendation updates but agent decides. |
| 25 | Feature reopened after done | Allow. Status reverts from completed. Use case: add fix task to completed feature. |
| 26 | Auto-approval for bug type | `plan_write` triggers internal auto-approval for `approvalRequired: false` types. |

### Edge Cases -- Plan Validation & Session

| # | Edge case | Fix |
|---|---|---|
| 27 | Bug plan missing Discovery section | Validation keyed by work type. Bug: no Discovery required. |
| 28 | Work type changed after plan written | Re-validate against new requirements. Warn if plan doesn't meet new type. Don't block. |
| 29 | Chore accidentally has a plan | Allow. `planRequired: false` means not required, not forbidden. More structure is fine. |
| 30 | New session, agent doesn't know work type | Work type stored in `feature.json`. SessionStart reads it, loads right skill. |
| 31 | Mid-stage-jump session ended | Stage derived from state (self-healing). Stage jumps that change state persist via artifacts. |
| 32 | Settings changed between sessions | Re-derive pipeline at session start. Warn if required stage was added but not visited. |

---

## Built-in Skills Overhaul

### Disposition (21 --> 18)

**Merges:**
- `maestro:new-feature` --> absorbed into `maestro:design` (interview guide moves to `reference/`)
- `maestro:setup` --> renamed to `maestro:init` (loads on `maestro init`)
- `maestro:status` --> REMOVED (confusable with CLI command, low value)

**Aliases cleanup:** Remove all deprecated aliases. No backward-compat period. Clean break.
Old aliases (`new-track`, `maestro:new-track`, `agents-md-mastery`, `writing-plans`, etc.) are deleted from `aliases.ts`. If referenced, error: "Skill not found."

### Final 18 Skills Mapped

| Skill | Category | Stage(s) | Audience | Condition |
|---|---|---|---|---|
| `maestro:brainstorming` | primary | discovery, research | both | always |
| `maestro:design` | primary | discovery, research, planning | both | always |
| `maestro:parallel-exploration` | primary | discovery, research | orchestrator | always |
| `maestro:plan-review-loop` | primary | planning | both | always |
| `maestro:implement` | primary | execution | worker | always |
| `maestro:dispatching` | primary | execution | orchestrator | always |
| `maestro:tdd` | primary | execution | worker | always |
| `maestro:debugging` | primary | execution | both | always |
| `maestro:review` | primary | execution, done | both | always |
| `maestro:verification` | primary | execution | worker | always |
| `maestro:revert` | primary | execution | both | always (revived) |
| `maestro:note` | utility | all stages | both | always (revived) |
| `maestro:simplify` | utility | done | both | always (revived, runs before feature_complete) |
| `maestro:visual` | utility | planning, execution, done | both | contextual (complex plan, debug UI, final dashboard) |
| `maestro:init` | primary | pre-pipeline | both | always (renamed from setup) |
| `maestro:agents-md` | primary | pre-pipeline | both | always |
| `maestro:docker` | conditional | execution | worker | Dockerfile/docker-compose present |
| `maestro:prompt-leverage` | meta | all stages | both | always (never auto-loaded) |
| `maestro:next-move` | meta | discovery, done | both | always (suppress during execution) |

### Work Type --> Skill Selection

Not all skills load for every work type. The work type config selects a subset:

```
feature execution:  implement + tdd + dispatching (orchestrator gets dispatching, worker gets implement + tdd)
bug execution:      debugging + implement
chore execution:    implement only
hotfix execution:   implement only
spike:              no execution skills (research only)
```

### Audience Targeting

Skills declare `audience: 'orchestrator' | 'worker' | 'both'`:
- **Orchestrator**: dispatching, parallel-exploration (coordination skills)
- **Worker**: implement, tdd, verification (implementation skills)
- **Both**: debugging, review, design, brainstorming (anyone can use)

SessionStart hook checks agent role and filters accordingly.

### Auto-Load Budget

- Max 2 primary skills auto-injected per stage (summary only -- name + description + first 200 chars)
- Full content on demand via `maestro_skill()`
- Total skill injection budget: 2000 tokens max
- If two skills exceed budget: primary full, secondary summary-only
- Meta skills NEVER auto-loaded (catalog only, explicit `maestro_skill()`)
- Reference files NEVER auto-loaded (on-demand via `reference:` param)

### `maestro:visual` Context Triggers

| Context | Stage | Trigger condition | Hint |
|---|---|---|---|
| Complex plan | planning | taskCount >= 10 or phaseCount >= 4 | "Generate plan-graph to review architecture before approving" |
| Progress check | execution | mid-execution status check | "Generate status-dashboard to see task progress" |
| Debug UI | execution | blocked task or debugging context | "Generate state-flow or dom-diff to describe bug for worker agent" |
| Final review | done | feature complete | "Generate execution-timeline to review what happened" |

### `maestro:simplify` in Done Stage

Runs after all tasks done, before `feature_complete`:

```
All tasks done
  --> maestro:review (review implementation)
  --> maestro:simplify (clean up, refactor, remove dead code)
  --> feature_complete
  --> doctrine_suggest
```

### `maestro:next-move` Suppression

Meta skill but context-aware: only surfaces when `stage === 'done'` or no active feature.
Suppressed during execution (contradicts the plan). Available via explicit load anytime.

### `maestro:docker` Detection

```typescript
detect: () =>
  existsSync('Dockerfile') ||
  existsSync('docker-compose.yml') ||
  existsSync('docker-compose.yaml') ||
  existsSync('.dockerignore')
```

Detection is advisory. Skill surfaces in `skill_list` but never auto-loaded.
Agent decides whether to load it.

### Edge Cases -- Skill Merges

| # | Edge case | Fix |
|---|---|---|
| 1 | new-feature content lost in merge | Extract interview guide into `maestro:design/reference/` directory. Design skill references it as alternative flow for greenfield features. |
| 2 | Old aliases reference merged/removed skills | Remove all old aliases. Clean break. Error: "Skill not found." No deprecation period. |
| 3 | User's workflow config references merged skill | Config resolution fails with clear error: "maestro:new-feature was merged into maestro:design. Update your settings." |
| 4 | init is a CLI action not a pipeline stage | `maestro:init` loads in TWO contexts: (a) `maestro init` called, (b) doctor detects uninitialized project. Pre-pipeline, not a stage. |
| 5 | maestro:status removed but referenced externally | Error: "Skill maestro:status was removed. Use maestro_status tool instead." No alias. |

### Edge Cases -- Execution Overload

| # | Edge case | Fix |
|---|---|---|
| 6 | 7 primary skills in execution stage -- token explosion | Never load all 7. Work type selects subset: feature = implement + tdd + dispatching. Bug = debugging + implement. |
| 7 | Worker gets orchestrator skills (dispatching) | `audience` field in frontmatter. Workers get implement + tdd. Orchestrator gets dispatching + review. |
| 8 | Even 3 skills exceed token budget | Max 2 auto-injected (summary only). Third+ available via manual `maestro_skill()`. Total cap: 2000 tokens. |
| 9 | Which skill is primary when multiple exist? | Work type config declares ONE primary per stage. Others are secondary (available, not auto-loaded). |

### Edge Cases -- Conditional & Visual

| # | Edge case | Fix |
|---|---|---|
| 10 | Docker detection false positive (CI-only Dockerfile) | Detection is advisory, not auto-loading. Agent decides. |
| 11 | Docker files added mid-session | Skill cache invalidated on next `skill_list` / `status` check. |
| 12 | Visual loaded for simple 2-task plan | `contextHint` threshold: only surfaces if taskCount >= 10 or phaseCount >= 4. |
| 13 | Visual for debugging but agent doesn't know which template | Skill content lists templates with use cases. Agent picks based on context. |
| 14 | Visual in done stage for trivial chore | Work type gates: visual suggested in done only for `feature` and `spike`. |

### Edge Cases -- Utility & Meta

| # | Edge case | Fix |
|---|---|---|
| 15 | Simplify makes changes that break tests | Skill content says: "Run tests after each simplification." Guidance quality, not system enforcement. |
| 16 | Simplify is not wanted -- user skips | Not enforced. Utility suggestion only. Agent can ignore. |
| 17 | Note skill surfaces constantly ("you haven't saved memories") | Throttle: only if `memoryCount === 0` AND stage is research or later. Max once per session. |
| 18 | prompt-leverage loaded but agent doesn't need it | Meta skills shown in catalog, NEVER auto-loaded. Explicit `maestro_skill()` only. |
| 19 | next-move loaded during execution -- contradicts plan | Suppressed during execution via `contextHint`. Only surfaces at `done` or no active feature. |

### Edge Cases -- Revived Skills

| # | Edge case | Fix |
|---|---|---|
| 20 | Revert loaded but no feature to revert | `contextHint`: only surface when tasks exist and at least one is done. |
| 21 | Revert conflicts with active execution | Scoped: "Use to revert a specific completed task." Surgical tool, not workflow stage. |
| 22 | Revived skills have stale content (written months ago) | Review and update content during v2 refactor. Update references to new architecture. |

### Edge Cases -- Stage Transitions & Budget

| # | Edge case | Fix |
|---|---|---|
| 23 | Skills from previous stage linger in context | SessionStart loads skills for CURRENT stage only. Previous not injected. Manual `maestro_skill()` for previous stage skills. |
| 24 | Stage jump back -- which skills load? | Skills for target stage. Jump to planning = design + plan-review-loop. Execution skills dropped. |
| 25 | Chained skills create unexpected loads | Chain is suggestion, not forced. Engine checks: "already loaded this session? Skip." Track loaded skills per session. |
| 26 | Auto-loaded skill is 500 lines | Summary injection only (name + description + 200 chars). Full content via `maestro_skill()`. |
| 27 | Two auto-loaded skills + DCP + worker rules = 3000 tokens | Skill injection capped at 2000 tokens. Primary full summary, secondary truncated. DCP and worker rules have separate budgets. |
| 28 | Reference files are large (revert: 498 lines of git commands) | Reference files never auto-loaded. On demand via `maestro_skill({ name, reference })`. Main SKILL.md should be concise overview pointing to references. |

---

## Agent Tools System

### Concept

Agent tools are different from maestro tools. Maestro tools provide ports (maestro calls them).
Agent tools are used by the agent directly during work (code navigation, search, linting).
Maestro detects them and provides adaptive guidance to workers.

```
toolbox/tools/    --> MAESTRO calls these (ports, adapters)
toolbox/agents/   --> AGENTS use these (detection, guidance only)
```

### Decision Tree: Where Does a Tool Go?

```
I built/found a tool. Where does it go?

1. Does maestro's backend need to call it? (task storage, graph, search index, handoff)
   --> YES: toolbox/tools/external/ (with adapter.ts)

2. Do agents use it during work? (code navigation, linting, testing, formatting)
   --> YES: toolbox/agents/ (with guidance.md, no adapter)

3. Both?
   --> toolbox/tools/external/ with guidance.md alongside adapter.ts
   --> Pre-agent hook loads guidance. Toolbox loads adapter.
```

### Directory Structure

```
toolbox/
  agents/                             # Agent tools
    built-in/                         # Ships with maestro
      tilth/
        manifest.json
        guidance.md
      rg/
        manifest.json
        guidance.md
      sg/
        manifest.json
        guidance.md
      git/
        manifest.json
        guidance.md
    external/                         # User/community agent tools
      .gitkeep

    protocols/                        # Composed workflows (adapt to what's installed)
      code-intelligence.md            # tilth + rg + sg chain protocol + fallbacks
      search-strategy.md              # Search tool selection
      verification-tools.md           # Build/test tool selection
```

### Agent Tool Manifest

```jsonc
// toolbox/agents/built-in/tilth/manifest.json
{
  "name": "tilth",
  "description": "Structure-aware code navigation and reading",
  "binary": "tilth",
  "detect": "tilth --version",
  "install": "cargo install tilth",
  "homepage": "https://github.com/user/tilth",
  "minVersion": "0.5.0",
  "category": "code-intel",
  "protocols": ["code-intelligence"],
  "alternatives": ["ctags", "cscope"],
  "guidance": "./guidance.md"
}
```

### Protocol Files -- Adaptive Composition

Protocols describe how agent tools work together. They have conditional sections
based on which tools are installed. The pre-agent hook selects the right section.

```markdown
<!-- toolbox/agents/protocols/code-intelligence.md -->
---
name: code-intelligence
description: Code navigation and analysis protocol
requires_any: [tilth, rg, sg]
stages: [execution]
audience: worker
---

## When all three available (tilth + rg + sg)

Chain protocol: SCOUT --> SURGEON --> ANALYST
1. SCOUT (rg): Cast wide net. `count` or `files_with_matches` first.
2. SURGEON (sg): Classify structurally. Separate code from comments/strings.
3. ANALYST (tilth): Read only what matters. Context for complex logic.

## When tilth + rg (no sg)

Modified chain: SCOUT --> ANALYST
1. SCOUT (rg): Search with `files_with_matches`, then `content`.
2. ANALYST (tilth): Read files, structural overview.
For structural patterns: use rg `multiline: true` as sg fallback.

## When rg only

Basic search:
1. rg for all text search.
2. Host Read for file content.
3. rg `multiline: true` for cross-line patterns.

## When nothing installed

Fallback: host Grep + host Read + host Glob.
```

Protocol section selection:

```typescript
// Most specific match wins (highest tool count)
function selectProtocolSection(protocol, installedTools): string {
  const sections = parseProtocolSections(protocol);
  // Score each section by matching tools, pick highest
  // "tilth + rg + sg" (3) beats "tilth + rg" (2) beats "rg only" (1)
}
```

### Worker Injection Flow

```
Pre-agent hook fires:
  1. Scan toolbox/agents/ for all agent tools
  2. Run detection (parallel, cached with short TTL)
  3. For each installed tool: load guidance.md
  4. For each protocol: select section based on installed tools
  5. Assemble guidance + protocols into worker context
  6. Apply token budget (1000 tokens max for agent tools + protocols)

Worker receives:
  "## Available Code Tools

  ### tilth (installed, v0.5.0)
  Use `tilth <query> --scope <dir>` for navigation...

  ### rg (installed, v14.1)
  Use rg for exhaustive text search...

  ### sg -- NOT INSTALLED
  Install: cargo install ast-grep

  ## Code Intelligence Protocol (tilth + rg, no sg)
  Modified chain: SCOUT (rg) --> ANALYST (tilth)..."
```

### Adaptive Guidance (key examples)

```
All three installed (tilth + rg + sg):
  --> Full chain protocol loaded
  --> Worker gets: "rg (scope) --> sg (classify) --> tilth (read)"

tilth + rg installed, sg missing:
  --> Partial chain: "rg (scope) --> tilth (read). Use rg multiline for structural patterns."

Only rg installed:
  --> Basic: "rg for search. Host Read for files."

Nothing installed:
  --> Fallback: "Use host Grep, Read, Glob."
```

### Doctor Output

```
$ maestro doctor

agent tools:
  code-intel:
    [ok] tilth v0.5.0
    [--] sg            not installed (cargo install ast-grep)
  search:
    [ok] rg v14.1.0
  vcs:
    [ok] git v2.44.0

  protocols:
    code-intelligence: PARTIAL (sg missing)
      --> workers get tilth+rg chain (no AST classification)
    search-strategy: FULL
    verification-tools: FULL
```

### User Creates/Installs Agent Tools

```
$ maestro toolbox create biome --agent-tool
Scaffolded toolbox/agents/external/biome/

$ maestro toolbox install https://github.com/someone/maestro-agent-biome --agent-tool
Installed to toolbox/agents/external/biome/

$ maestro toolbox install https://github.com/someone/tool --agent-tool --global
Installed to ~/.maestro/agents/external/
```

### Token Budget for Agent Tool Injection

```
Pre-agent hook total injection:
  DCP context:          separate budget (memoryBudgetTokens, default 1024)
  Worker rules:         500 tokens max
  Agent tool guidance:  500 tokens max
  Agent tool protocols: 500 tokens max
  Skill summary:        500 tokens max

  Each has its own cap. Pre-agent hook enforces all.
  If guidance exceeds cap: installed tools get full guidance, protocols truncated.
  If protocols exceed cap: most relevant protocol (by stage) gets priority.
```

### User Overrides Built-in Guidance

```
# Override tilth guidance without forking built-in:
toolbox/agents/external/tilth/guidance.md

# External shadows built-in (same name). Doctor warns:
# "tilth guidance overridden by external version."
```

### Settings Integration

```jsonc
{
  "agentTools": {
    "allow": ["tilth", "rg", "sg", "git"],
    "deny": [],
    "config": {
      "tilth": { "binary": "tilth-nightly" }
    }
  }
}
```

Same allow/deny pattern as toolbox tools. Denied agent tools excluded from guidance injection.

### Edge Cases

#### Host Tool Overlap

| # | Edge case | Fix |
|---|---|---|
| 1 | rg duplicates host Grep capability | Guidance clarifies: "Use host Grep for searches. Use `rg` via Bash only for features host Grep can't do (specific flags, piped workflows)." Agent tools supplement, not replace host tools. |
| 2 | tilth not in worktree PATH (worker spawned in git worktree) | Pre-agent hook checks `which <binary>` in worktree context (via cwd). Not found = unavailable for that worker. Guidance adapts: "tilth unavailable in this worktree. Use host Read." |
| 3 | Host tool behavior changes in future Claude Code version | Guidance references agent tools by CLI interface, not host tools. Host changes don't break agent tool guidance. |

#### Tool Versions & Compatibility

| # | Edge case | Fix |
|---|---|---|
| 4 | Tool version too old for guidance | `minVersion` in manifest. Doctor: "tilth 0.2.0 installed, guidance requires 0.5.0." Guidance still loads (best effort). |
| 5 | Tool version too new (breaking changes) | Future: `maxVersion` field. Version-specific guidance sections (`## sg v1.x` / `## sg v2.x`). For now: guidance targets current stable. |
| 6 | Multiple versions installed (`tilth` and `tilth-nightly`) | Settings override: `"agentTools": { "config": { "tilth": { "binary": "tilth-nightly" } } }`. Manifest declares one binary, config overrides. |
| 7 | Tool output format changes between versions | Agent tools don't parse output (maestro tools do). Agents read human output. Format changes are the agent's problem. |

#### Guidance Quality

| # | Edge case | Fix |
|---|---|---|
| 8 | Guidance is stale (references deleted features) | Doctor checks guidance mtime. "tilth guidance last updated 180 days ago." User reviews and updates. |
| 9 | Guidance is wrong (nonexistent flag) | Agent gets error, self-corrects. Guidance is best-effort, not guaranteed. |
| 10 | Guidance contradicts user's CLAUDE.md | CLAUDE.md always wins (user's explicit rules). Guidance is additive. If CLAUDE.md says "never use tilth", settings: `"agentTools": { "deny": ["tilth"] }`. |
| 11 | User wants to customize built-in guidance | `toolbox/agents/external/tilth/guidance.md` shadows built-in. Same name = override. Doctor notes the override. |
| 12 | Testing guidance quality | Future: `maestro toolbox test tilth --agent-tool` spawns test agent, tries commands from guidance. Reports success rate. Not v2 blocker. |

#### Protocol Edge Cases

| # | Edge case | Fix |
|---|---|---|
| 13 | Protocol section selection ambiguous | Most specific match wins. Score by matching tool count. "tilth + rg" (2) beats "rg only" (1). |
| 14 | Protocol references tool not in `agents/` (e.g., ctags) | Section referencing ctags never selected (ctags not in installed list). Dead section, no harm. |
| 15 | User adds tool that should participate in existing protocol | User edits protocol file or creates custom protocol in `agents/protocols/`. Built-in protocols don't auto-discover. |
| 16 | Two protocols give conflicting rg guidance | Protocols should be independent domains. If overlap: combine into one protocol. Doctor warns: "rg in 2 protocols with different guidance." |
| 17 | All protocols combined exceed budget | Protocol budget: 500 tokens total. Each selected section truncated proportionally. Most relevant protocol (by current stage) gets priority. |

#### Worker Context & Injection

| # | Edge case | Fix |
|---|---|---|
| 18 | Total injection exceeds budget (guidance + DCP + rules + skill) | Each component has separate budget cap. Pre-agent hook enforces: DCP (1024), rules (500), agent tools (500), protocols (500), skill (500). |
| 19 | Worker doesn't need code tools (task is "update README") | Protocol declares `stages: [execution]` and `taskTypes: [feature, bug]`. Chore tasks skip code-intel protocol. Agent tools detected but protocol not injected for simple tasks. |
| 20 | Orchestrator gets code-tool guidance but doesn't write code | Protocol `audience: 'worker'`. Orchestrator only gets protocols marked `audience: 'orchestrator'` or `'both'`. Code guidance to workers only. |
| 21 | Parallel workers on different machines (different tools available) | Each worker's pre-agent hook checks independently. Worker 1: full chain. Worker 2: rg-only fallback. Same protocol, different section per worker. |

#### Cross-Platform & Environment

| # | Edge case | Fix |
|---|---|---|
| 22 | Tool installed globally but not in worktree PATH | Pre-agent hook runs `which <binary>` with worktree cwd. Not found = mark unavailable for that worker. |
| 23 | Docker container execution | Detection runs inside container. If nothing found, minimal fallback guidance. |
| 24 | Remote development (SSH) | Maestro runs where the agent runs. Detection checks that environment. Not a maestro concern. |
| 25 | Windows path (`tilth.exe`, PATH separator `;`) | Detection uses cross-platform `which`/`where`. Manifest can declare `"binaryWindows": "tilth.exe"`. |
| 26 | Tool needs specific shell (zsh vs fish) | Detection uses user's configured shell. If fails in that shell, it fails. Doctor shows error. |

#### Tool Dependencies & Interactions

| # | Edge case | Fix |
|---|---|---|
| 27 | Agent tool depends on another agent tool (bv needs br) | Manifest `requires: ["br"]`. Detection: if br missing, bv marked "dependency missing." Doctor shows. |
| 28 | Agent tool is actually an MCP server | Goes in `toolbox/tools/external/` (with adapter), NOT `agents/`. MCP servers are maestro tools. |
| 29 | Tool produces huge output (rg returns 10MB) | Guidance should say: "Always use `head_limit`, `files_with_matches` before `content`." Good guidance prevents this. |
| 30 | Tool is slow (sg on large codebase, 30+ seconds) | Guidance: "Scope with `--lang` or specific directories." Runtime performance is agent's concern, not maestro's. |

#### Lifecycle

| # | Edge case | Fix |
|---|---|---|
| 31 | Tool uninstalled mid-session | Next worker spawn re-detects (cached with ~60s TTL for agent tools). Current worker may fail on commands -- normal error handling. |
| 32 | Tool upgraded mid-session | Detection re-runs on next spawn. Version cache updated. If new version breaks guidance, worker self-corrects. |
| 33 | Tool is a shell script, not a binary | Manifest `binary` can be a script: `"binary": "my-linter.sh"`. Works if in PATH or full path given. |
| 34 | Tool is an alias (`alias sg='ast-grep'`) | `which` doesn't find aliases in non-interactive shell. Manifest uses real binary name (`ast-grep`). Guidance can mention alias. |
| 35 | Tool available globally AND as external override | External overrides built-in (same as skills). Both detected, external guidance wins. |
| 36 | External agent tool directory has no manifest.json | Skip directory. Doctor warns: "agents/external/broken/ has no manifest.json." |
| 37 | Agent tool installed from GitHub, repo deleted | Local copy. Still works. `maestro toolbox update` fails: "Source unavailable." |
| 38 | Agent tools detection is slow (many tools) | Parallel `Promise.all()` + `.toolcache.json` with TTL. Same pattern as toolbox tools. |

---

## Handoff System

### Problem

Current handoff only works with agent-mail (external dependency). No built-in fallback.
Not in any playbook stage. Tightly coupled to beads/br model. No session continuity.
No cross-host support. No goal-oriented context selection.

### Design: Goal-Oriented Handoff (inspired by Amp)

**Key insight from Amp:** Don't snapshot everything. Specify what the NEXT session should DO,
and extract only what's relevant for that goal. Focused threads yield better results than
compressed long threads.

**Maestro's handoff combines two concepts:**
1. **Structured snapshots** -- capture work state (filesystem, readable by agents AND humans)
2. **Goal-oriented context** -- score and select what matters for the specified goal

### 5 Handoff Scenarios

```
Scenario 1: SESSION CONTINUITY
  Session 1 ends mid-work --> handoff written --> Session 2 reads it, continues

Scenario 2: AGENT DELEGATION
  Orchestrator --> handoff --> Worker (task briefing)
  Worker --> handoff --> Orchestrator (completion report)

Scenario 3: HOST SWITCHING
  Claude Code session --> handoff --> Codex session picks up

Scenario 4: PARALLEL SYNC
  Worker A finishes task 1 --> handoff --> Worker B needs A's output for task 2

Scenario 5: HUMAN HANDOFF
  Agent session ends --> handoff --> Human reads it, understands where things are
```

Scenarios #2 and #4 are partially handled (pre-agent hook + execution memory).
The handoff system unifies all 5 under one mechanism.

### Goal-Oriented Context Selection

The same feature produces DIFFERENT handoffs based on the goal:

```
Goal: "continue implementing task 04"
  --> Extracts: task spec, files changed, remaining work, test status
  --> Focused on: one task's implementation details

Goal: "review all completed tasks"
  --> Extracts: execution memories for tasks 01-03, verification scores
  --> Focused on: what was built, not what's remaining

Goal: "unblock task 05 which depends on 04"
  --> Extracts: task 04's interface, what 05 needs, dependency graph
  --> Focused on: the interface between tasks

Goal: "hand this to a teammate to finish"
  --> Extracts: full feature status, all decisions, plan, blockers
  --> Focused on: everything a new person needs
```

**This is DCP but for handoffs.** Instead of scoring memories by relevance to a TASK,
score everything by relevance to the GOAL.

### Goal-Based Scoring

```typescript
function scoreByGoal(memories: MemoryWithMeta[], goal: string): ScoredMemory[] {
  const goalKeywords = extractKeywords(goal);
  return memories.map(m => {
    const score =
      0.40 * scoreKeywordOverlap(m, goalKeywords) +  // goal keywords matter most
      0.25 * scoreCategoryForGoal(m.category, goal) + // decisions rank high
      0.20 * scoreRecency(m.updatedAt) +              // recent > old
      0.15 * normalizePriority(m.priority);           // user priority
    return { ...m, score };
  });
}
```

### Handoff Document Format

Human-readable AND agent-parseable. YAML frontmatter + markdown body.

```markdown
---
feature: toolbox-refactor
type: feature
stage: execution
goal: "continue implementing task 04-verification-extract"
generated: 2026-03-23T15:42:00Z
fromHost: claude-code
fromSession: abc123
maestroVersion: 0.3.0
progress:
  done: 4
  total: 7
gitBranch: feat/toolbox
gitHead: abc1234
---

# Handoff: toolbox-refactor

## Goal
Continue implementing 04-verification-extract

## Status
Pipeline: execution (4/7 tasks, 57%)
Active task: 04-verification-extract (claimed, ~60% complete)
Blockers: none

## This Session
- Completed 01-setup-types (score 0.85)
- Completed 02-registry (score 0.90)
- Completed 03-sdk-transports (2 revisions, then passed)
- Started 04-verification-extract

## In Progress
Task: 04-verification-extract
  Changed: tasks/verification/usecase.ts, tasks/verification/adapter.ts
  Done: moved verifyTask from server/task.ts to usecase
  Remaining: wire CLI handler, add tests
  Uncommitted: 2 files staged

## Decisions
- AdapterContext pattern for toolbox wiring
- Verification stays in tasks/ (not toolbox) per architecture review M5
- Two-phase adapter wiring for cross-port deps

## Next Actions
1. Complete 04-verification-extract (CLI handler + tests)
2. Claim 05-error-envelope (no dependencies)
3. Then: 06-workflow-engine, 07-skill-overhaul (both depend on 05)

## Relevant Files
- tasks/verification/usecase.ts (main implementation)
- tasks/verification/adapter.ts (FsVerificationAdapter)
- cli/handlers/task.ts (needs update)
- src/__tests__/unit/verify-task.test.ts (needs path updates)

## Context Pointers
- Plan: .maestro/features/toolbox-refactor/plan.md
- Key memories: design-decision-adapter-context, research-current-adapters
- Active doctrine: 2 items
```

### Storage

```
.maestro/handoffs/
  latest.md                           # always points to most recent handoff
  2026-03-23T15-42-00Z.md            # timestamped snapshots
  2026-03-23T14-10-00Z.md
```

### Three Handoff Triggers

**1. Automatic (session boundary)**

```
PreCompact hook (before context compression):
  --> Infer goal from current work:
      - Task claimed: "continue implementing <task>"
      - In planning: "finish reviewing/writing the plan"
      - In research: "continue research on <topic>"
  --> Auto-generate handoff with inferred goal
  --> Save to .maestro/handoffs/latest.md
  --> Inject summary into compressed context

SessionStart hook:
  --> Check .maestro/handoffs/latest.md
  --> If exists AND not acknowledged: inject into agent context
  --> Agent knows exactly where to continue
```

**2. Explicit (agent/user decides)**

```
maestro_handoff({
  goal: "hand this to Sarah to finish the CLI handlers",
  feature: "toolbox-refactor",
  targetAgent: "sarah"
})
--> Generates goal-focused handoff
--> User reviews draft, edits if needed
--> Saves to filesystem + sends via agent-mail if available
```

**3. Task-driven (automatic on task transitions)**

```
task_done   --> execution memory (mini-handoff, already exists)
task_block  --> handoff with blocker context
feature_complete --> final handoff (feature summary)
```

### Built-in Adapter (filesystem, always available)

```typescript
class FsHandoffAdapter implements HandoffPort {
  async write(feature, opts): Promise<HandoffResult> {
    // 1. Gather current state from all domains
    // 2. Score by goal (or infer goal from state)
    // 3. Build handoff document (budget: 3000 tokens max)
    // 4. Write timestamped file + update latest.md
    return { filePath };
  }
  async read(feature): Promise<HandoffDocument | null> { /* read latest.md */ }
  async list(feature, limit?): Promise<HandoffSummary[]> { /* list timestamped files */ }
  async acknowledge(feature): Promise<void> { /* mark as acknowledged in frontmatter */ }
}
```

### Agent-Mail Extension (optional, adds networking)

```
Toolbox resolution:
  agent-mail installed --> AgentMailHandoffAdapter (filesystem + HTTP)
  agent-mail absent    --> FsHandoffAdapter (filesystem only)

Both always write to filesystem. Agent-mail adds cross-machine delivery.
```

### Cross-Host Handoff

**Same machine (shared filesystem):**
```
Claude Code writes .maestro/handoffs/latest.md --> session ends
Codex reads .maestro/handoffs/latest.md --> continues seamlessly
```

**Different machines:**
```
Machine A (Claude Code):
  writes filesystem + sends via agent-mail

Machine B (Codex):
  receives from agent-mail inbox --> recreates handoff locally
```

### HandoffPort Interface

```typescript
interface HandoffPort {
  write(feature: string, opts?: {
    goal?: string;              // what the next session should do
    message?: string;           // custom human message
    targetAgent?: string;       // specific recipient
    draft?: boolean;            // return draft for review (default: true)
  }): Promise<HandoffResult>;

  read(feature: string): Promise<HandoffDocument | null>;
  list(feature: string, limit?: number): Promise<HandoffSummary[]>;
  acknowledge(feature: string): Promise<void>;
}

interface HandoffDocument {
  // Frontmatter
  feature: string;
  type: string;
  stage: PipelineStage;
  goal?: string;
  generated: string;
  fromHost: string;
  fromSession?: string;
  maestroVersion: string;
  progress: { done: number; total: number };
  gitBranch?: string;
  gitHead?: string;

  // Body (parsed from markdown)
  status: string;
  thisSession: string;
  inProgress?: string;
  decisions: string;
  nextActions: string;
  relevantFiles: string[];
  contextPointers: string;
  message?: string;
}

interface HandoffResult {
  filePath: string;
  prompt?: string;              // generated draft prompt (if draft: true)
  relevantFiles?: string[];
  estimatedTokens?: number;
  agentMailSent?: boolean;
  threadId?: string;
}
```

### MCP Tools

```
maestro_handoff({
  goal?: string,          // what next session should do (auto-inferred if omitted)
  feature?: string,       // defaults to active feature
  message?: string,       // custom message
  targetAgent?: string,   // specific recipient
  draft?: boolean         // show draft for review (default: true)
})
--> Returns: draft prompt + relevant files + token estimate

maestro_handoff_read({ feature? })
--> Read latest handoff

maestro_handoff_list({ feature?, limit? })
--> List handoff history

maestro_handoff_ack({ feature? })
--> Acknowledge (won't re-inject)

maestro_handoff_status()
--> Pending handoffs across all features
```

### Session Lifecycle

```
SESSION START:
  1. SessionStart hook fires
  2. Check .maestro/handoffs/latest.md for active feature
  3. If exists AND not acknowledged:
     --> Parse handoff, inject summary:
         "Continuing from previous session (Claude Code, 2h ago).
          Goal: continue implementing 04-verification-extract
          Progress: 4/7 tasks, 60% through task 04
          2 uncommitted files on branch feat/toolbox
          Load full handoff: maestro_handoff_read()"
  4. Agent acknowledges and continues

PRECOMPACT / SESSION END:
  1. Infer goal from current work state
  2. Score context by goal relevance
  3. Build handoff (budget: 3000 tokens)
  4. Write to .maestro/handoffs/latest.md
  5. If agent-mail: also send via network
```

### Workflow Integration

Per-stage auto-inferred goals:

```
DISCOVERY:  "continue exploring <area from recent memories>"
RESEARCH:   "continue researching <topic>, findings: <memory count> saved"
PLANNING:   "finish writing/reviewing the plan"
EXECUTION:  "continue implementing <active task>"
DONE:       "review and complete feature"
```

Playbook registration:

```typescript
registerTool('handoff', {
  workflow: {
    stage: ['*'],
    category: 'utility',
    contextHint: (state) => {
      if (state.hasUncommittedChanges)
        return 'Uncommitted changes. Consider handoff before ending.';
      return undefined;
    }
  }
});

registerTool('handoff_read', {
  workflow: {
    stage: ['*'],
    category: 'meta',
    contextHint: (state) => {
      if (state.hasLatestHandoff && !state.handoffAcknowledged)
        return 'Handoff from previous session available.';
      return undefined;
    }
  }
});
```

### Architecture (v2 location)

```
handoff/                              # LAYER 2a
  port.ts                             # HandoffPort interface
  usecases.ts                         # write, read, list, acknowledge
  builder.ts                          # buildHandoffDocument (gathers from all domains)
  scorer.ts                           # scoreByGoal (extends DCP scoring for goal relevance)
  draft.ts                            # generate reviewable draft prompt
  parser.ts                           # parseHandoffDocument (markdown + frontmatter)

toolbox/tools/built-in/
  fs-handoff/                         # Built-in filesystem adapter
    manifest.json
    adapter.ts

toolbox/tools/external/
  agent-mail/                         # Extended: filesystem + network
    manifest.json
    adapter.ts
```

### Edge Cases

#### Session & Lifecycle

| # | Edge case | Fix |
|---|---|---|
| 1 | Session ends abruptly (crash) | PreCompact writes proactively. Crash before PreCompact: filesystem state is recovery source. |
| 2 | Multiple sessions simultaneously | Timestamped files. `latest.md` = last-writer-wins. Session ID for disambiguation. Doctor warns. |
| 3 | Handoff is stale (3+ days old) | Timestamp in frontmatter. SessionStart warns: "Handoff from 3 days ago. Verify before continuing." > 7 days: "Consider starting fresh." |
| 4 | Handoff for completed feature | Done stage handoff = feature summary, not continuation. SessionStart: "Feature completed." |
| 5 | No active feature | Error: "No active feature. Create or specify --feature." |
| 6 | PreCompact fires multiple times | Each writes timestamped file. `latest.md` updates. History preserved. |
| 7 | Feature has 50+ handoffs | `list` paginates, newest first. Auto-archive > 30 days. `latest.md` always current. |
| 8 | Handoff during stage transition | Captures state at moment of writing. Stage derived from current state. |

#### Cross-Host & Network

| # | Edge case | Fix |
|---|---|---|
| 9 | Different host, incompatible task IDs | Handoff uses maestro task folders (filesystem), not host IDs. Cross-host compatible. |
| 10 | Uncommitted changes but branch changed | Handoff includes git branch + HEAD. SessionStart: "Handoff was on feat/toolbox, you're on main. Switch?" |
| 11 | Cross-machine without agent-mail | Not possible with filesystem alone. Options: git push/pull handoff files, install agent-mail, manual copy. |
| 12 | Different maestro versions | `maestroVersion` in frontmatter. Mismatch: "Handoff from 0.2.0, running 0.3.0." Best-effort parsing. |
| 13 | Agent-mail handoff from unknown agent | Sender identity included. Unknown: "Accept handoff from 'worker-7'?" Only process known features. |

#### Goal & Content

| # | Edge case | Fix |
|---|---|---|
| 14 | Goal is vague ("continue working") | Infer specific goal from state. If ambiguous: prompt with examples. |
| 15 | Goal references nonexistent task | Validate against feature state. Error with available task list. |
| 16 | Handoff document too large | Builder budget: 3000 tokens max. Score-based truncation. Full detail via linked files. |
| 17 | User edits draft significantly | Draft is starting point. User edits are final. Handoff stores approved version. |
| 18 | PreCompact infers wrong goal | Heuristic: last 3 tool calls, loaded skill, claimed task. Multiple signals, best guess. |
| 19 | References deleted memories | Context pointers are references. "Memory X no longer exists." Agent adapts. |
| 20 | Handoff written but disk full | File write error. Feature state in `.maestro/` still intact. |

#### Delegation & Parallel

| # | Edge case | Fix |
|---|---|---|
| 21 | Parallel workers, orchestrator needs consolidated view | Orchestrator reads execution memories via DCP, not handoffs. Handoffs are session-level. |
| 22 | Handoff to specific person | `message` field: human-readable briefing. Document is readable by humans by design. |
| 23 | Multiple handoffs in quick succession | Each timestamped. `latest.md` = most recent. History preserved. |
| 24 | Long session (100+ tool calls) | Builder scans recent actions (last 20 calls) + task/memory state. Budget enforced. |
| 25 | Handoff to a different TOOL (Claude Code to Cursor) | Same filesystem format works. Any AI agent that reads markdown can use the handoff. |

---

## Search System

### Problem

Current search is entirely dependent on `cass` (external CLI). No built-in fallback.
Not in any playbook stage. Two disconnected search systems exist:

| System | Searches | Source | Requires |
|---|---|---|---|
| Session Search (cass) | Past agent conversation transcripts | cass index of JSONL logs | cass CLI |
| Historical Context | Past maestro execution memories | `.maestro/` filesystem | nothing |

These don't talk to each other. Without cass, there's no search at all.

### Design: Built-in Search + External Search Tool

**Two layers:**
1. Built-in filesystem search (always available, searches maestro's own data)
2. External search tool (cass or user's future tool, adds session transcript search)

### Built-in Search (always available)

Maestro already has searchable data on disk:

```
.maestro/features/*/memories/*.md       # memories with tags, categories, content
.maestro/features/*/tasks/*/spec.md     # task specifications
.maestro/features/*/tasks/*/report.md   # completion reports
.maestro/features/*/plan.md             # plans
.maestro/features/*/handoffs/*.md       # handoff documents
.maestro/doctrine/*.json                # doctrine items
```

Built-in adapter searches this with keyword scoring:

```typescript
class FsSearchAdapter implements SearchPort {
  async search(query, opts): Promise<SearchResult[]> {
    const keywords = extractKeywords(query);
    const files = await collectSearchableFiles(opts?.scope, opts?.feature);

    const results = [];
    for (const file of files) {
      const content = await readText(file.path);
      const score = scoreKeywordOverlap(content, keywords);
      if (score > 0.1) {
        results.push({
          path: file.path,
          type: file.type,       // memory | plan | task-spec | doctrine | handoff
          feature: file.feature,
          matchSnippet: extractSnippet(content, keywords),
          score,
        });
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, opts?.limit ?? 20);
  }

  // Session search not available without external tool
  async searchSessions(): Promise<SessionSearchResult[]> { return []; }
}
```

### Extended SearchPort Interface

```typescript
interface SearchPort {
  // Search across all maestro data (memories, plans, tasks, doctrine, handoffs)
  search(query: string, opts?: {
    scope?: 'all' | 'memories' | 'plans' | 'tasks' | 'doctrine' | 'handoffs';
    feature?: string;
    limit?: number;
    days?: number;
  }): Promise<SearchResult[]>;

  // Search past agent sessions (requires external tool)
  searchSessions(query: string, opts?: {
    agent?: string;
    limit?: number;
    days?: number;
  }): Promise<SessionSearchResult[]>;

  // Find related content by file path
  findRelated(filePath: string, limit?: number): Promise<SearchResult[]>;

  // Find similar past features/plans (for historical context)
  searchSimilar?(content: string, limit?: number): Promise<SearchResult[]>;
}

interface SearchResult {
  path: string;
  type: 'memory' | 'plan' | 'task-spec' | 'task-report' | 'doctrine' | 'handoff' | 'session';
  feature?: string;
  matchSnippet: string;
  score: number;
}
```

### Toolbox Resolution

```
User's search tool installed (priority 200)  --> full search (sessions + maestro data)
cass installed (priority 100)                --> CassAdapter (sessions) + FsAdapter (maestro data)
nothing installed                            --> FsAdapter only (maestro data)
```

### MCP Tools (expanded)

```
maestro_search({ query, scope?, feature?, limit?, days? })
  --> Search everything (or scoped). Built-in always works.
  --> With external tool: includes session transcripts too.

maestro_search_sessions({ query, agent?, limit?, days? })
  --> Sessions only. Returns empty if no external tool.
  --> Hint: "Install cass or search tool for session search."

maestro_search_related({ filePath, limit? })
  --> Find all context related to a file.

maestro_search_similar({ content, limit? })       # NEW
  --> Find similar past features/plans (replaces queryHistoricalContext).
```

### Historical Context Integration

`queryHistoricalContext` currently scans execution memories manually. With the search system:

```
BEFORE:
  plan_write calls queryHistoricalContext()
  --> manually reads .maestro/ files
  --> scores with extractKeywords
  --> returns pitfalls

AFTER:
  plan_write calls searchPort.searchSimilar(planContent)
  --> if external tool: indexed, fast, ranked results
  --> if built-in: falls back to queryHistoricalContext logic
  --> returns pitfalls + related past work
```

### Workflow Integration

```typescript
registerTool('search', {
  workflow: {
    stage: ['research', 'planning', 'execution'],
    category: 'utility',
    contextHint: (state) => {
      if (state.stage === 'research')
        return 'Search past sessions and memories for relevant context.';
      if (state.stage === 'planning')
        return 'Search for similar past features to inform the plan.';
      return undefined;
    }
  }
});
```

### Architecture (v2 location)

```
search/                               # LAYER 2a
  port.ts                             # SearchPort (extended with search + searchSimilar)
  usecases.ts                         # search, searchSessions, findRelated, searchSimilar

toolbox/tools/built-in/
  fs-search/                          # Built-in filesystem search (always available)
    manifest.json                     # provides: "search", priority: 0
    adapter.ts                        # FsSearchAdapter

toolbox/tools/external/
  cass/                               # Existing cass adapter
    manifest.json                     # provides: "search", priority: 100
    adapter.ts                        # CassSearchAdapter (sessions only -- compose with FsSearch)
```

### Future: User's Search Tool (like cass but comprehensive)

**Status: planned future project**

A unified search tool that indexes ALL context, not just session transcripts.

#### What It Would Index

| Data source | cass | Future tool |
|---|---|---|
| Agent session transcripts (JSONL) | yes | yes |
| Maestro memories (tagged markdown) | no | yes |
| Execution memories (structured) | no | yes |
| Plans and task specs | no | yes |
| Handoff documents | no | yes |
| Doctrine items | no | yes |
| Git commit messages | no | yes |
| Code comments / TODOs | no | yes |

#### Architecture

```
Indexer:
  - Watches .maestro/ for changes (fswatch/inotify)
  - Watches agent session log directories
  - Parses markdown, YAML frontmatter, JSONL, JSON
  - Builds inverted index (SQLite FTS5 or Rust tantivy)
  - Incremental updates (not full rebuild)

Query engine:
  - Full-text search with BM25 ranking
  - Tag/category filtering (maestro-aware)
  - Time range filtering
  - Feature scoping
  - Agent filtering
  - Similarity search (find features like X)

CLI:
  your-search search <query> --json
  your-search related <file-path> --json
  your-search similar --plan <plan-path> --json
  your-search index --rebuild
  your-search status
```

#### Toolbox Manifest

```jsonc
{
  "name": "your-search",
  "description": "Unified search across sessions, memories, plans, and code",
  "transport": "cli",
  "cli": {
    "binary": "your-search",
    "detect": "your-search --version",
    "jsonFlag": "--json",
    "install": "cargo install your-search"
  },
  "provides": "search",
  "priority": 200,
  "adapter": "./adapter.ts"
}
```

#### Advantages Over cass

| Feature | cass | Future tool |
|---|---|---|
| Session transcripts | yes | yes |
| Maestro memories | no | yes (tag-aware, category-aware) |
| Execution memories | no | yes (structured, parsed) |
| Plans / task specs | no | yes |
| Handoff documents | no | yes |
| Doctrine items | no | yes |
| Git history | no | yes |
| Cross-feature search | limited | yes (scoped or global) |
| Tag-aware filtering | no | yes |
| Relevance scoring | basic TF-IDF | DCP-style (tags + keywords + recency + category) |
| Real-time indexing | batch | watch + incremental |
| Similarity search | no | yes (find similar past features) |

#### Query Examples

```
# Sessions where auth was discussed
your-search search "auth middleware" --scope sessions

# Memories about toolbox design
your-search search "AdapterContext" --scope memories --feature toolbox-refactor

# Past failures with verification
your-search search "verification failed" --scope execution-memories --days 90

# Everything related to a file
your-search related src/tasks/verification/usecase.ts

# Similar past features (for historical context)
your-search similar --plan .maestro/features/new-feature/plan.md
```

#### MCP Integration When Installed

```
maestro_search({ query, scope?, feature?, limit? })
  --> Searches EVERYTHING (sessions + memories + plans + doctrine + handoffs)
  --> Unified, ranked results from your tool

maestro_search_sessions({ query, agent?, limit? })
  --> Sessions only (backward compat with cass interface)

maestro_search_related({ filePath })
  --> All context related to a file

maestro_search_similar({ content })
  --> Find similar past features/plans
  --> Replaces queryHistoricalContext entirely
```

### Edge Cases

| # | Edge case | Fix |
|---|---|---|
| 1 | No search tool, user calls search_sessions | FsSearchAdapter returns empty. Hint: "Install cass or search tool for session search." |
| 2 | Both cass AND future tool installed | Priority: future tool (200) > cass (100). Future tool wins. Doctor shows override. |
| 3 | External tool's index is stale | `your-search index --rebuild`. Doctor: "Search index 2h behind." |
| 4 | Built-in fs-search slow on large project (1000+ files) | Cache on first search. Invalidate on memory write/delete. Future: SQLite FTS in `.maestro/.searchindex`. |
| 5 | Search returns results from deleted features | Filter by existing features. `--include-archived` for archived. |
| 6 | Cross-feature search leaks context | Feature-scoped by default. `--feature all` opts into cross-feature. |
| 7 | Session logs in different formats | Per-agent parsers. Detect agent from log path (same approach as cass). |
| 8 | Built-in + external overlap | External overrides for `searchSessions`. Built-in `search()` always available for maestro data. Or: external implements ALL methods, fully replacing. |
| 9 | Historical context slow without external tool | Falls back to `queryHistoricalContext` (current manual scan). External is acceleration, not requirement. |
| 10 | Private data in search index | Index is local. Not exposed over network. `.searchindex` gitignored. |

---

## Memory Consolidation System

### Problem

Memories are passive storage. Write once, read by DCP, never processed.
No duplicate detection, no connection discovery, no compression, no auto-promotion.
Stale memories persist forever. The Always-On Memory Agent (Google) uses a background
LLM for consolidation -- maestro does it algorithmically instead (zero LLM, zero cost).

### Design: Algorithmic Consolidation (no LLM)

Maestro already has all the building blocks:

```
Existing algorithms (reused for consolidation):
  extractKeywords()       keyword extraction (relevance.ts)
  scoreTagOverlap()       tag similarity (relevance.ts)
  scoreKeywordOverlap()   content similarity (relevance.ts)
  groupByTagCluster()     cluster by tags (parse-exec-memory.ts)
  suggestDoctrine()       detect patterns (suggest-doctrine.ts)
  inferMetadata()         auto-derive tags + category (memory-inference.ts)
```

Consolidation applies these SAME algorithms to memory management.

### The 6 Consolidation Actions

**1. Connect related memories (link A to B)**

```typescript
function findConnections(memories: MemoryFileWithMeta[]): Connection[] {
  // For each pair: compute keyword overlap (0.6 weight) + tag overlap (0.4 weight)
  // If combined score > 0.4: create connection
  // Relation inferred from categories:
  //   research --> decision = "informed"
  //   decision --> execution = "implemented-in"
  //   debug --> decision = "caused-change"
  //   same category, older --> newer = "informed"
  //   default = "related-to"
}
```

No LLM. Keyword extraction + tag overlap + category rules.

**2. Merge duplicates**

```typescript
function findDuplicates(memories: MemoryFileWithMeta[]): MergeCandidate[] {
  // Must be same category
  // Keyword overlap > 80% AND tag overlap > 70%
  // Keep: higher priority (or more content). Archive: the other.
  // Merged memory gets union of both tag sets.
  // Connection "merged-from" tracks provenance.
}
```

No LLM. High overlap threshold = safe merge. Original archived for undo.

**3. Compress old memories**

Without LLM: smart truncation, not summarization.

```typescript
function compressMemory(content: string): string {
  // Strategy: keep structure, drop detail
  // Keep: all headings, bullet points, bold text, first paragraph
  // Drop: prose paragraphs, code blocks, long explanations
  // Budget: max 200 tokens for compressed version
  // Original archived with compressed: true in frontmatter
}
```

No LLM. Keep headings + bullets + first paragraph. Original preserved for `--full` recovery.

**4. Auto-promote to global**

```typescript
function findPromotable(memories: MemoryFileWithMeta[]): string[] {
  // Criteria: priority 0-1 AND category decision/architecture AND selectionCount >= 3
  // Conservative: only truly high-value memories auto-promote
}
```

No LLM. Priority + category + DCP usage frequency. Data tells you what's important.

**5. Generate cross-cutting insights**

Same algorithm as `suggestDoctrine` extended to ALL memory types:

```typescript
function findPatterns(memories: MemoryFileWithMeta[]): InsightPattern[] {
  // Group by tag cluster (existing groupByTagCluster algorithm)
  // Clusters with 3+ memories = pattern
  // Detect interesting properties:
  //   High avg priority = "recurring high-priority topic"
  //   Mix of research + decision = "research-to-decision pipeline"
  //   2+ debug memories = "recurring issues in this area"
  //   All same category = "concentrated expertise"
}
```

No LLM. Cluster by tags + detect cluster properties. Structured patterns, not natural language.

**6. Update importance scores**

```typescript
// DCP calls recordSelection when it selects a memory
// Consolidation adjusts priorities:
//   Selected 5+ times but priority >= 2? --> promote (priority - 1)
//   Never selected + older than 30 days + priority < 4? --> demote (priority + 1)
```

No LLM. Selection frequency + age = importance signal.

### Consolidation Pipeline

```
maestro_memory_consolidate({ feature })
  |
  +--> 1. Load all memories with metadata
  |
  +--> 2. Find duplicates (keyword overlap > 80%, same category)
  |      --> Merge: union tags, keep better, archive duplicate
  |
  +--> 3. Find connections (keyword/tag overlap > 40%)
  |      --> Write connections to frontmatter
  |
  +--> 4. Find stale memories (>90 days, priority 3+, 0 selections)
  |      --> Compress: keep headings + bullets + first paragraph
  |      --> Archive original
  |
  +--> 5. Find patterns (3+ memories with same tag cluster)
  |      --> Generate insight descriptions
  |      --> Feed into doctrine suggestion pipeline
  |
  +--> 6. Auto-promote (priority 0-1, decision/architecture, 3+ selections)
  |      --> Copy to global memory
  |
  +--> 7. Adjust priorities based on DCP selection frequency
  |      --> Frequently selected: priority goes up
  |      --> Never selected + old: priority goes down
  |
  +--> 8. Return ConsolidationResult
         { merged: 3, connected: 12, compressed: 5, promoted: 2,
           patterns: 4, priorityAdjusted: 8 }
```

### When Consolidation Runs

```
Trigger 1: feature_complete
  --> Full consolidation of feature memories
  --> Merge duplicates, find patterns, auto-promote
  --> Generate cross-feature insights

Trigger 2: session end / handoff
  --> Light consolidation: connect new memories, update selection scores

Trigger 3: explicit command
  --> maestro_memory_consolidate({ feature, aggressive? })

Trigger 4: memory count threshold
  --> Feature has 30+ memories? Auto-suggest: "Run consolidation to clean up."
```

### Memory Connections (new frontmatter fields)

```yaml
---
tags: [architecture, toolbox]
category: decision
priority: 1
connections:
  - name: research-current-adapters
    relation: informed-by
  - name: exec-01-setup-types
    relation: implemented-in
selectionCount: 7
lastSelectedAt: 2026-03-20T10:00:00Z
compressed: false
originalTokens: 450
consolidatedAt: 2026-03-22T15:00:00Z
---
```

### Enhanced MemoryPort

```typescript
interface MemoryPort {
  // Existing (keep all)
  write, read, list, listWithMeta, delete, compile, archive, stats
  writeGlobal, readGlobal, listGlobal, deleteGlobal

  // NEW: Connections
  connect(feature: string, a: string, b: string, relation: string): void;
  getConnections(feature: string, name: string): MemoryConnection[];

  // NEW: Selection tracking (called by DCP)
  recordSelection(feature: string, name: string): void;
  getSelectionCount(feature: string, name: string): number;

  // NEW: Compression
  compress(feature: string, name: string): void;
  isCompressed(feature: string, name: string): boolean;
  readFull(feature: string, name: string): string | null;  // original pre-compression
}

interface MemoryConnection {
  target: string;
  relation: 'informed-by' | 'implemented-in' | 'related-to' | 'merged-from' | 'caused-change' | 'shaped';
}
```

### New MCP Tools

```
maestro_memory_consolidate({ feature?, aggressive? })
  --> Run consolidation pipeline. Returns ConsolidationResult.

maestro_memory_connect({ feature, a, b, relation })
  --> Manually connect two memories.

maestro_memory_connections({ feature, name })
  --> Show all connections for a memory.

maestro_memory_insights({ feature? })
  --> Show cross-cutting patterns from last consolidation.
```

### Memory Lifecycle (complete)

```
BIRTH:
  memory_write (manual) | writeExecutionMemory (auto) | handoff ingest (auto)
    |
    v
ACTIVE:
  DCP scores + selects for workers. Search returns in results.
  selectionCount incremented on each DCP selection.
  Connections discovered via consolidation.
    |
    v
CONSOLIDATION (periodic):
  Duplicates merged --> fewer, richer memories
  Related memories connected --> relationship graph
  Old low-value compressed --> summary replaces full content
  Patterns promoted to global --> cross-feature knowledge
  Insights generated --> feed into doctrine suggestion
  Priorities adjusted --> usage-based importance
    |
    v
PROMOTION:
  Auto: consolidation promotes priority 0-1 decisions with 3+ selections
  Manual: maestro_memory_promote
    |
    v
ARCHIVAL:
  Stale: >90 days + priority 3+ + zero selections --> compressed
  Feature complete: non-promoted memories stay feature-scoped
  Compressed originals archived for --full recovery
    |
    v
GLOBAL:
  Promoted memories available across all features
  Doctrine items (from patterns) available to all workers
  Cross-feature search finds them
```

### How Consolidation Feeds Other Systems

```
Consolidation output         Feeds into
-------------------         ----------
Merged memories             DCP (fewer, higher-quality candidates)
Connected memories          DCP proximity boost (connected score higher)
Cross-cutting insights      Doctrine suggestions (patterns become doctrines)
Auto-promoted memories      Global scope (all features can access)
Importance scores           DCP priority weighting (more accurate)
Compressed memories         Lower token cost in DCP budget
Selection tracking          Handoff (most-selected memories highlighted)
```

### Consolidation vs Doctrine

Complementary, not overlapping:

```
Consolidation:
  Scope: within feature (+ promotion to global)
  Input: ALL memories (decisions, research, architecture, etc.)
  Output: cleaner memory graph (merged, connected, compressed)
  When: feature_complete, session end, manual

Doctrine:
  Scope: across features
  Input: execution memories ONLY (task completion patterns)
  Output: prescriptive rules (do X, avoid Y)
  When: feature_complete (suggest), manual (approve)

Connection: consolidation finds patterns --> patterns feed into doctrine suggestions.
```

### Algorithm Complexity

```
n = number of memories

Steps 2+3 (duplicates + connections): O(n^2) pairwise comparison
  Optimization: pre-filter by category (only compare same category for merges)
  With 6 categories: ~n^2/6 merge comparisons
  50 memories: ~400 comparisons (<100ms)
  100 memories: ~1600 comparisons (<500ms)
  200 memories: ~6400 comparisons (<2s, trigger aggressive mode)

Steps 4-7 (stale, patterns, promote, priorities): O(n) single pass each

Total: O(n^2) dominated by pairwise. Fast for typical feature sizes.
```

### What You DON'T Get Without LLM (and why that's OK)

```
WITH LLM:
  "These 3 memories about authentication suggest the JWT validation
   approach was initially wrong and corrected after debugging."

WITHOUT LLM (maestro):
  "Pattern: 3 memories about [auth, jwt] -- research + debug + decision
   cluster. Debug memories suggest recurring issues."

The difference: LLM gives natural language insight. Algorithms give structured patterns.
For maestro (feeding DCP + doctrine), structured patterns are better.
The AGENT interprets patterns. Consolidation just finds them.
```

### Future: Optional LLM Enhancement

```jsonc
// .maestro/settings.json
{
  "memory": {
    "consolidation": {
      "mode": "algorithmic",        // default: no LLM, zero cost
      // "mode": "llm-enhanced",    // optional: cheap model for summaries
      // "llmModel": "haiku"        // small model for polish only
    }
  }
}
```

When `llm-enhanced`: LLM called ONLY for:
- Natural language summaries during compression (instead of heuristic truncation)
- Enriching pattern descriptions (instead of template strings)

Everything else stays algorithmic. LLM is a polish layer, not the engine.

### Edge Cases

| # | Edge case | Fix |
|---|---|---|
| 1 | Consolidation merges wrong memories | Threshold >80% keyword + same category. Undo: original archived, `merged-from` connection tracked. `maestro_memory_unmerge`. |
| 2 | Compression loses important detail | Original archived. `compressed: true` in frontmatter. `maestro_memory_read --full` returns original. |
| 3 | Auto-promotion promotes wrong memories | Conservative criteria: priority 0-1 + decision/architecture + 3+ selections. Undo: `maestro_memory_demote`. |
| 4 | Consolidation slow (100+ memories) | Pre-filter by category for merge candidates. Tag pre-filter for connections. 100 memories < 500ms. |
| 5 | Connection graph is circular (A-->B-->C-->A) | Allowed. Mutual influence is valid. Display as flat list, not tree. |
| 6 | Selection tracking changes DCP scoring | New dimension at 0.05 weight. Small boost, not dominant. Existing 5 dimensions unchanged. |
| 7 | Stale memory is actually important | Stale = 90 days + priority 3+ + zero selections. Priority 0-1 never auto-archived regardless of age. |
| 8 | Feature has 200 memories | Aggressive mode: lower merge to 60%, compress all >90 day, archive priority 4. 200 --> ~50 focused. |
| 9 | Cross-feature consolidation conflicts | Feature consolidation is isolated. Cross-feature only during promotion. Global has own pass. |
| 10 | Memory name changes on merge | Merged memory keeps higher-priority name. Old names become `merged-from` connections. DCP references updated. |
| 11 | Write during consolidation | Lock feature memory directory. New writes queue. Lock timeout 5s. Too long: skip, warn. |
| 12 | Handoff references compressed memory | Context pointers show `(compressed)`. Agent loads full with `--full` if needed. |

---

## DCP v2: Enhanced Dynamic Context Protocol

### Background

Maestro's DCP was inspired by [OpenCode DCP](https://github.com/Opencode-DCP/opencode-dynamic-context-pruning).
Combined with [Context Engineering](https://github.com/davidkimai/Context-Engineering) concepts,
DCP v2 adds: context component registry, protection rules, deduplication, soft thresholds,
per-component metrics, and session-level context management.

### Two DCP Layers

```
Layer 1: INJECTION DCP (existing, enhanced)
  Manages what workers START with (pre-agent hook)
  Scores memories, assembles context, budgets per component
  Operates at: agent spawn time

Layer 2: SESSION DCP (new)
  Manages the LIVE session context during execution
  Tracks growth, nudges compression, triggers handoff
  Operates at: during session (via hooks)
```

OpenCode DCP does Layer 2 (session management). Maestro DCP does Layer 1 (injection).
v2 enhances both.

### Context Component Registry

Every piece of injected context is an explicit component with priority, protection, and budget:

```typescript
interface ContextComponent {
  id: string;
  priority: number;              // lower = more important (pruned last)
  protected: boolean;            // never pruned
  budgetTokens: number;
  compressionStrategy: 'none' | 'truncate' | 'headings-only' | 'drop';
  content: string;
  metadata: {
    itemCount: number;
    droppedCount: number;
    avgRelevanceScore: number;
  };
}

const COMPONENT_REGISTRY = [
  { id: 'spec',          priority: 0, protected: true,  budget: Infinity, compression: 'none' },
  { id: 'worker-rules',  priority: 1, protected: true,  budget: 500,      compression: 'none' },
  { id: 'revision',      priority: 2, protected: true,  budget: 500,      compression: 'none' },
  { id: 'graph',         priority: 3, protected: false, budget: 300,      compression: 'truncate' },
  { id: 'completed',     priority: 4, protected: false, budget: 512,      compression: 'truncate' },
  { id: 'doctrine',      priority: 5, protected: false, budget: 256,      compression: 'headings-only' },
  { id: 'memories',      priority: 6, protected: false, budget: 1024,     compression: 'truncate' },
  { id: 'skill',         priority: 7, protected: false, budget: 500,      compression: 'headings-only' },
  { id: 'agent-tools',   priority: 8, protected: false, budget: 500,      compression: 'drop' },
  { id: 'handoff',       priority: 9, protected: false, budget: 300,      compression: 'truncate' },
];
```

Context as architecture: `C = aggregate(c1, c2, ..., cn)` with per-component budgets and priorities.

### Protection Rules

Protected content is NEVER pruned, even when over budget:

```
ALWAYS INCLUDED (protected):
  spec          -- task specification (what to build)
  worker-rules  -- behavioral rules (how to work)
  revision      -- what went wrong last time (critical for retry)

PRUNABLE (by priority, lowest priority dropped first):
  agent-tools   -- code intelligence guidance (drop first)
  skill         -- workflow guidance (compress to headings)
  memories      -- selected knowledge (truncate)
  doctrine      -- cross-feature rules (compress to headings)
  completed     -- done task summaries (truncate oldest)
  graph         -- dependency context (truncate)
```

### Priority-Based Pruning

When total exceeds master budget, prune from lowest priority upward:

```typescript
function pruneToFit(components: ContextComponent[], masterBudget: number): ContextComponent[] {
  let totalTokens = components.reduce((sum, c) => sum + estimateTokens(c.content), 0);
  if (totalTokens <= masterBudget) return components;

  // Sort by priority descending (prune lowest priority first)
  const sorted = [...components].sort((a, b) => b.priority - a.priority);

  for (const component of sorted) {
    if (component.protected) continue;
    if (totalTokens <= masterBudget) break;

    const currentTokens = estimateTokens(component.content);
    switch (component.compressionStrategy) {
      case 'drop':
        totalTokens -= currentTokens;
        component.content = '';
        break;
      case 'headings-only':
        const headings = keepHeadingsOnly(component.content);
        totalTokens -= (currentTokens - estimateTokens(headings));
        component.content = headings;
        break;
      case 'truncate':
        const half = truncateToTokens(component.content, component.budgetTokens / 2);
        totalTokens -= (currentTokens - estimateTokens(half));
        component.content = half;
        break;
    }
  }
  return components;
}
```

### Deduplication Across Sequential Tasks

If memory "design-decision-X" was injected for task 03 AND task 04 selects it again:
replace with a reference instead of re-injecting full content.

```typescript
interface DcpSessionState {
  previousInjections: Map<string, Map<string, string>>;  // task -> (memoryName -> contentHash)
}

function deduplicateMemories(
  selected: SelectedMemory[],
  previousTask: string | null,
  sessionState: DcpSessionState
): SelectedMemory[] {
  if (!previousTask) return selected;

  const previousMemories = sessionState.previousInjections.get(previousTask);
  if (!previousMemories) return selected;

  return selected.map(m => {
    const previousHash = previousMemories.get(m.name);
    if (previousHash && hash(m.bodyContent) === previousHash) {
      // Same content, already in previous context -- dedup
      return { ...m, content: `[Already in upstream context from ${previousTask}]`, deduplicated: true };
    }
    // Content changed since previous injection -- re-inject full
    return m;
  });
}
```

Dedup window: only against the PREVIOUS task (not all historical). After 2 tasks, memory is re-injected fresh.

### Soft Thresholds with Nudges

Instead of only hard budget cuts, warn when approaching limits:

```
Memory utilization:
  < 80%:   normal (no action)
  80-95%:  WARNING -- "memory budget at 90%, consider archiving old memories"
  > 95%:   CRITICAL -- "memory budget full, dropping low-relevance items"

Overall context:
  < 80%:   normal
  80-95%:  suggest consolidation or handoff
  > 95%:   aggressive pruning kicks in
```

### DCP Metrics (comprehensive)

```typescript
interface DcpMetrics {
  components: Array<{
    id: string;
    budgetTokens: number;
    usedTokens: number;
    utilization: number;
    itemsIncluded: number;
    itemsDropped: number;
    avgRelevanceScore: number;
    compressionApplied: boolean;
    deduplicatedCount: number;
    deduplicatedTokensSaved: number;
  }>;

  // Overall
  totalBudget: number;
  totalUsed: number;
  totalUtilization: number;
  totalDropped: number;
  deduplicatedTokensSaved: number;
  compressionTokensSaved: number;

  // Historical (across tasks in feature)
  avgUtilizationThisFeature: number;
  peakUtilization: number;
  budgetRecommendation?: string;
}
```

### Session DCP (Layer 2)

Maestro can't directly prune Claude Code's conversation context. But it can:

**1. Track and advise** -- monitor session length, advise compression

**2. Trigger handoff** -- instead of lossy compression, trigger goal-oriented handoff

**3. Optimize PreCompact** -- when context is about to compress, write better snapshot

**4. Protect maestro outputs** -- tell hooks which tool outputs to preserve

```
SessionStart hook:
  --> Initialize DCP session state
  --> Track injection history for deduplication

PreToolUse:Agent hook:
  --> Run full injection DCP (Layer 1, enhanced)
  --> Record what was injected for dedup

PostToolUse hook:
  --> Track context growth (estimate from tool calls)
  --> If approaching threshold: inject nudge
  --> "Session context at 82%. Consider handoff or compress."

PreCompact hook:
  --> If handoffOnContextFull: write goal-oriented handoff
  --> Context engineering: the handoff IS the pruned context
```

### Enhanced DCP Settings

```jsonc
{
  "dcp": {
    "enabled": true,

    // Master budget
    "masterBudgetTokens": 4096,

    // Per-component budgets
    "memoryBudgetTokens": 1024,
    "completedTaskBudgetTokens": 512,
    "doctrineBudgetTokens": 256,
    "skillBudgetTokens": 500,
    "agentToolsBudgetTokens": 500,
    "handoffBudgetTokens": 300,

    // Scoring
    "relevanceThreshold": 0.1,
    "observationMasking": true,

    // Protection
    "protectedComponents": ["spec", "worker-rules", "revision"],

    // Deduplication
    "deduplicateAcrossTasks": true,
    "deduplicationWindow": 1,

    // Soft thresholds
    "warningUtilization": 0.8,
    "criticalUtilization": 0.95,

    // Session DCP
    "sessionNudgeEnabled": true,
    "sessionNudgeAt": 0.8,
    "sessionNudgeFrequency": 5,
    "handoffOnContextFull": true
  }
}
```

### MCP Tools (enhanced)

```
maestro_dcp_preview({ feature?, task? })
  ENHANCED:
  --> Per-component breakdown with utilization %
  --> Deduplication savings shown
  --> Compression applied shown
  --> Budget recommendations
  --> "Memory: 920/1024 tokens (90%), 5 included, 2 dropped, avg score 0.65"

maestro_dcp_stats({ feature? })
  NEW:
  --> Historical DCP usage across all tasks in feature
  --> Avg utilization per component, peak, trends
  --> Recommendations: "Memory budget at 15% avg, consider reducing to 256"

maestro_dcp_config({ component?, budget?, protected? })
  NEW:
  --> Adjust DCP settings per component on the fly
  --> "Set memory budget to 2048 for this feature" (doesn't change global settings)
```

### Architecture (v2 location)

```
dcp/                                  # LAYER 2b
  config.ts                           # resolveDcpConfig (enhanced)
  pruner.ts                           # pruneContext orchestrator
  selector.ts                         # selectMemories (scoring + budget-fill)
  relevance.ts                        # scoreRelevance (5 dimensions + proximity)
  budget.ts                           # fitWithinBudget
  historical.ts                       # queryHistoricalContext

  # NEW files:
  components.ts                       # Context component registry + priority ordering
  dedup.ts                            # Deduplication across sequential tasks
  metrics.ts                          # DCP metrics tracking + recommendations
  session.ts                          # Session-level DCP state + nudges
  protection.ts                       # Protection rules + validation
```

### How DCP v2 Connects to Other Systems

```
DCP v2 output                    Feeds into
-----------                      ----------
Per-component metrics            execution_insights (are workers context-starved?)
Budget recommendations           doctor (suggest config changes)
Deduplication stats              dcp_stats (how much saved)
Session nudges                   PostToolUse hook (advise compression/handoff)
handoffOnContextFull             handoff system (goal-oriented handoff)
Protection rules                 PreCompact hook (preserve critical context)
Selection tracking               memory consolidation (importance scores)
```

### Edge Cases

| # | Edge case | Fix |
|---|---|---|
| 1 | Master budget too small for protected content | Protected always included. Warn: "Protected alone is 3000 tokens, master budget 2048." |
| 2 | Dedup misses updated memory (content changed) | Track content hash, not just name. Changed hash = re-inject full. |
| 3 | All components at 0% utilization | Normal for early stages. Minimal injection (spec + rules). No warning. |
| 4 | Component budget set to 0 | Allowed. Component skipped. Doctor notes: "Memory injection disabled." |
| 5 | Compression removes critical context | Best-effort. Full content in source files. DCP provides orientation, not full knowledge. |
| 6 | Dedup references pile up across 10 tasks | Only dedup against PREVIOUS task (window=1). After 2 tasks, re-inject fresh. |
| 7 | Session nudge is annoying | `sessionNudgeFrequency` configurable (default 5 messages). `sessionNudgeEnabled: false` to disable. |
| 8 | handoffOnContextFull triggers mid-worker-task | Only for orchestrator sessions. Workers complete their task with whatever context they have. |
| 9 | DCP stats show consistently low utilization | Recommendations: "Memory at 15% avg. Consider reducing from 1024 to 256." Don't auto-adjust. |
| 10 | Protected list changes between tasks | Config read per-injection. Changes apply to next task, not retroactively. |

---

## `maestro_status` -- Universal Entry Point

### Design Principle

`maestro_status` is ALWAYS full. Every call. No delta detection, no first-call vs subsequent-call
magic, no session state tracking. Simple and predictable.

```
maestro_status = ALWAYS returns the complete playbook + context
The response tells the agent what to do NEXT with exact command hints
```

**Why no delta:** 500 tokens per call is the cost of orientation. The simplicity of "always full"
outweighs the complexity of delta detection, hash tracking, and session state.
Other tools use compact + delta to compensate.

### Three Universal Entry Points

```
Claude Code (hooks):     SessionStart auto-injects --> maestro_status for refresh
Codex/Cursor (no hooks): maestro_status is the FIRST call every session
Standalone CLI:          maestro status in terminal
```

All three run the same `checkStatus()` under the hood. Same response format.

### Response Format (~500 tokens, always full)

```
## maestro: toolbox-refactor (feature, execution)

Progress: 4/7 tasks (57%)
  [ok] 01-setup  [ok] 02-registry  [ok] 03-sdk  [ok] 04-verify
  [>>] 05-error-envelope (claimed by worker-1)
  [--] 06-workflow  [--] 07-skill

--> Next: maestro_task_done({ task: "05-error-envelope", summary: "..." })

Also available:
  maestro_task_info({ task: "05-error-envelope" })
  maestro_task_list()
  maestro_visual({ type: "status-dashboard" })

Skill: maestro:implement (TDD workflow)
Handoff: none pending
Agent tools: tilth rg git | sg missing
```

The `-->  Next:` line is the key. Exact tool call with pre-filled args where possible.

### "Next" Hints by State

| State | Next hint |
|---|---|
| No feature | `maestro_feature_create({ name: "...", type: "feature" })` |
| Discovery, no memories | Explore codebase, then `maestro_memory_write({ ... })` |
| Research, has memories | `maestro_plan_write({ content: "..." })` |
| Plan written, not approved | `maestro_plan_approve({ feature: "..." })` |
| Plan approved, no tasks | `maestro_tasks_sync({ feature: "..." })` |
| Tasks exist, runnable | `maestro_task_claim({ task: "01-setup", agent_id: "..." })` |
| Task claimed, working | Continue implementation, then `maestro_task_done({ ... })` |
| Task in review | `maestro_task_accept({ task: "..." })` or `maestro_task_reject({ ... })` |
| Task in revision | `maestro_task_claim({ task: "..." })` (retry) |
| Task blocked | `maestro_task_unblock({ task: "...", decision: "..." })` |
| All tasks done | `maestro_feature_complete({ feature: "..." })` |
| Feature complete | `maestro_doctrine_suggest()` then `maestro_memory_promote()` |

### Section Flags (optional, for targeted queries)

```
maestro_status                         # full (always, ~500 tokens)
maestro_status --tasks                 # just task progress (~150 tokens)
maestro_status --playbook              # just tools + skill + recommendation (~200 tokens)
maestro_status --dcp                   # just DCP metrics (~150 tokens)
maestro_status --handoff               # just handoff info (~200 tokens)
maestro_status --tools                 # just available tools + agent tools (~200 tokens)
maestro_status --feature <name>        # status of a different feature
```

Default (no flags) is always full. Flags are for when agent ONLY needs one piece.

### Anti-Pollution Split

```
maestro_status:       ALWAYS full (~500 tokens). Worth it -- it's the playbook.
Every OTHER tool:     compact by default, delta when nothing changed.

Status pays 500 tokens to orient the agent.
All other tools save tokens to compensate.
```

### Non-Status Tools: Compact + Delta

For all tools EXCEPT status, apply anti-pollution:

```
Response modes (every non-status tool):
  compact (default):   minimal response, key info only
  full:                complete response (agent passes mode: 'full')

Delta detection (every non-status tool):
  Same hash as last call? --> "unchanged since 30s ago" (~10 tokens)
  Different hash? --> return compact response

Per-tool budgets:
  task_list:    300 tokens
  task_info:    200 tokens
  memory_list:  300 tokens
  memory_read:  500 tokens
  task_brief:   2000 tokens
  skill:        3000 tokens
  default:      500 tokens
```

Delta detection uses in-memory hash cache in the MCP server process. Resets on server restart
(which means full response -- harmless).

```typescript
// Simple delta for non-status tools
const deltaCache = new Map<string, { hash: string; ts: number }>();

function respondWithDelta(toolName: string, data: unknown, budget: number) {
  const currentHash = quickHash(data);
  const cached = deltaCache.get(toolName);

  if (cached && cached.hash === currentHash && Date.now() - cached.ts < 30_000) {
    return { ok: true, data: { unchanged: true, since: timeSince(cached.ts) } };
  }

  deltaCache.set(toolName, { hash: currentHash, ts: Date.now() });
  return respondCompact(toolName, data, budget);
}
```

### Non-Status Tool Response Examples

```
maestro_task_list (compact, ~150 tokens):
  "7 tasks: [ok]01-setup [ok]02-registry [ok]03-sdk [ok]04-verify [>>]05-error [--]06-workflow [--]07-skill"

maestro_task_list (delta, unchanged, ~10 tokens):
  "unchanged (30s ago)"

maestro_memory_list (compact, ~200 tokens):
  "12 memories: 4 decision, 3 research, 3 execution, 2 architecture | top: design-adapter-ctx(p0)"

maestro_task_info (compact, ~100 tokens):
  "05-error | claimed worker-1 | deps: [ok]04-verify | spec: 45 lines | AC: 3 items"
```

### Nudge for Agents That Skip Status

If the first tool call is NOT `maestro_status`:

```typescript
let statusCalled = false;  // in-memory, resets on server restart

function withStatusNudge(handler) {
  return async (input) => {
    const result = await handler(input);
    if (!statusCalled) {
      statusCalled = true;  // only nudge once
      return { ...result, _hint: "Run maestro_status for full workflow context." };
    }
    return result;
  };
}
```

One-time hint on the first non-status call. Not nagging.

### Settings

```jsonc
{
  "status": {
    "includeHandoff": true,           // include handoff summary
    "includeAgentTools": true,        // include agent tool status
    "includeDcp": false,              // include DCP metrics (verbose, off by default)
    "nudgeOnFirstCall": true          // hint if status isn't called first
  },
  "responses": {
    "defaultMode": "compact",         // compact | full (for non-status tools)
    "enableDelta": true,              // delta responses for non-status tools
    "deltaTtlSeconds": 30,
    "budgets": {
      "default": 500,
      "status": null,                 // no budget -- always full
      "task_list": 300,
      "task_info": 200,
      "memory_list": 300,
      "task_brief": 2000,
      "skill": 3000,
      "plan_read": 1000
    }
  }
}
```

### Edge Cases

| # | Edge case | Fix |
|---|---|---|
| 1 | Status called 10 times (polling) | Always ~500 tokens. 10 calls = 5000 tokens. Acceptable. Use `--tasks` (~150 tokens) for quick checks. |
| 2 | Nothing changed between status calls | Still returns full. 500 tokens is the cost of simplicity. No detection complexity. |
| 3 | Agent doesn't follow "Next" hint | Hints are advisory. All tools work regardless. |
| 4 | "Next" hint has pre-filled args that are wrong | Best-guess from current state. Agent adjusts. Concrete suggestion > vague guidance. |
| 5 | No hooks, agent doesn't call status | One-time nudge on first non-status tool call. After that, tools work normally. |
| 6 | Agent calls `--tasks` flag | Returns just tasks (~150 tokens). Full status available without flag. |
| 7 | Status response for project with 100 tasks | Task list truncated: "100 tasks (showing 10 most relevant). Full: maestro_task_list()." |
| 8 | Status called before maestro init | "Project not initialized. Run maestro_init." No crash, clear instruction. |
| 9 | Codex agent doesn't understand compact text format | Instruction in codex config: "Call maestro_status. Follow the line starting with -->." |
| 10 | Status with `--json` flag | Returns structured JSON instead of compact text. For scripting and programmatic use. |

---

## Tool Surface: MCP + CLI Unified Design

### Design Principle

MCP and CLI share the same domain+action pattern. MCP is the optimized agent surface (21 tools).
CLI is the full human surface (52+ subcommands). Both call the same usecases.

```
MCP:  maestro_task({ action: 'claim', task: '05-error', agent_id: 'worker-1' })
CLI:  maestro task claim 05-error --agent worker-1
      ^domain ^action ^args        ^flags
```

### Reduction: 57 --> 21 MCP Tools (63% reduction)

Merged by domain with read/write split for correct annotations:

```
Domain          MCP (mutating)                      MCP (read-only)                    Reduction
------          --------------                      ---------------                    ---------
Feature         maestro_feature({ action })         maestro_feature_read({ what })     5 --> 2
Plan            maestro_plan({ action })            maestro_plan_read()                6 --> 2
Task            maestro_task({ action })            maestro_task_read({ what })        13 --> 2
Memory          maestro_memory({ action })          maestro_memory_read({ what })      7 --> 2
Doctrine        maestro_doctrine({ action })        maestro_doctrine_read({ what })    6 --> 2
Handoff         maestro_handoff({ action })         maestro_handoff_read()             3 --> 2
Skill           --                                  maestro_skill({ action })          2 --> 1
Graph           --                                  maestro_graph({ action })          3 --> 1
Search          --                                  maestro_search({ action })         2 --> 1
Visual          --                                  maestro_visual({ type })           2 --> 1
Meta            maestro_init()                      maestro_status()                   4 --> 2
Stage           maestro_stage({ action })           --                                 new
Consolidate     maestro_consolidate({ feature })    --                                 new
DCP             --                                  maestro_dcp({ action })            1 --> 1
                                                                                       --------
                                                                                       57 --> 21
```

### MCP Tool Annotations

```
MUTATING (10 tools -- Claude Code asks confirmation):
  maestro_init, maestro_feature, maestro_plan, maestro_task,
  maestro_memory, maestro_doctrine, maestro_handoff,
  maestro_stage, maestro_consolidate

READ-ONLY (11 tools -- Claude Code auto-approves):
  maestro_status, maestro_feature_read, maestro_plan_read, maestro_task_read,
  maestro_memory_read, maestro_doctrine_read, maestro_handoff_read,
  maestro_skill, maestro_graph, maestro_search, maestro_visual, maestro_dcp
```

### MCP Actions per Tool

```
maestro_status()                                   # no actions -- always full
maestro_init()                                     # no actions -- one-time setup

maestro_feature({ action })                        # create, complete, active
maestro_feature_read({ what })                     # list, info

maestro_plan({ action })                           # write, approve, revoke
maestro_plan_read()                                # read plan content

maestro_task({ action })                           # sync, claim, done, accept, reject, block, unblock
maestro_task_read({ what })                        # list, info, spec, report, next, brief

maestro_memory({ action })                         # write, delete, promote
maestro_memory_read({ what })                      # read, list

maestro_doctrine({ action })                       # write, approve, suggest
maestro_doctrine_read({ what })                    # list, read

maestro_skill({ action })                          # load, list

maestro_handoff({ action })                        # send, ack
maestro_handoff_read()                             # read latest, list history

maestro_graph({ action })                          # insights, next, plan (conditional: bv)
maestro_search({ action })                         # sessions, related (conditional: cass/search tool)
maestro_visual({ type })                           # all visual types
maestro_stage({ action })                          # next, skip, back, jump
maestro_consolidate({ feature })                   # memory consolidation
maestro_dcp({ action })                            # preview, stats
```

### CLI: Full Surface (52+ subcommands)

CLI keeps ALL capabilities as nested subcommands:

```
# Meta
maestro status [--tasks|--playbook|--dcp|--handoff|--tools] [--feature <name>]
maestro init

# Feature
maestro feature create <name> --type <type>
maestro feature list
maestro feature complete
maestro feature info [name]
maestro feature active [name]

# Plan
maestro plan write --content '...' (or --file plan.md)
maestro plan read
maestro plan approve
maestro plan revoke
maestro plan comment "..."
maestro plan comments-clear

# Task
maestro task sync
maestro task claim <task> --agent <id>
maestro task done <task> --summary '...'
maestro task accept <task>
maestro task reject <task> --feedback '...'
maestro task block <task> --reason '...'
maestro task unblock <task> --decision '...'
maestro task list
maestro task info <task>
maestro task spec <task>
maestro task report <task>
maestro task next
maestro task brief <task>
maestro task spec-write <task> --content '...'
maestro task report-write <task> --content '...'

# Memory
maestro memory write <name> --content '...'
maestro memory read <name>
maestro memory list
maestro memory delete <name>
maestro memory promote <name>
maestro memory stats
maestro memory compile
maestro memory archive
maestro memory consolidate [--feature <name>] [--aggressive]

# Doctrine
maestro doctrine write <name> --rule '...' --rationale '...'
maestro doctrine read <name>
maestro doctrine list
maestro doctrine approve <name>
maestro doctrine suggest
maestro doctrine deprecate <name>

# Skill
maestro skill load <name> [--reference <path>]
maestro skill list [--stage <stage>]
maestro skill create <name> [--stage <stage>]
maestro skill install <source> [--global]
maestro skill remove <name>
maestro skill sync

# Handoff
maestro handoff send --goal '...' [--target <agent>]
maestro handoff read
maestro handoff list [--limit <n>]
maestro handoff ack

# Graph (conditional)
maestro graph insights
maestro graph next
maestro graph plan [--agents <n>]

# Search (conditional)
maestro search sessions <query> [--agent <a>] [--limit <n>] [--days <d>]
maestro search related <path> [--limit <n>]

# Visual
maestro visual <type> [--feature <name>]

# Stage
maestro stage next
maestro stage skip
maestro stage back
maestro stage jump <target>

# DCP
maestro dcp preview [--task <task>]
maestro dcp stats [--feature <name>]
maestro dcp config <key> <value>

# Config
maestro config get <key>
maestro config set <key> <value> [--global]
maestro config agent

# Toolbox
maestro toolbox list
maestro toolbox create <name> --transport <type> [--provides <port>] [--agent-tool]
maestro toolbox add <name> --transport <type>
maestro toolbox install <source> [--global]
maestro toolbox dev <name>
maestro toolbox test <name>
maestro toolbox remove <name>
maestro toolbox publish <name>

# Diagnostics (CLI-only)
maestro doctor
maestro ping
maestro history
maestro execution-insights
maestro agents-md

# Maintenance (CLI-only)
maestro install
maestro self-update
maestro update
```

### Anti-Pollution: MCP vs CLI

```
MCP responses:
  Status:    always full (~500 tokens) -- the playbook
  All other: compact by default + delta when unchanged
  Per-tool budgets enforced
  Formatted for agent consumption

CLI output:
  Always verbose, pretty, full detail
  Tables, colors, progress bars
  No budget, no delta, no compact mode
  Formatted for human consumption (--json for scripting)
```

### Response Formatting Layer

```
Usecase returns raw data
        |
   +----+----+
   |         |
MCP format  CLI format
   |         |
compact     verbose
budgeted    unlimited
delta-aware full always
```

```
mcp/
  formatters/
    status.fmt.ts       # compact status text
    tasks.fmt.ts        # compact task list/info
    memory.fmt.ts       # compact memory list/read
    plan.fmt.ts         # compact plan summary
    ...

cli/
  (inline formatting in handlers -- verbose, tables, colors)
```

### Migration from Old to New

```
Old flat commands:        maestro task-claim, maestro task-done, maestro memory-write
New nested subcommands:   maestro task claim, maestro task done, maestro memory write

Old MCP tools:            maestro_task_claim, maestro_task_done, maestro_memory_write
New merged MCP:           maestro_task({ action: 'claim' }), maestro_memory({ action: 'write' })

Backward compat:
  CLI: old kebab-case names registered as aliases --> deprecation warning --> remove in v3
  MCP: old tool names registered as aliases --> delegate to merged tool --> remove in v3
```

### Edge Cases

| # | Edge case | Fix |
|---|---|---|
| 1 | Old CLI `maestro task-claim` still used | Alias: `task-claim` redirects to `task claim`. Deprecation warning. |
| 2 | Old MCP `maestro_task_claim` still used | Alias registered, delegates to `maestro_task({ action: 'claim' })`. Deprecation. |
| 3 | `maestro task` with no subcommand | Help: "Available: sync, claim, done, accept, reject, block, unblock, list, info, spec, report, next, brief." |
| 4 | Agent passes invalid action | Error: "Unknown action 'foo'. Available: claim, done, accept, ...". |
| 5 | Read tool called with write intent | Error: "Use maestro_task({ action: 'done' }) for state changes." |
| 6 | Merged tool description too long | Short description + action enum: "Task state changes. Actions: sync, claim, done, accept, reject, block, unblock." |
| 7 | Claude Code asks confirmation for read tools | Read tools annotated READONLY. Claude Code auto-approves. Only MUTATING asks. |
| 8 | Scripts using old CLI names | Aliases preserve compat. Scripts keep working. |
| 9 | Tab completion for nested subcommands | citty supports nested subcommands. Auto-complete works. |
| 10 | CLI-only command called via MCP | Error: "maestro_doctor is CLI-only. Use maestro_status for health info." |

---

## Parallel Execution: Inform, Don't Orchestrate

### Design Principle

Maestro is the filing cabinet with opinions. The agent (Claude Code, Codex) is the orchestrator.
Maestro INFORMS the agent about what can run in parallel and where conflicts exist.
The AGENT decides when and how to parallelize.

```
WRONG: maestro_parallel() complex engine spawns workers, manages lifecycle
RIGHT: maestro tells agent "3 tasks runnable, 02+03 safe, 05 conflicts with 02"
       Agent decides: "I'll spawn 2 workers for 02+03, do 05 after"
```

### What Maestro Provides

```
[info] Which tasks are runnable (existing: computeRunnableAndBlocked)
[info] Which tasks have file overlap (NEW: conflict prediction)
[info] Suggested approach (NEW: parallel vs sequential recommendation)
[tool] task claim/done/accept/reject (existing: state management)
[tool] discovery sharing (NEW: cross-worker context)
[tool] file reservation (NEW: optional conflict prevention)
[skill] maestro:dispatching (existing: orchestration guidance)
[hook] pre-agent DCP injection (existing: automatic worker context)
```

### Enhanced `task_read({ what: 'next' })` Response

When 2+ tasks are runnable, response includes parallel analysis:

```
maestro_task_read({ what: 'next' })

{
  runnable: ['02-registry', '03-sdk', '05-error'],
  blocked: { '06-workflow': ['05-error'], '07-skill': ['05-error'] },

  parallelAnalysis: {
    safe: ['02-registry', '03-sdk'],
    conflicts: [
      { tasks: ['02-registry', '05-error'], files: ['core/types.ts'] }
    ],
    suggestion: "Parallel: 02-registry + 03-sdk (no conflict). Then: 05-error (shares core/types.ts with 02)."
  },

  specs: {
    '02-registry': { summary: 'Implement toolbox registry...', estimatedFiles: 3 },
    '03-sdk':      { summary: 'Build transport SDK...', estimatedFiles: 5 },
    '05-error':    { summary: 'Unified error envelope...', estimatedFiles: 2 },
  }
}
```

### File Overlap Prediction

Predict which files each task will touch BEFORE running it:

```typescript
function predictFileOverlap(runnable, plan, specs): FileOverlapMap {
  // Extract file paths mentioned in each task's spec and plan section
  // Regex: common path patterns (src/..., lib/..., etc.)
  // Compare across runnable tasks
  // Return: which task pairs share files
}
```

Prediction is best-effort (based on specs mentioning file paths). Not guaranteed -- merge-time
detection is the safety net.

### The Orchestrator Loop (agent's reasoning, not maestro code)

```
1. Call maestro_task_read({ what: 'next' })
   --> Learn: 3 runnable, 02+03 safe, 05 conflicts with 02

2. Decide: spawn 2 workers for 02+03 in parallel

3. Claim both tasks:
   maestro_task({ action: 'claim', task: '02-registry', agent_id: 'worker-02' })
   maestro_task({ action: 'claim', task: '03-sdk', agent_id: 'worker-03' })

4. Spawn workers (Claude Code Agent tool):
   Agent({ prompt: "Implement 02-registry...", isolation: "worktree" })
   Agent({ prompt: "Implement 03-sdk...", isolation: "worktree" })

5. Workers execute:
   - Pre-agent hook auto-injects DCP context per worker
   - Workers call maestro_task({ action: 'done' }) when finished
   - Verification runs automatically on task_done

6. Check results:
   maestro_task_read({ what: 'list' })
   --> 02 done (score 0.90), 03 done (score 0.85)

7. Merge worktrees (dependency order):
   Merge 02 first (upstream), then 03
   Build after each merge to verify

8. Next iteration:
   maestro_task_read({ what: 'next' })
   --> 05-error now runnable (02 is done, conflict resolved)
   --> Continue sequential or check for more parallel opportunities
```

### `maestro:dispatching` Skill (guidance for the orchestrator)

The skill tells the agent HOW to orchestrate. Not code -- guidance:

```markdown
## When to Parallelize
- 2+ runnable tasks with no file overlap: spawn parallel agents
- Tasks with file overlap: run sequentially
- When in doubt: sequential is safer
- Don't spawn more than 3 agents (context + cost)

## How to Spawn
1. Claim all parallel tasks first (prevents race)
2. Spawn each with Agent({ isolation: "worktree" })
3. Workers get DCP context via pre-agent hook automatically

## How to Monitor
- Workers call task_done when finished
- Check task_read({ what: 'list' }) for updated statuses
- If blocked: read the blocker, decide, unblock

## How to Merge
- Merge in dependency order (upstream first)
- Run build after each merge to verify
- If conflict: task goes to revision, retry

## Discovery Sharing
- Workers share: maestro_discovery({ action: 'share', message: '...' })
- Check discoveries: maestro_discovery({ action: 'check' })
- Relay important findings to other workers if needed
```

### New Tools (minimal)

Only 2 new simple tools. No complex orchestration engine.

```
maestro_discovery({ action: 'share' | 'check', message? })
  Share: writes discovery to .maestro/features/<f>/discoveries/<worker>.md
  Check: reads all discoveries from other workers
  Simple filesystem read/write.

maestro_reserve({ action: 'lock' | 'release' | 'check', file, worker? })
  Lock: writes .maestro/reservations/<file-hash>.lock
  Release: deletes lock file
  Check: lists current reservations
  Optional -- extra safety layer for conflict prevention.
```

Enhanced existing tool:

```
maestro_task_read({ what: 'next' })
  ENHANCED: includes parallelAnalysis when 2+ tasks runnable
  (safe list, conflict list, file overlaps, suggestion text)
```

### Status Shows Parallel State

```
maestro_status during parallel execution:

## maestro: toolbox-refactor (execution, 2/7 done)

Workers:
  [>>] 02-registry   worker-02   running (8m)
  [>>] 03-sdk        worker-03   running (12m)

Pending:
  [--] 05-error      blocked (shares core/types.ts with 02, wait for merge)
  [--] 06-workflow    blocked by 05
  [--] 07-skill       blocked by 05

Discoveries:
  worker-02: "registry needs to export ToolManifest for loader"

--> Wait for workers to complete, then merge + claim 05-error
```

### Settings

```jsonc
{
  "parallel": {
    "maxAgents": 3,                     // guidance for orchestrator (not enforced)
    "conflictDetection": true,          // include file overlap in task_next
    "discoverySharing": true,           // enable discovery files
    "fileReservation": false            // optional file locking
  }
}
```

### Architecture (v2 location)

Minimal additions -- no separate parallel/ module needed:

```
tasks/
  graph/
    dependency.ts          # existing: computeRunnableAndBlocked
    overlap.ts             # NEW: predictFileOverlap (file conflict prediction)

  discovery.ts             # NEW: share/check discovery files (simple filesystem)
  reservation.ts           # NEW: file lock/release/check (simple filesystem)
```

Three new files. That's it.

### Edge Cases

| # | Edge case | Fix |
|---|---|---|
| 1 | Agent spawns too many workers (ignores maxAgents) | maxAgents is guidance in skill, not enforced. Agent's decision. If cost matters: `costAware: true` in settings, status shows estimated cost. |
| 2 | File prediction wrong (missed overlap) | Prediction is best-effort from specs. Merge-time detection catches real conflicts. Task goes to revision. |
| 3 | Worker fails mid-task | Agent sees failure in task_read. Agent decides: retry, skip, or investigate. |
| 4 | Worker A finds something Worker B needs | Discovery tool: A shares. Agent checks discoveries. Relays to B if B is still running. |
| 5 | Agent forgets to check conflicts | task_read ALWAYS includes parallelAnalysis when 2+ runnable. It's in every response. |
| 6 | All tasks have file overlap | `parallelAnalysis.safe` is empty. Suggestion: "Sequential recommended." Agent goes sequential. |
| 7 | Merge conflict after parallel completion | Standard git workflow. Conflicted task goes to revision. Agent resolves. |
| 8 | Session ends mid-parallel | Handoff captures: "2 workers spawned for 02, 03. Check status." Next session resumes. Workers in worktrees are independent. |
| 9 | No worktree support | Workers use branches. Same merge flow. Agent manages branches. |
| 10 | Discovery spam (50 messages) | Max 5 per worker. Budget: 200 tokens each. Agent reads latest, not all. |
| 11 | Worker claims task that another agent already claimed | Claim is atomic (filesystem lock). Second claim fails: "Already claimed by worker-02." |
| 12 | File reservation held by crashed worker | Reservation has TTL (30 min). Auto-released on expiry. Manual: `reserve({ action: 'force-release' })`. |
| 13 | Host doesn't support Agent spawning (standalone CLI) | Can't parallelize without agent host. Sequential only. Doctor notes limitation. |
| 14 | Prediction says safe but tasks are actually dependent | If dependency isn't in `dependsOn`, maestro can't know. Discovery sharing helps. Or: add explicit deps. |

---

## Future: Flexible Task Model

**Status: Future redesign track (after v2 architecture refactor)**

### Problem

The current task model is rigid and hardcoded to filesystem structure:

```
CURRENT (rigid):
  ID = folder name              "01-setup-types"
  Order = numeric prefix         01 < 02 < 03 (implicit)
  Storage = one folder per task  .maestro/features/X/tasks/01-setup-types/
  Spec = co-located file         .maestro/features/X/tasks/01-setup-types/spec.md
  Deps = inferred from prefix    02 depends on 01 automatically
```

### Vision

Tasks are just data. The ID is whatever makes sense. The model picks what's natural --
same freedom Claude Code gives with its task IDs.

```
FUTURE (flexible):
  ID = any string               "task-1", "epic-auth", "T001", "setup"
  Order = explicit deps only     no implicit ordering from naming
  Storage = decoupled from ID    single DB file, host system, or any backend
  Spec = linked, not co-located  stored however the backend wants
  Deps = always explicit         dependsOn: ["task-1", "setup"]
  Type = freeform                "task", "epic", "story", "bug" -- optional
```

### New Task Interface

```typescript
interface Task {
  id: string;                    // any string -- model's choice
  name: string;                  // human-readable title
  type?: string;                 // "task", "epic", "bug" -- freeform, optional
  status: TaskStatus;            // pending | claimed | done | blocked | review | revision
  dependsOn: string[];           // explicit only -- list of task IDs
  feature: string;               // which feature this belongs to

  // Rich fields (optional)
  spec?: string;                 // markdown content or path
  report?: string;               // completion report
  summary?: string;              // completion summary
  claimedAt?: string;
  claimedBy?: string;
  revisionCount?: number;
  verificationScore?: number;
  metadata?: Record<string, unknown>;
}
```

### What Changes

1. **Drop implicit ordering** -- `buildEffectiveDependencies` no longer infers from numeric prefix.
   All deps are explicit or none. Simpler, more honest.

```typescript
// BEFORE: complex inference from folder names
function buildEffectiveDependencies(tasks) {
  // Parse "01" from "01-setup-types"
  // Infer 02 depends on 01
  // Handle missing prefixes, explicit overrides...
}

// AFTER: just read what's declared
function buildEffectiveDependencies(tasks) {
  return new Map(tasks.map(t => [t.id, t.dependsOn ?? []]));
}
```

2. **Decouple storage from identity** -- tasks don't have to be folders. The backend decides
   how to store them. fs-tasks might still use folders internally, but the ID is separate.

3. **Plan parser generates flexible IDs** -- instead of folder names from headings,
   generates short IDs and explicit dep links.

4. **Host backend integration becomes natural** -- no folder-to-ID mapping needed.
   Maestro's task ID IS the host's task ID (or mapped trivially via metadata).

### Migration Path

This is a separate track from the v2 architecture refactor. The v2 refactor moves files
and fixes layer violations. The task model redesign changes the core data model.

Sequence:
1. v2 architecture refactor (current plan -- move files, fix layers, add toolbox)
2. Flexible task model (future -- change data model, update TaskPort, migrate existing tasks)
3. Host-native backend using flexible IDs (future -- builds on both 1 and 2)
