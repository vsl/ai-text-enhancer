import { orderConfigsForDisplay } from '@/lib/result-order';
import { DEFAULT_WORKFLOWS } from '@/lib/constants';
import type { AiConfig, Result } from '@/lib/types';
import type { BatchSelection } from '../../../backend/src/types/api.types';

const base = DEFAULT_WORKFLOWS[0].configs[0];
const configs: AiConfig[] = [1, 2, 3, 4].map(id => ({ ...base, id }));
const results = new Map<number, Result>([
  [1, { configId: 1, text: 'one', isLoading: false }],
  [2, { configId: 2, text: 'two', isLoading: false }],
  [3, { configId: 3, text: 'error', error: true, isLoading: false }],
]);
const selection: BatchSelection = {
  status: 'success', judge: 'jev', model: 'typesafe/jev-1.13',
  selectedResultId: '2', confidence: 0.6, probabilities: { '1': 0.4, '2': 0.6 },
};

test('orders current results by Jev preference without mutating the workflow', () => {
  expect(orderConfigsForDisplay(configs, results, selection).map(c => c.id)).toEqual([2, 1, 3, 4]);
  expect(configs.map(c => c.id)).toEqual([1, 2, 3, 4]);
});

test('preserves workflow order for ties and non-success selections', () => {
  const ties = { ...selection, selectedResultId: '1', probabilities: { '1': 0.5, '2': 0.5 } };
  expect(orderConfigsForDisplay(configs, results, ties).map(c => c.id)).toEqual([1, 2, 3, 4]);
  for (const status of [undefined, { status: 'skipped', reason: 'NOT_ENOUGH_VALID_RESULTS' }, { status: 'unavailable', reason: 'JUDGE_FAILED' }] as const) {
    expect(orderConfigsForDisplay(configs, results, status as BatchSelection | undefined)).toBe(configs);
  }
});

test('keeps original order among equal non-selected candidates', () => {
  const allResults = new Map(results);
  allResults.set(3, { configId: 3, text: 'three', isLoading: false });
  const chosen = { ...selection, selectedResultId: '3', probabilities: { '1': 0.3, '2': 0.3, '3': 0.4 } };
  expect(orderConfigsForDisplay(configs, allResults, chosen).map(c => c.id)).toEqual([3, 1, 2, 4]);
});

test('preserves order with no winner and all results at zero', () => {
  const rejected = { ...selection, selectedResultId: null, probabilities: { '1': 0, '2': 0 } };
  expect(orderConfigsForDisplay(configs, results, rejected).map(c => c.id)).toEqual([1, 2, 3, 4]);
});
