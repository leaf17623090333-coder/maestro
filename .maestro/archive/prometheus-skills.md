# Prometheus Skills: Context7 + Web Research

## Objective

Give Prometheus and explore web research capabilities (WebSearch, WebFetch) and Context7 library documentation access so that design plans are informed by up-to-date external knowledge.

## Scope

**In**:
- Create a Context7 skill at `.claude/skills/context7/SKILL.md` following Context7's own "Add a Rule" integration pattern
- Add `WebSearch` and `WebFetch` to Prometheus's `tools:` frontmatter
- Add `WebSearch` and `WebFetch` to explore's `tools:` frontmatter
- Update Prometheus's workflow guidance to include a "Web Research" phase with smart/conditional activation
- Update the maestro SKILL.md to document the new capabilities
- Update the design command prompt to inform Prometheus about available web research tools

**Out**:
- NOT installing Context7 MCP server (that's a user setup step, documented in the skill)
- NOT adding web tools to oracle, kraken, spark, or other agents
- NOT making web research mandatory for every design session
- NOT creating a new agent -- enhancing existing ones
- NOT modifying the `/work` execution flow

## Tasks

- [ ] Task 1: Create Context7 skill file
  - **Agent**: spark
  - **Acceptance criteria**: `.claude/skills/context7/SKILL.md` exists with proper YAML frontmatter (`name: context7`, `description`, `triggers`), and follows Context7's "Add a Rule" pattern -- instructing agents to use `resolve-library-id` and `query-docs` MCP tools for library documentation
  - **Dependencies**: none
  - **Files**: `.claude/skills/context7/SKILL.md` (new)
  - **Details**:
    - Follow the SKILL.md format established by existing skills (see `.claude/skills/maestro/SKILL.md` for pattern)
    - YAML frontmatter:
      ```yaml
      ---
      name: context7
      description: Fetch up-to-date library documentation via Context7 MCP. Use when working with external libraries, APIs, or frameworks.
      triggers:
        - "documentation"
        - "library"
        - "api"
        - "docs"
        - "context7"
      priority: 30
      ---
      ```
    - Body follows Context7's recommended "Add a Rule" approach. The core rule:
      ```
      Always use Context7 MCP tools to fetch up-to-date library documentation when the task involves external libraries, APIs, or frameworks. Do not rely on training data for library-specific APIs -- fetch current docs instead.
      ```
    - Document the two Context7 MCP tools and how to use them:
      1. `resolve-library-id` -- Resolves a library name (e.g., "nextjs", "supabase") into a Context7-compatible library ID. Parameters: `query` (the user's question/task), `libraryName` (the library to search for)
      2. `query-docs` -- Retrieves documentation for a resolved library. Parameters: `libraryId` (e.g., `/vercel/next.js`), `query` (what to find in the docs)
    - Include usage workflow:
      1. Identify libraries/frameworks in the design request
      2. Call `resolve-library-id` with the library name to get the Context7 library ID
      3. Call `query-docs` with the library ID and a focused query to get relevant docs
      4. If you already know the library ID (slash syntax like `/supabase/supabase`), skip step 2
      5. For version-specific docs, include the version in the query
    - Include a "Prerequisites" section noting that Context7 MCP must be installed:
      ```
      ## Prerequisites
      Context7 MCP server must be configured. Install with:
      claude mcp add context7 -- npx -y @upstash/context7-mcp --api-key YOUR_API_KEY
      Get a free API key at context7.com/dashboard
      ```
    - Include a "When to Use" section:
      - Working with external libraries, APIs, or frameworks
      - Need version-specific API documentation
      - Verifying whether an API exists or checking its current signature
      - Setting up or configuring a third-party tool
    - Include a "When NOT to Use" section:
      - Pure internal codebase changes with no external dependencies
      - Simple refactors or bug fixes that don't touch library APIs
      - When you already have sufficient context from codebase research

- [ ] Task 2: Add WebSearch and WebFetch to Prometheus agent definition
  - **Agent**: spark
  - **Acceptance criteria**: `/Users/reinamaccredy/Code/maestro/.claude/agents/prometheus.md` has `WebSearch` and `WebFetch` in its `tools:` frontmatter line; the workflow section includes a "Web Research" phase
  - **Dependencies**: none
  - **Files**: `.claude/agents/prometheus.md` (modify)
  - **Details**:
    - Add `WebSearch, WebFetch` to the existing `tools:` line in YAML frontmatter
    - New tools line: `tools: Read, Write, Edit, Grep, Glob, Bash, Task, SendMessage, TaskCreate, TaskList, TaskUpdate, TaskGet, AskUserQuestion, WebSearch, WebFetch`
    - Add a new `## Web Research` section AFTER the existing `## Teammates` section and BEFORE `## Outputs`:
      ```
      ## Web Research

      You have access to web search and fetching tools. Use them **conditionally** -- not every design session needs external research.

      **When to search the web:**
      - The request involves external libraries, APIs, or frameworks you need current docs for
      - The user asks about technologies, patterns, or tools you're uncertain about
      - You need to verify version-specific behavior or breaking changes

      **When NOT to search:**
      - The request is purely about internal codebase changes
      - You already have sufficient context from explore results
      - The request is a simple refactor or bug fix

      **How to use:**
      1. Spawn an `explore` teammate with a web research objective (explore also has WebSearch/WebFetch)
      2. Or search directly if the query is simple (e.g., checking a single API endpoint)
      3. For library docs, prefer Context7 MCP tools (`resolve-library-id`, `query-docs`) over generic web search when available
      4. Synthesize web findings with codebase research before drafting the plan
      ```

- [ ] Task 3: Add WebSearch and WebFetch to explore agent definition
  - **Agent**: spark
  - **Acceptance criteria**: `/Users/reinamaccredy/Code/maestro/.claude/agents/explore.md` has `WebSearch` and `WebFetch` in its `tools:` frontmatter line; a brief note about web research is added to its mission
  - **Dependencies**: none
  - **Files**: `.claude/agents/explore.md` (modify)
  - **Details**:
    - Add `WebSearch, WebFetch` to the existing `tools:` line
    - New tools line: `tools: Read, Grep, Glob, Bash, TaskList, TaskGet, TaskUpdate, SendMessage, WebSearch, WebFetch`
    - Add to the `## Your Mission` section additional bullets:
      - `- "Find documentation for library X"`
      - `- "Search for best practices for Y"`
    - This enables explore to do web research when Prometheus delegates it

- [ ] Task 4: Update design command prompt to mention web research capability
  - **Agent**: spark
  - **Acceptance criteria**: The Prometheus spawn prompt in `/Users/reinamaccredy/Code/maestro/.claude/commands/design.md` includes a note about web research tools and Context7 being available
  - **Dependencies**: Task 1
  - **Files**: `.claude/commands/design.md` (modify)
  - **Details**:
    - In the Step 4 prompt template (both full and quick mode), append to the existing prompt string a `## Key Context` section:
      ```
      ## Key Context
      - You have WebSearch and WebFetch tools for external research when the design request involves libraries, APIs, or technologies that benefit from current documentation.
      - Context7 MCP tools (resolve-library-id, query-docs) are available for fetching up-to-date library documentation. Use them when the request involves external libraries.
      - For library docs, prefer Context7 over generic web search -- it returns version-specific, structured documentation.
      - Use web research conditionally -- not every design session needs it.
      ```
    - This ensures Prometheus knows about its capabilities every time it's spawned

- [ ] Task 5: Update maestro SKILL.md to document new capabilities
  - **Agent**: spark
  - **Acceptance criteria**: `.claude/skills/maestro/SKILL.md` mentions web research capability in the Planning Flow section
  - **Dependencies**: Task 2, Task 3
  - **Files**: `.claude/skills/maestro/SKILL.md` (modify)
  - **Details**:
    - In the Planning Flow section, update step 3: "Spawns explore for codebase research **(and web research when relevant)**"
    - Add a line to the Agents table for Prometheus noting "Has web research tools (WebSearch, WebFetch)"
    - Keep changes minimal -- this is a documentation update, not a rewrite

- [ ] Task 6: Verify all changes
  - **Agent**: spark
  - **Acceptance criteria**: Plugin manifest validates, all modified files parse correctly, no broken cross-references, Context7 skill is discoverable
  - **Dependencies**: Task 1, Task 2, Task 3, Task 4, Task 5
  - **Files**: none (verification only)
  - **Details**:
    - Run `cat .claude-plugin/plugin.json | jq .` to validate plugin manifest
    - Run `./scripts/validate-links.sh` to check documentation links
    - Read each modified file to confirm YAML frontmatter parses correctly
    - Verify the new skill file is discoverable: `find .claude/skills -L -name "SKILL.md" -type f`
    - Verify no agent has duplicate tools in its tools list
    - Grep for `WebSearch` across `.claude/agents/` to confirm only prometheus.md and explore.md match

## Verification

- [ ] `cat .claude-plugin/plugin.json | jq .` -- Plugin manifest still valid
- [ ] `./scripts/validate-links.sh` -- No broken documentation links
- [ ] `find .claude/skills -L -name "SKILL.md" -type f` -- Context7 skill discovered at `.claude/skills/context7/SKILL.md`
- [ ] Read `.claude/agents/prometheus.md` -- Contains `WebSearch, WebFetch` in tools line
- [ ] Read `.claude/agents/explore.md` -- Contains `WebSearch, WebFetch` in tools line
- [ ] Read `.claude/skills/context7/SKILL.md` -- Has valid YAML frontmatter; references `resolve-library-id` and `query-docs` MCP tools
- [ ] Grep for `WebSearch` across `.claude/agents/` -- Only prometheus.md and explore.md match (not oracle, kraken, etc.)

## Notes

**Context7 Integration Approach (Revised)**: Context7 is an MCP server that provides two tools: `resolve-library-id` (find a library's Context7 ID) and `query-docs` (fetch docs for a library). Their recommended integration pattern is "Add a Rule" -- put a rule in CLAUDE.md or equivalent that tells the AI to automatically use Context7 MCP tools when it needs library documentation. Our skill (`.claude/skills/context7/SKILL.md`) follows this exact pattern: it acts as a rule that gets injected into agent context via Maestro's skill interoperability system. The skill documents the two MCP tools, when to use them, and includes a prerequisites section for MCP installation. This is the approach Context7 themselves recommend over generic web fetching.

**MCP Prerequisite**: Context7 MCP must be installed separately by the user (`claude mcp add context7 -- npx -y @upstash/context7-mcp --api-key YOUR_API_KEY`). The skill documents this in its prerequisites section. If Context7 MCP is not installed, agents gracefully fall back to WebSearch/WebFetch for library documentation.

**Web Search Scope Decision**: WebSearch and WebFetch added to Prometheus (planner) and explore (research specialist) only. Oracle remains a pure strategic advisor without web access. This keeps the blast radius small while giving the research pipeline full web capability.

**Activation Strategy**: Smart/conditional -- Prometheus decides per-session whether web research adds value. No `--research` flag needed. The workflow guidance in the agent definition provides clear heuristics for when to search vs. skip. For library docs specifically, the Context7 skill triggers via keyword matching (documentation, library, api, docs) through the existing skill-matcher system.

**Existing Pattern Followed**: The `web-design-guidelines` skill at `.agents/skills/web-design-guidelines/SKILL.md` already uses `WebFetch` to pull external content. This plan follows the same pattern for web tools. The Context7 skill follows the "Add a Rule" pattern recommended by Context7's own documentation.

**Risk**: Adding WebSearch/WebFetch to agents increases token usage when web research is triggered. The smart/conditional activation mitigates this. Context7 MCP calls are lightweight (structured doc retrieval) compared to generic web search.
