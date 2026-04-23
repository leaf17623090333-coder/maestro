import type { HandoffRecord } from "./handoff-types.js";
import { resolveMaestroProjectRoot } from "@/shared/lib/project-root.js";

export function resolveHandoffProjectRoot(
  record: Pick<HandoffRecord, "refs" | "sourceDir">,
): string {
  return record.refs.projectRoot ?? resolveMaestroProjectRoot(record.sourceDir);
}

export function isHandoffInProject(
  record: Pick<HandoffRecord, "refs" | "sourceDir">,
  projectRoot: string,
): boolean {
  return resolveHandoffProjectRoot(record) === projectRoot;
}
