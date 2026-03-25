# Running Tests

## Commands

```bash
bun test                                    # run all tests (scoped to src/)
bun test src/__tests__/unit/foo.test.ts     # run single test file
bun test --watch                            # watch mode
```

## Test Location

Tests live in `src/__tests__/unit/`. File pattern: `*.test.ts`.

## Test Structure

- Use `describe` and `it` blocks (Bun's built-in test runner, Jest-compatible API)
- Mock external dependencies (filesystem, git), not internal modules
- Test error paths in addition to happy paths

## Patterns

- Port interfaces enable test isolation -- create mock adapters implementing the port interface
- See `src/toolbox/sdk/test-harness.ts` for mock transport patterns
- Filesystem adapters can be tested against real temp directories for integration tests

## CI

Tests run as part of `bun run check` (typecheck + test) and in GitHub Actions CI (`.github/workflows/ci.yml`).
