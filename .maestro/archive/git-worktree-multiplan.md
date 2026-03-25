# Git Worktree Multi-Plan Support

## Objective

Enable isolated, parallel plan execution by integrating git worktrees into Maestro's `/work` command, so multiple Claude Code sessions can execute different plans simultaneously without file, branch, or state conflicts.

## Scope

**In**:
- New `git-worktrees` skill (`.claude/skills/git-worktrees/SKILL.md`) encapsulating worktree creation, safety checks, setup, and cleanup
- `/work` command updated to offer worktree isolation before execution begins
- `/reset` command updated to detect and clean orphaned worktrees
- `/status` command updated to report active worktrees
- Handoff files extended with worktree metadata (path, branch)
- Wisdom merge-back from worktree to main tree on completion
- `.worktrees/` added to project `.gitignore`

**Out**:
- `/design` command changes (design is read-only planning, no isolation needed)
- Automatic merging of worktree branches back to main (user handles PR/merge)
- Cross-worktree communication between concurrent sessions
- Changes to agent definitions (kraken, spark, etc.) — they work in whatever directory they're spawned in
- CI/CD integration
- Global worktree directory support (`~/.config/...`) — project-local only for v1

## Task Dependencies

```
Wave 1 (parallel):  Task 1, Task 7, Task 8
Wave 2 (parallel):  Task 2, Task 4, Task 5  (all blocked by Task 1)
Wave 3 (sequential): Task 3                  (blocked by Task 2)
Task 6: removed — see Notes
```

Task 1 (skill) defines the worktree workflow that Tasks 2-5 reference. Tasks 7 and 8 are independent metadata changes. Task 2 and Task 3 both modify `work.md` so they must be sequential.

## Tasks

- [ ] Task 1: Create git-worktrees skill
  **File**: `.claude/skills/git-worktrees/SKILL.md`
  **Agent**: kraken
  **Blocks**: Tasks 2, 3, 4, 5
  **Description**: Create the reusable worktree skill that encapsulates all git worktree mechanics. This skill is invoked by the `/work` command and can be reused by other workflows. The `.worktrees/` directory is created at the **project root** (sibling of `.maestro/`, `.claude/`), not inside `.maestro/`.
  **Acceptance criteria**:
  - SKILL.md has valid YAML frontmatter with `name: git-worktrees`, `description`, and `triggers: [worktree, isolation, parallel]`
  - Documents the directory priority chain: `.worktrees/` > `worktrees/` > CLAUDE.md preference > ask user (all at project root)
  - Documents safety verification: `git check-ignore -q` check, auto-add to `.gitignore` if not ignored
  - Documents worktree creation: `git worktree add "<path>" -b "maestro/<plan-slug>"`
  - Documents project setup auto-detection (package.json -> bun install, Cargo.toml -> cargo build, etc.) — uses `bun` not `npm` per project conventions
  - Documents clean test baseline verification before starting work
  - Documents completion workflow: wisdom merge-back, worktree removal (`git worktree remove`), branch cleanup
  - Includes a "Common Mistakes" and "Red Flags" section matching the obra/superpowers pattern
  - Includes integration points section noting it's called by `/work` command

- [ ] Task 2: Update /work command — worktree creation step
  **File**: `.claude/commands/work.md`
  **Agent**: kraken
  **Blocked by**: Task 1
  **Blocks**: Task 3
  **Description**: Add a new Step 1.7 (between plan validation and team creation) that offers worktree isolation. This step asks the user whether to execute in a worktree or the main tree, then creates the worktree if chosen. The worktree is created at the **project root** (e.g., `.worktrees/<plan-slug>/`), not inside `.maestro/`.
  **Acceptance criteria**:
  - New Step 1.7 "Worktree Isolation (Optional)" added after Step 1.5 (Validate & Confirm) and before Step 2 (Create Your Team)
  - Presents `AskUserQuestion` with options: "Execute in worktree (isolated)" vs "Execute in main tree (current behavior)"
  - If worktree chosen: follows the git-worktrees skill workflow (directory selection, safety check, creation with `maestro/{plan-slug}` branch, project setup, baseline test)
  - Copies the selected plan file into the worktree's `.maestro/plans/` directory
  - Creates `.maestro/handoff/`, `.maestro/drafts/`, `.maestro/wisdom/`, `.maestro/archive/` directories in the worktree
  - Updates the handoff JSON with `"worktree": true, "worktree_path": "<absolute path>", "worktree_branch": "maestro/<slug>"`
  - If user chooses main tree: proceeds with current behavior unchanged (no worktree fields in handoff)
  - All subsequent steps (team creation, task spawning, etc.) operate in the worktree's working directory
  - Includes error handling: if worktree creation fails, falls back to main tree with warning

- [ ] Task 3: Update /work command — worktree completion step
  **File**: `.claude/commands/work.md`
  **Agent**: kraken
  **Blocked by**: Task 2
  **Description**: Update Step 7 (Extract Wisdom) and add a new Step 8.7 (Worktree Cleanup) to handle worktree completion. Wisdom files get copied back to the main tree, and the worktree gets cleaned up. This is a multi-step workflow change involving wisdom merge-back, user prompts, conditional worktree removal, and branch cleanup — requires kraken's multi-file thoroughness.
  **Acceptance criteria**:
  - Step 7 (Extract Wisdom) updated: if running in a worktree, after writing wisdom to the worktree's `.maestro/wisdom/`, copies the wisdom file back to the main tree's `.maestro/wisdom/` directory
  - New Step 8.7 "Worktree Cleanup" added after Step 8.5 (Archive Plan) and before Step 9 (Report)
  - Step 8.7 only runs if the handoff has `"worktree": true`
  - Step 8.7 procedure: (1) report the worktree branch name for user to merge/PR, (2) ask user whether to remove the worktree now or keep it, (3) if remove: `git worktree remove <path>` from the main tree, optionally delete the branch
  - Step 9 (Report) updated to include worktree info: branch name, worktree path, merge instructions
  - If not in a worktree, Steps 8.7 additions are skipped (existing behavior preserved)

- [ ] Task 4: Update /status command — worktree reporting
  **File**: `.claude/commands/status.md`
  **Agent**: spark
  **Blocked by**: Task 1
  **Description**: Add a new section to `/status` that reports active git worktrees associated with Maestro.
  **Acceptance criteria**:
  - New Section 5.5 "Worktrees" added between Handoffs and Teams sections
  - Runs `git worktree list --porcelain` to detect active worktrees
  - Filters for worktrees on `maestro/*` branches (Maestro-created worktrees)
  - For each Maestro worktree: shows path, branch name, and cross-references with handoff files
  - If no Maestro worktrees found: "No active Maestro worktrees."
  - Summary table updated to include Worktrees row
  - Next Steps table updated: if worktrees exist with no active tasks, suggest "Worktrees may be from completed sessions. Run `/reset` to clean up."

- [ ] Task 5: Update /reset command — worktree cleanup
  **File**: `.claude/commands/reset.md`
  **Agent**: spark
  **Blocked by**: Task 1
  **Description**: Add worktree cleanup to the reset command so orphaned worktrees from interrupted sessions get detected and optionally removed.
  **Acceptance criteria**:
  - New Section 6 "Orphaned Worktrees" added after Section 5 (Archived Plans)
  - Runs `git worktree list --porcelain` to find Maestro worktrees (branches matching `maestro/*`)
  - Cross-references with handoff files to identify orphaned worktrees (no corresponding active handoff, or handoff status is stale)
  - For each orphaned worktree: shows path, branch, creation context
  - Asks user for confirmation before removing (`git worktree remove <path>`)
  - Optionally deletes the associated branch (`git branch -D maestro/<slug>`) with separate confirmation
  - Output section updated to include worktree cleanup count
  - Safety: never auto-removes worktrees, always requires explicit confirmation

- [ ] Task 6: Update .gitignore for .worktrees directory
  **File**: `.gitignore`
  **Agent**: spark
  **Description**: Add `.worktrees/` to the project's root `.gitignore` so worktree directories (at the project root, sibling of `.maestro/`) are never accidentally tracked.
  **Acceptance criteria**:
  - `.worktrees/` entry added to the root `.gitignore` with a descriptive comment (e.g., `# Git worktrees for isolated plan execution`)
  - If no root `.gitignore` exists, create one
  - Entry is idempotent — if `.worktrees/` is already in `.gitignore`, no duplicate is added

- [ ] Task 7: Update SKILL.md manifest
  **File**: `.claude/skills/maestro/SKILL.md`
  **Agent**: spark
  **Description**: Update the Maestro skill manifest to document the new worktree capability in the workflow descriptions.
  **Acceptance criteria**:
  - Execution Flow section updated to mention optional worktree isolation
  - State Directory section updated to show `.worktrees/` as a project-root runtime directory (peer of `.maestro/`)
  - No breaking changes to existing content

## Verification

1. **Skill file exists and is well-formed**:
   ```bash
   test -f .claude/skills/git-worktrees/SKILL.md && echo "PASS" || echo "FAIL"
   head -5 .claude/skills/git-worktrees/SKILL.md  # Check frontmatter
   ```

2. **Work command has worktree steps**:
   ```bash
   grep -c "Worktree" .claude/commands/work.md  # Should find multiple references
   grep "Step 1.7" .claude/commands/work.md      # New step exists
   grep "Step 8.7" .claude/commands/work.md      # Cleanup step exists
   ```

3. **Status command reports worktrees**:
   ```bash
   grep "worktree" .claude/commands/status.md
   grep "git worktree list" .claude/commands/status.md
   ```

4. **Reset command handles worktrees**:
   ```bash
   grep "Orphaned Worktrees" .claude/commands/reset.md
   grep "git worktree remove" .claude/commands/reset.md
   ```

5. **Gitignore updated**:
   ```bash
   grep ".worktrees" .gitignore
   ```

6. **Validation scripts pass** (if they exist):
   ```bash
   ./scripts/validate-links.sh 2>/dev/null || true
   ./scripts/validate-anchors.sh 2>/dev/null || true
   ```

7. **Manual integration test**: Run `/work` on a test plan, choose worktree isolation, verify:
   - Worktree created in `.worktrees/<plan-slug>/`
   - Branch is `maestro/<plan-slug>`
   - Plan file copied into worktree
   - Workers execute in the worktree directory
   - Wisdom merged back to main tree on completion
   - `/status` reports the active worktree
   - `/reset` detects and offers to clean up the worktree

## Notes

### Technical Decisions

1. **`/work` only, not `/design`**: Design sessions are read-only (Prometheus researches and interviews but doesn't edit files). The conflict scenario is concurrent *execution*, not concurrent *planning*. This keeps the change surface small.

2. **Plan copy, not symlink**: Each worktree gets its own copy of the plan file at creation time. This avoids symlink complexity and means the worktree is fully self-contained. The plan in the main tree remains the source of truth.

3. **Wisdom merge-back**: The one piece of state that flows back from worktree to main tree is wisdom files. These are append-only learnings that benefit future sessions regardless of which worktree generated them.

4. **User-controlled merge**: Maestro creates the worktree and branch but does NOT auto-merge back to main. The user decides when and how to merge (PR, direct merge, etc.). This avoids dangerous automated git operations.

5. **Branch naming `maestro/{plan-slug}`**: Clear namespace separation from user branches. The `/status` and `/reset` commands filter on this prefix to identify Maestro-managed worktrees.

6. **Step numbering**: New steps use the `.5` and `.7` convention established in the codebase (see wisdom from plan-cleanup) to insert between existing steps without renumbering.

7. **Project setup uses `bun`**: Per project conventions in CLAUDE.md, `bun` is used instead of `npm` for JavaScript/TypeScript projects. The skill's setup detection table reflects this.

8. **`/review` does not need worktree changes**: Leviathan flagged that `/review` uses relative Glob patterns (`.maestro/plans/*.md`, `.maestro/archive/*.md`) which resolve relative to the current working directory. When `/review` runs inside a worktree, these patterns automatically find the worktree-local plan files without any code changes. The original Task 6 was removed as unnecessary.

### Rollback Strategy

All changes are to markdown command/skill files. Rollback is a simple `git checkout` of the affected files. No runtime state or code changes are involved.

### Risk Assessment

- **Low risk**: All changes are to prompt/instruction files (markdown), not executable code
- **Backward compatible**: Worktree isolation is optional — users can always choose "Execute in main tree" and get the current behavior
- **Graceful degradation**: If `git worktree` is not available or fails, the system falls back to main tree execution with a warning

## Prior Wisdom

- **Work Plan Autoload**: Handoff JSON uses minimal schema — we extend it with `worktree`, `worktree_path`, `worktree_branch` fields. Graceful degradation: commands check for these fields and skip worktree logic if absent.
- **Plan Cleanup — Automatic Archival**: Step numbering uses N.5 convention for insertions. Archive directory pattern established.
- **Documentation Update patterns**: Command files are the sole functional layer. Changes to commands = changes to behavior.
- **Skill Interoperability**: Skills are auto-discovered from `.claude/skills/`. New `git-worktrees` skill follows the same SKILL.md frontmatter pattern.
