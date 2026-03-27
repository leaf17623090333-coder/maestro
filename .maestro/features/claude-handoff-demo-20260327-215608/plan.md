## Discovery
This demo feature exists only to exercise Maestro's cross-agent handoff workflow with Claude in a clean, deterministic way. The repository already has older handoff artifacts and an active handed-off feature, so this plan uses a fresh temporary feature to avoid inheriting prior pickup state. The goal is not to change product code, but to prove that a minimal valid plan can be written, approved, converted into tasks, and exported as a Claude-targeted handoff.

### 1. Create demo task state
Create the minimum valid task structure for the demo so Maestro can generate real tasks from the plan instead of a placeholder document.

### 2. Export the Claude handoff
Advance the feature through approval and task sync, then export the resulting handoff specifically to `claude` so another agent can pick it up.
