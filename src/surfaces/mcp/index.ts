/**
 * MCP server entry point for maestro.
 * Tool handlers removed (Phase 5b) -- server shell kept for plugin recognition and hooks.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VERSION } from '../../version.ts';

export function createMaestroServer(_directory: string): McpServer {
  const server = new McpServer({
    name: 'maestro',
    version: VERSION,
  });

  // No tools registered -- empty tools list returned to ListTools requests.
  // The server shell is kept so Claude Code still recognizes the plugin and fires hooks.

  return server;
}

export async function main() {
  const directory = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const server = createMaestroServer(directory);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only auto-start when run directly, not when imported by start.mjs
const isBunDirect = typeof Bun !== 'undefined' && Bun.main === Bun.resolveSync(import.meta.path, '.');
if (isBunDirect) {
  main().catch((err) => {
    console.error('[maestro] Server failed to start:', err);
    process.exit(1);
  });
}
