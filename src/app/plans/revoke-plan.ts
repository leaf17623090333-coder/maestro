import type { TaskPort } from '../../domain/ports/task.ts';
import type { PlanPort } from '../../domain/ports/plan.ts';
import type { FeaturePort } from '../../domain/ports/feature.ts';
import { MaestroError } from '../../domain/errors.ts';

export interface RevokePlanDeps {
  planAdapter: PlanPort;
  featureAdapter: FeaturePort;
  taskPort: TaskPort;
}

export async function revokePlan(
  deps: RevokePlanDeps,
  feature: string,
): Promise<{ feature: string; revoked: boolean }> {
  if (!deps.planAdapter.isApproved(feature)) {
    throw new MaestroError(`Plan for '${feature}' is not approved`, [
      'Only approved plans can be revoked',
    ]);
  }

  const allTasks = await deps.taskPort.list(feature, { includeAll: true });
  const activeTasks = allTasks.filter(t =>
    t.status === 'claimed' || t.status === 'review' || t.status === 'revision',
  );
  if (activeTasks.length > 0) {
    const activeList = activeTasks.map(t => `${t.id} [${t.status}]`).join(', ');
    throw new MaestroError(
      `Cannot revoke: ${activeTasks.length} task(s) are actively being worked`,
      [`Active tasks: ${activeList}`, 'Wait for active tasks to complete or block them first'],
    );
  }

  deps.planAdapter.revokeApproval(feature);
  deps.featureAdapter.updateStatus(feature, 'planning');
  return { feature, revoked: true };
}
