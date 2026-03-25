# Context7 Deep Integration for /design Workflow

**Goal**: Make Prometheus automatically detect external libraries in design requests and proactively fetch their documentation via Context7 MCP tools before drafting plans.
**Architecture**: Add a "Library Detection & Documentation" step to Prometheus's workflow that scans the design request for library/framework mentions, resolves them via Context7, and injects the docs into its planning context. The design skill prompt is updated to pass actionable Context7 instructions (not just a mention).
**Tech Stack**: Claude Code Agent Teams, Context7 MCP (`resolve-library-id`, `query-docs`), Markdown agent definitions

## Objective
Transform Prometheus's passive Context7 awareness into an active, structured workflow that automatically fetches library docs when the design request involves external dependencies.

## Scope
**In**:
- Add a concrete "Library Detection & Doc Fetching" workflow step to `prometheus.md`
- Update the `## Web Research` section in `prometheus.md` with actionable Context7 instructions
- Update the design skill prompt's `## Key Context` to include the full Context7 tool reference (parameters, workflow)
- Update the Prometheus workflow summary to include the library detection step

**Out**:
- Not changing the explore agent definition (explore already has WebSearch/WebFetch; Context7 MCP tools are session-level)
- Not building auto-detection scripts or hooks (YAGNI — Prometheus can parse the request itself)
- Not changing the context7 skill file (it's already well-structured)
- Not adding new tools to agent tool lists (Context7 MCP tools are session-level, not per-agent)

## Tasks

- [ ] Task 1: Update Prometheus agent — add Library Detection workflow step
  - **Agent**: spark
  - **Acceptance criteria**: `/Users/reinamaccredy/Code/maestro/.claude/agents/prometheus.md` has a new `## Library Detection & Documentation` section between `## Teammates` and `## Web Research`, with a concrete 3-step workflow (detect → resolve → fetch). The `## Workflow Summary` line is updated to include the library detection step. The `## Web Research` section's "How to use" list item 3 is expanded with concrete tool parameters.
  - **Dependencies**: none
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/agents/prometheus.md`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/.claude/agents/prometheus.md`
    2. Add the following new section between `## Teammates` (after line 52) and `## Web Research` (before line 54):

```markdown
## Library Detection & Documentation

When you receive a design request, scan it for external library/framework/API mentions **before** spawning researchers or interviewing the user. This ensures you have current documentation context for planning.

### Step 1: Detect Libraries

Scan the design request for mentions of:
- Package names (e.g., "next.js", "supabase", "prisma", "tailwind")
- Framework references (e.g., "React", "Vue", "Express")
- API/service names (e.g., "Stripe API", "OpenAI", "AWS S3")
- Explicit documentation requests (e.g., "check the docs for X")

If **no external libraries are detected**, skip to your normal workflow (spawn researchers, interview user).

### Step 2: Resolve Library IDs

For each detected library, call the Context7 MCP tool:

```
resolve-library-id(
  query: "{the user's design request}",
  libraryName: "{detected library name}"
)
```

This returns a Context7-compatible library ID (e.g., `/vercel/next.js`, `/supabase/supabase`).

If the tool is not available (MCP not configured), fall back to `WebSearch` for that library's docs.

### Step 3: Fetch Relevant Documentation

For each resolved library ID, fetch the documentation relevant to the design request:

```
query-docs(
  libraryId: "{resolved library ID}",
  query: "{specific aspect relevant to the design request}"
)
```

Focus the query on the specific APIs/features mentioned in the design request, not the entire library.

### Step 4: Inject into Context

Include fetched documentation summaries in a `## Library Context` section of your plan's `## Notes`. Reference specific API signatures, configuration options, or patterns discovered.
```

    3. Update the `## Workflow Summary` line (currently line 80) from:
       ```
       Spawn researchers → interview user (AskUserQuestion) → synthesize research → clearance checklist → write plan to plan-mode file → ExitPlanMode
       ```
       to:
       ```
       Detect libraries → fetch docs (Context7/WebSearch) → spawn researchers → interview user (AskUserQuestion) → synthesize research → clearance checklist → write plan to plan-mode file → ExitPlanMode
       ```

    4. Update the `## Web Research` section's "How to use" item 3 (currently line 71) from:
       ```
       3. For library docs, prefer Context7 MCP tools (`resolve-library-id`, `query-docs`) over generic web search when available
       ```
       to:
       ```
       3. For library docs, prefer Context7 MCP tools over generic web search — see "Library Detection & Documentation" section above for the full workflow
       ```

    5. Verify the file is valid markdown: `cat /Users/reinamaccredy/Code/maestro/.claude/agents/prometheus.md | head -100`
    6. Commit: `git add .claude/agents/prometheus.md && git commit -m "feat: add library detection workflow to Prometheus agent"`

- [ ] Task 2: Update design skill — enrich Key Context in Prometheus prompt
  - **Agent**: spark
  - **Acceptance criteria**: The `## Key Context` section in both full-mode and quick-mode prompt strings in `/Users/reinamaccredy/Code/maestro/.claude/skills/design/SKILL.md` includes the full Context7 tool reference with parameters and a concrete usage example, replacing the current vague mentions.
  - **Dependencies**: none
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/design/SKILL.md`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/.claude/skills/design/SKILL.md`
    2. In both the full-mode prompt (line 133) and quick-mode prompt (line 146), replace the current `## Key Context` block:

       **Current** (in both prompts):
       ```
       ## Key Context\\n- You have WebSearch and WebFetch tools for external research when the design request involves libraries, APIs, or technologies that benefit from current documentation.\\n- Context7 MCP tools (resolve-library-id, query-docs) are available for fetching up-to-date library documentation. Use them when the request involves external libraries.\\n- For library docs, prefer Context7 over generic web search -- it returns version-specific, structured documentation.\\n- Use web research conditionally -- not every design session needs it.
       ```

       **New** (for both prompts):
       ```
       ## Key Context\\n- You have WebSearch, WebFetch, and Context7 MCP tools for external research.\\n- IMPORTANT: When the design request mentions external libraries/frameworks/APIs, run your Library Detection & Documentation workflow BEFORE spawning researchers or interviewing the user.\\n- Context7 tools: `resolve-library-id(query, libraryName)` resolves a library name to a Context7 ID. `query-docs(libraryId, query)` fetches version-specific docs for that library. If Context7 MCP is not configured, fall back to WebSearch/WebFetch.\\n- Use web research conditionally -- not every design session needs it. Skip for pure internal codebase changes.
       ```

    3. Verify the prompt strings are valid (no unescaped quotes or broken newlines): `grep -c 'Key Context' /Users/reinamaccredy/Code/maestro/.claude/skills/design/SKILL.md` — should output `2`
    4. Commit: `git add .claude/skills/design/SKILL.md && git commit -m "feat: enrich Context7 instructions in design skill prompt"`

## Verification
- [ ] `grep -A 20 'Library Detection' /Users/reinamaccredy/Code/maestro/.claude/agents/prometheus.md` — should show the full 4-step library detection workflow
- [ ] `grep 'Detect libraries' /Users/reinamaccredy/Code/maestro/.claude/agents/prometheus.md` — should appear in the Workflow Summary line
- [ ] `grep 'resolve-library-id' /Users/reinamaccredy/Code/maestro/.claude/skills/design/SKILL.md` — should show the tool with parameters `(query, libraryName)`
- [ ] `grep 'Library Detection & Documentation workflow' /Users/reinamaccredy/Code/maestro/.claude/skills/design/SKILL.md` — should appear in both prompt strings (2 matches)
- [ ] `cat /Users/reinamaccredy/Code/maestro/.claude/agents/prometheus.md | wc -l` — file should be ~130-140 lines (was 93, adding ~40 lines of new content)

## Notes

**Why not auto-detection scripts/hooks?** Prometheus is an LLM agent — it can parse the design request for library mentions just as well as a regex script, and with better judgment about what constitutes an "external library." Adding a script would be over-engineering.

**Why not modify the explore agent?** Context7 MCP tools are session-level (installed via `claude mcp add`), so they're available to all agents already. The explore agent has WebSearch/WebFetch as fallback. The real gap was in Prometheus's workflow — it didn't know *when* or *how* to use Context7 proactively.

**Fallback strategy:** If Context7 MCP is not configured (tools unavailable), Prometheus falls back to WebSearch/WebFetch. The workflow explicitly handles this case.

**Context7 MCP prerequisite:** The user must have Context7 MCP configured via `claude mcp add context7 -- npx -y @upstash/context7-mcp --api-key YOUR_API_KEY` or the remote connection method. The context7 skill file already documents this.

## Prior Wisdom
- Prometheus Skills wisdom: Context7 recommends "Add a Rule" integration. Conditional/smart activation over mandatory flags. macOS find issues with -L and -type f.
- Improve Design Workflow wisdom: Plan format strings in design.md are single-line escaped — hard to edit. Spark agents struggle with markdown code fence boundaries. Always verify worker claims.
