## Maestro Conductor (shared score)

Projects with `.maestro/` hold mission and memory state that all agents share.

**See what is in flight:**
```bash
maestro status --json
maestro mission list --json
maestro feature list --mission <id> --json
```

**Read a worker prompt (with injected memory):**
```bash
maestro feature prompt <featureId> --mission <id>
```

**Capture a correction rule for future sessions:**
```bash
maestro memory-correct "use bun not npm" --trigger "package,install,npm"
```

**Report feature progress:**
```bash
maestro feature update <featureId> --mission <id> --status <status> --report @report.json
```

**When to use**: Start every session with `maestro status` to see shared state. Use `maestro feature prompt` to read the current feature's briefing with memory context auto-injected.
