# Building the Project

## Build Pipeline

The build is orchestrated by `build.ts` (not a config file -- a Bun script). Steps in order:

1. **Version sync**: copies version from `package.json` into `src/version.ts`
2. **Registry generation**: runs `src/cli/_generate.ts` and `src/skills/generate.ts` to produce `*.generated.ts` files
3. **MCP server bundle**: `dist/server.bundle.mjs` (Node ESM, minified, external: `simple-git`)
4. **Hook bundles**: 5 hooks compiled to `hooks/*.mjs` (sessionstart, pretooluse, posttooluse, precompact, pre-agent)
5. **CLI bundle**: `dist/cli.js` (ESM with shebang, external: `simple-git`)
6. **Standalone binary**: `dist/maestro` (Bun compiled, chmod 0o755)

## Key Build Commands

```bash
bun run build          # full build (all steps above)
bun run typecheck      # tsc --noEmit only
bun run check          # typecheck + test (CI gate, also prepublishOnly)
```

## Environment

- Bun latest (CI uses `oven-sh/setup-bun@v2`)
- TypeScript 5.x with strict mode
- Module resolution: `bundler`
- Target: ES2022

## CI

See `.github/workflows/ci.yml`: triggers on push/PR to main, runs `bun install && bun run build && bun test` on ubuntu-latest.

## Adding New Commands

- CLI handlers: `src/cli/handlers/{domain}/{command}.ts` -- follow existing patterns (citty defineCommand)
- MCP tools: `src/mcp/handlers/{domain}.ts` -- register via `server.tool()`
- After adding, run `bun run build` to regenerate registries

## Adding New Hooks

Hook source files live in `src/hooks/`. The build step compiles each to `hooks/{name}.mjs`. Hook entry points read stdin and write to stdout (see `src/hooks/_helpers.ts` for utilities).
