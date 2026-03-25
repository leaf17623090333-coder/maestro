/**
 * Factory wrapper for FsHandoffAdapter.
 */

import { FsHandoffAdapter } from '../../../../adapters/handoff/fs-adapter.ts';
import type { AdapterContext, AdapterFactory } from '../../../types.ts';
import type { HandoffPort } from '../../../../../domain/ports/handoff.ts';
import type { TaskPort } from '../../../../../domain/ports/task.ts';
import type { MemoryPort } from '../../../../../domain/ports/memory.ts';

export const createAdapter: AdapterFactory<HandoffPort> = (ctx: AdapterContext) => {
  const taskPort = ctx.ports.taskPort as TaskPort;
  const memoryPort = ctx.ports.memoryPort as MemoryPort;
  return new FsHandoffAdapter(ctx.projectRoot, taskPort, memoryPort);
};
