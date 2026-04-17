import type { OutcomeContext } from "./context.js";
import type { PreparedWorkerOutcome } from "./worker-outcome/types.js";

/**
 * Retry supervision port. Owns the post-outcome decision of whether to retry,
 * exhaust, or hard-fail a worker run. Lives in its own port file so that both
 * `context.ts` (which exposes it on OutcomeContext) and `retry-coordinator.ts`
 * (which implements it) can import the contract without a circular dependency.
 */
export interface RetryCoordinator {
  dispatch(ctx: OutcomeContext, prepared: PreparedWorkerOutcome): Promise<void>;
  cancel(issueId: string): void;
}
