# Work Skill — CLI-Agnostic Rewrite

## Objective

Rewrite the `/work` skill from Claude Code Agent Teams-coupled to a **capability-based, CLI-agnostic architecture** that works across Amp, Claude Code, Codex, Cursor, Windsurf, Aider, and any future CLI. The core workflow stays identical; only the delegation/orchestration layer is abstracted through runtime adapters.

## Scope

**In scope:**
- Rewrite `SKILL.md` as a thin entrypoint with runtime detection + core workflow refs
- Create `reference/core/` — CLI-agnostic workflow, capability model, decision primitives, task model
- Create `reference/runtimes/` — per-CLI adapter mappings (Claude Teams, Codex spawn, Amp Task/handoff, generic chat)
- Update `reference/` protocols (verification, security, wisdom, worktree, planless, skill-injection) to remove CLI-specific tool names
- Update `.claude/agents/orchestrator.md` to reference the new adapter pattern
- Update `.claude/lib/team-lifecycle.md` to be adapter-aware

**Out of scope:**
- Changes to other skills (design, planning, pipeline)
- Changes to agent definitions beyond orchestrator
- Executable runtime detection code (this is prompt-level instruction)

## Architecture

```
.agents/skills/work/
  SKILL.md                        # entrypoint: runtime detect + dispatch
  reference/
    core/
      workflow.md                 # canonical steps (no tool names)
      capabilities.md             # capability definitions + required vs optional
      decisions.md                # DECIDE primitive + fallback policy
      task-model.md               # canonical task state model
    runtimes/
      registry.md                 # detection rules + --runtime override
      claude-teams.md             # TeamCreate/TaskCreate/... mapping
      codex-spawn.md              # spawn_agent/send_input/wait/close_agent
      amp-task-handoff.md         # Task/handoff parallelism
      generic-chat.md             # Cursor/Windsurf/Aider fallback
      _template.md                # how to add a new runtime adapter
    protocols/                    # (existing, updated to be CLI-agnostic)
      verification-protocol.md
      security-prompt.md
      wisdom-extraction.md
      worktree-isolation.md
      planless-flow.md
      skill-injection.md
```

## Tasks

### Track A: Core Abstraction Layer (sequential)

- [ ] Task 1: Create `reference/core/capabilities.md` — Define capability model (agent.spawn, agent.message, agent.wait, agent.close, team.lifecycle, task.board, prompt.structured, prompt.chat, fs.read/write/search, exec.command). Mark each required vs optional with fallback behavior.
- [ ] Task 2: Create `reference/core/task-model.md` — Define canonical task states (pending, in_progress, blocked, completed, failed), state transitions, and ownership model. CLI-agnostic — no tool names.
- [ ] Task 3: Create `reference/core/decisions.md` — Define `DECIDE(question, options, blocking, default)` primitive. Map to structured prompts, chat prompts, or non-interactive defaults. Include safety policy (risky = stop, safe = auto-proceed).
- [ ] Task 4: Create `reference/core/workflow.md` — Extract the canonical 9-step workflow from current SKILL.md using only abstract capability names. Steps: load_plan → confirm → init_coordination → create_tasks → dispatch_workers → monitor_verify → extract_wisdom → cleanup → report. Reference capabilities.md operations, not tool names.

### Track B: Runtime Adapters (parallel after Task 1)

- [ ] Task 5: Create `reference/runtimes/registry.md` — Runtime detection rules: probe available tools, match to adapter, log selection. Support `--runtime=<name>` override. Define detection signatures for each runtime (blocked by Task 1).
- [ ] Task 6: Create `reference/runtimes/claude-teams.md` — Map all capabilities to Claude Code Agent Teams API (TeamCreate, TeamDelete, SendMessage, TaskCreate, TaskList, TaskUpdate, TaskGet, request_user_input, spawn_agent with subagent_type). Include setup prereqs and common errors (blocked by Task 1).
- [ ] Task 7: Create `reference/runtimes/codex-spawn.md` — Map capabilities to Codex API (exec_command, spawn_agent, send_input, wait, close_agent, request_user_input, web.search_query, web.open) (blocked by Task 1).
- [ ] Task 8: Create `reference/runtimes/amp-task-handoff.md` — Map capabilities to Amp tools (Task for subagent delegation, handoff for parallel fan-out, Bash/Read/Grep/glob/edit_file/create_file for fs, plain chat for prompts). Document Amp-specific patterns: Task for isolated work, handoff for context-preserving delegation (blocked by Task 1).
- [ ] Task 9: Create `reference/runtimes/generic-chat.md` — Minimal fallback for CLIs with only basic tools (read, write, search, shell). Serial execution, chat-based prompts, plan-file-as-state. Works with Cursor, Windsurf, Aider, etc. (blocked by Task 1).
- [ ] Task 10: Create `reference/runtimes/_template.md` — Template for adding new runtime adapters. Capability checklist, mapping table format, detection signature format, fallback declarations (blocked by Task 1).

### Track C: Protocol Updates (parallel, blocked by Task 4)

- [ ] Task 11: Rewrite `reference/verification-protocol.md` — Replace all Claude Code tool names (SendMessage, TaskGet, TaskList, TaskUpdate) with canonical capability names. Reference `decisions.md` for user interaction. Keep verification logic identical (blocked by Task 4).
- [ ] Task 12: Rewrite `reference/security-prompt.md` — Replace `Task()` with canonical `agent.spawn` operation. Use capability names for delegation. Keep security review logic identical (blocked by Task 4).
- [ ] Task 13: Rewrite `reference/wisdom-extraction.md` — Remove CLI-specific references. Use canonical fs/exec operations. Keep extraction logic identical (blocked by Task 4).
- [ ] Task 14: Rewrite `reference/worktree-isolation.md` — Replace `AskUserQuestion` with `DECIDE` primitive. Use canonical exec operations. Keep worktree logic identical (blocked by Task 4).
- [ ] Task 15: Rewrite `reference/planless-flow.md` — Replace `AskUserQuestion` with `DECIDE` primitive. Use canonical operations. Keep planless logic identical (blocked by Task 4).
- [ ] Task 16: Rewrite `reference/skill-injection.md` — Use canonical fs operations. Keep injection logic identical (blocked by Task 4).

### Track D: Entrypoint + Dependents (blocked by Tracks A-C)

- [ ] Task 17: Rewrite `SKILL.md` — Thin entrypoint: runtime detection (Step 0), then dispatch to `core/workflow.md` with selected adapter. Keep arguments section (plan-name, --resume, --eco, --runtime). Remove all inline Claude Code / Codex tool calls. Reference core workflow + adapter docs (blocked by Tasks 4, 5).
- [ ] Task 18: Update `.claude/agents/orchestrator.md` — Reference the new adapter pattern. Remove hard-coded tool lists from frontmatter tools/disallowedTools — make them adapter-dependent. Keep agent identity and constraints (blocked by Task 17).
- [ ] Task 19: Update `.claude/lib/team-lifecycle.md` — Make lifecycle protocols adapter-aware. Keep as thin pointer for Claude Code compatibility but reference the generic pattern (blocked by Task 17).

## Verification

```bash
# All new files exist
ls -la .agents/skills/work/reference/core/
ls -la .agents/skills/work/reference/runtimes/

# No Claude Code-specific tool names in core/ files
rg "TeamCreate|TeamDelete|SendMessage|TaskCreate|TaskList|TaskUpdate|TaskGet|spawn_agent|request_user_input|AskUserQuestion|exec_command|send_input" .agents/skills/work/reference/core/ && echo "FAIL: CLI-specific names in core" || echo "PASS: core is clean"

# No Claude Code-specific tool names in protocols/ files
rg "TeamCreate|TeamDelete|SendMessage|TaskCreate|TaskList|TaskUpdate|TaskGet|spawn_agent|request_user_input|AskUserQuestion|exec_command|send_input" .agents/skills/work/reference/protocols/ && echo "FAIL: CLI-specific names in protocols" || echo "PASS: protocols are clean"

# No Claude Code-specific tool names in SKILL.md (except runtime section refs)
rg "TeamCreate|TeamDelete|SendMessage|TaskCreate|TaskList|TaskUpdate|TaskGet|spawn_agent|request_user_input|AskUserQuestion|exec_command|send_input" .agents/skills/work/SKILL.md && echo "FAIL: CLI-specific names in entrypoint" || echo "PASS: entrypoint is clean"

# Adapters reference concrete tools correctly
rg "TeamCreate" .agents/skills/work/reference/runtimes/claude-teams.md && echo "PASS" || echo "FAIL: claude adapter missing tools"
rg "spawn_agent" .agents/skills/work/reference/runtimes/codex-spawn.md && echo "PASS" || echo "FAIL: codex adapter missing tools"
rg "handoff\|Task" .agents/skills/work/reference/runtimes/amp-task-handoff.md && echo "PASS" || echo "FAIL: amp adapter missing tools"

# Symlink still works
ls -la .claude/skills/work/SKILL.md
```

## Security

No security concerns — this is a prompt-level refactor with no secrets, credentials, or external API changes.

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Core workflow misses a step from original | MEDIUM | Side-by-side comparison during Task 4 |
| Adapter mapping incomplete | LOW | Existing tool lists in current SKILL.md serve as source of truth |
| Breaking existing Claude Code users | LOW | Claude adapter preserves exact same tool calls |
| Prompt too long after adding all refs | MEDIUM | Keep core workflow concise; adapters loaded on-demand |
