import type { RunnerAdvanceCause } from '../../utils/runnerLifecycle';

export interface ActiveRunnerChip {
  inning: number;
  base: 1 | 2 | 3;
  sb: number;
  cause: RunnerAdvanceCause;
  subNumber?: string;
}
