# SQLite Task Coordination

**Status**: Design Document (not yet implemented)
**Author**: Maestro Planning
**Context**: Adapted from oh-my-claudecode's swarm implementation for Maestro's plan-centric workflow.

## Problem Statement

Maestro currently uses Claude Code's built-in Agent Teams task system (`TaskCreate`, `TaskList`, `TaskUpdate`) for coordination between orchestrator and workers. This works well for small plans (5-15 tasks) but has limitations:

1. **No atomic claiming** -- two workers calling `TaskList` simultaneously may both see the same task as available and race to claim it.
2. **No heartbeat tracking** -- the orchestrator cannot distinguish between a worker that's actively working and one that has crashed.
3. **No crash recovery** -- if a worker dies mid-task, the task stays `in_progress` indefinitely until manual intervention.
4. **No audit trail** -- task state transitions are not logged, making post-mortem analysis difficult.
5. **Limited query capability** -- cannot efficiently query tasks by claimed_by, completion time, or error status.

## Proposed Solution

Replace the Agent Teams task system with a SQLite-backed coordination layer that provides ACID-compliant task state management while preserving Maestro's existing workflow patterns.

## Schema

### `tasks` Table

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'done', 'failed', 'blocked')),
  agent_type TEXT,                    -- kraken, spark, build-fixer
  claimed_by TEXT,                    -- agent identifier
  claimed_at INTEGER,                 -- Unix epoch ms
  completed_at INTEGER,               -- Unix epoch ms
  result TEXT,                        -- outcome summary
  error TEXT,                         -- error message if failed
  blocked_by TEXT,                    -- comma-separated task IDs
  owned_files TEXT,                   -- comma-separated file paths
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_plan ON tasks(plan_id);
CREATE INDEX idx_tasks_claimed_by ON tasks(claimed_by);
```

### `heartbeats` Table

```sql
CREATE TABLE heartbeats (
  agent_id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,           -- kraken, spark, build-fixer
  last_heartbeat INTEGER NOT NULL,    -- Unix epoch ms
  current_task_id TEXT,
  FOREIGN KEY (current_task_id) REFERENCES tasks(id)
);
```

### `sessions` Table

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  agent_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled', 'failed'))
);
```

### `task_log` Table (audit trail)

```sql
CREATE TABLE task_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  agent_id TEXT,
  timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  detail TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

## API

All API functions are implemented as a shell-callable Node.js script (`.claude/scripts/task-db.mjs`) using `better-sqlite3` or Node's built-in SQLite support.

### Core Operations

```bash
# Initialize database for a plan
node .claude/scripts/task-db.mjs init --plan "my-plan" --session "session-123"

# Create a task
node .claude/scripts/task-db.mjs create --plan "my-plan" --desc "Implement auth" --agent-type kraken --blocked-by "task-1,task-2"

# Claim next available task (atomic)
node .claude/scripts/task-db.mjs claim --agent "kraken-1"
# Returns: {"success":true,"taskId":"task-3","description":"Implement auth"}

# Complete a task
node .claude/scripts/task-db.mjs complete --agent "kraken-1" --task "task-3" --result "Auth module implemented"

# Fail a task
node .claude/scripts/task-db.mjs fail --agent "kraken-1" --task "task-3" --error "Build failed: missing dependency"

# Send heartbeat
node .claude/scripts/task-db.mjs heartbeat --agent "kraken-1"

# Cleanup stale claims (run by orchestrator periodically)
node .claude/scripts/task-db.mjs cleanup --timeout 300000

# Query status
node .claude/scripts/task-db.mjs stats --plan "my-plan"
# Returns: {"total":15,"pending":3,"claimed":2,"done":8,"failed":1,"blocked":1}

# Check if plan is complete
node .claude/scripts/task-db.mjs is-complete --plan "my-plan"
```

### Atomic Claim Implementation

```javascript
function claimTask(agentId) {
  const claim = db.transaction(() => {
    // Find first unblocked pending task
    const task = db.prepare(`
      SELECT id, description FROM tasks
      WHERE status = 'pending'
        AND (blocked_by IS NULL OR blocked_by = ''
             OR NOT EXISTS (
               SELECT 1 FROM tasks t2
               WHERE t2.id IN (SELECT value FROM json_each('[' || tasks.blocked_by || ']'))
                 AND t2.status NOT IN ('done')
             ))
      ORDER BY id LIMIT 1
    `).get();

    if (!task) return { success: false, reason: 'No claimable tasks' };

    const result = db.prepare(`
      UPDATE tasks SET status = 'claimed', claimed_by = ?, claimed_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(agentId, Date.now(), task.id);

    if (result.changes === 0) return { success: false, reason: 'Race lost' };

    db.prepare(`
      INSERT OR REPLACE INTO heartbeats (agent_id, agent_type, last_heartbeat, current_task_id)
      VALUES (?, ?, ?, ?)
    `).run(agentId, agentId.split('-')[0], Date.now(), task.id);

    db.prepare(`
      INSERT INTO task_log (task_id, from_status, to_status, agent_id) VALUES (?, 'pending', 'claimed', ?)
    `).run(task.id, agentId);

    return { success: true, taskId: task.id, description: task.description };
  });

  return claim();
}
```

## Integration Points

### How the Orchestrator Would Use It

In the work SKILL.md workflow, the orchestrator would:

1. **Step 3 (Create Tasks)**: Call `task-db.mjs create` for each plan task instead of `TaskCreate`. Dependencies map to `blocked_by`.
2. **Step 4 (Spawn Teammates)**: Workers receive the database path and their agent ID. Workers call `task-db.mjs claim` in a loop instead of `TaskList` + `TaskUpdate`.
3. **Step 6 (Monitor)**: Orchestrator runs `task-db.mjs stats` and `task-db.mjs cleanup` periodically instead of reading `TaskList`.
4. **Completion**: `task-db.mjs is-complete` replaces checking all tasks via `TaskList`.

### How Workers Would Use It

Workers replace their current self-coordination loop:

```
# Current (Agent Teams)
TaskList → find pending → TaskUpdate(in_progress) → work → TaskUpdate(completed)

# Proposed (SQLite)
task-db.mjs claim → work → task-db.mjs complete
                          → task-db.mjs heartbeat (every 60s during long tasks)
```

### Database Location

```
.maestro/
├── state/
│   └── tasks.db        # SQLite database (gitignored)
├── plans/
├── archive/
└── ...
```

The database is ephemeral -- created fresh for each `/work` session and deleted on `/reset`. It is NOT committed to git.

## Migration Path

### Phase A: Parallel Mode (Low Risk)

Run SQLite alongside Agent Teams. The orchestrator creates tasks in both systems. Workers use Agent Teams as primary, SQLite as audit log. This validates the schema and API without changing behavior.

### Phase B: SQLite Primary (Medium Risk)

Workers switch to SQLite for claiming. Agent Teams still used for SendMessage (communication). The orchestrator monitors via SQLite stats. Fallback: if SQLite fails, revert to Agent Teams.

### Phase C: Full Migration (Higher Risk)

Remove Agent Teams task dependency entirely. Workers use SQLite for coordination and SendMessage for communication only. Agent Teams TaskList/TaskUpdate are no longer called.

### Compatibility Constraints

- **SendMessage**: Still needed for worker-to-orchestrator communication. SQLite only handles task state.
- **TeamCreate/TeamDelete**: Still needed to spawn/cleanup worker agents.
- **Hooks**: All existing hooks continue to work unchanged. They don't interact with the task system directly.

## Pros and Cons

### Pros

| Benefit | Detail |
|---------|--------|
| Atomic claiming | No race conditions between workers |
| Crash recovery | Stale claims auto-release via heartbeat timeout |
| Audit trail | Full task_log table with timestamps |
| Query power | SQL queries for any state combination |
| Scalability | Handles 100+ tasks easily |
| Debugging | `sqlite3 .maestro/state/tasks.db` for direct inspection |
| Persistence | Survives agent crashes, session interruptions |

### Cons

| Drawback | Detail |
|----------|--------|
| New dependency | Requires `better-sqlite3` npm package or Node 22+ built-in SQLite |
| Complexity | More moving parts than Agent Teams TaskList |
| Two coordination systems | During migration, both SQLite and Agent Teams are active |
| File-based state | Database file could be corrupted (unlikely with SQLite WAL mode) |
| Worker changes | All agent definitions need updated instructions for SQLite protocol |
| Not portable | Only works with Node.js runtime (not pure bash) |

### Verdict

SQLite coordination is a significant improvement for plans with >10 tasks or >3 concurrent workers. For smaller plans (the common case in Maestro), Agent Teams is sufficient. **Recommended approach**: implement as an opt-in mode (`/work --sqlite`) rather than replacing Agent Teams entirely.

## Open Questions

1. **Node.js SQLite support**: Should we use `better-sqlite3` (npm dependency) or wait for Node's built-in `node:sqlite` (requires Node 22+)?
2. **Database lifecycle**: Create per-session or persist across sessions for historical analysis?
3. **Blocked task handling**: Should SQLite auto-unblock tasks when dependencies complete, or should the orchestrator manage this?
4. **File ownership enforcement**: Advisory only (current plan) or add SQLite-based file locking?
5. **Multi-plan support**: One database per plan or shared database with plan_id partitioning?
