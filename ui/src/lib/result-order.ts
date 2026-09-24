import type { AiConfig, Result } from './types';
import type { BatchSelection } from '../../../backend/src/types/api.types';

/** Jev changes only the current presentation; the workflow array stays untouched. */
export function orderConfigsForDisplay(configs: AiConfig[], results: Map<number, Result>, selection?: BatchSelection): AiConfig[] {
  if (selection?.status !== 'success') return configs;
  const rank = (config: AiConfig) => {
    const result = results.get(config.id);
    return result && !result.error && !result.isLoading && selection.probabilities[config.id.toString()] !== undefined
      ? 0 : result && !result.isLoading ? 1 : 2;
  };
  return [...configs].sort((a, b) => {
    const group = rank(a) - rank(b);
    if (group) return group;
    if (rank(a) === 0) {
      if (a.id.toString() === selection.selectedResultId) return -1;
      if (b.id.toString() === selection.selectedResultId) return 1;
      return selection.probabilities[b.id.toString()] - selection.probabilities[a.id.toString()];
    }
    return 0;
  });
}
