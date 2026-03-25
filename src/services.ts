/**
 * Thin compatibility shim over container.ts.
 *
 * citty doesn't propagate parent context to subcommands, so CLI handlers
 * call getServices(). This shim preserves that pattern while delegating
 * to the immutable createContainer() factory.
 *
 * New code should import from container.ts directly.
 */

import { createContainer, type MaestroContainer } from './container.ts';
import type { ToolboxRegistry } from './infra/toolbox/registry.ts';
import { MaestroError } from './domain/errors.ts';

export type MaestroServices = MaestroContainer;

let _services: MaestroContainer | undefined;

export function initServices(
  directory: string,
  toolbox?: ToolboxRegistry,
): MaestroServices {
  _services = createContainer(directory, toolbox);
  return _services;
}

export function getServices(): MaestroServices {
  if (!_services) {
    throw new MaestroError(
      'Services not initialized',
      ['Run maestro from a project directory with .maestro/ or run: maestro init'],
    );
  }
  return _services;
}
