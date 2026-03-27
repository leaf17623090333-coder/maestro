/**
 * Re-export barrel -- preserves backward compatibility for app-layer consumers.
 * Canonical definitions live in domain/task-transitions.ts.
 */
export {
  VALID_TRANSITIONS,
  isValidTransition,
  isActiveTask,
  isDependencySatisfied,
} from '../../domain/task-transitions.ts';
