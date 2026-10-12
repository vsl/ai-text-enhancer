import { parseStoredWorkflows } from '@/lib/workflow-config';
import { DEFAULT_WORKFLOWS } from '@/config/workflows.config';

describe('stored workflow boundary', () => {
  it('accepts current workflows and explicit empty storage', () => {
    expect(parseStoredWorkflows(JSON.parse(JSON.stringify(DEFAULT_WORKFLOWS)))).toEqual(DEFAULT_WORKFLOWS);
    expect(parseStoredWorkflows([])).toEqual([]);
  });
  it.each([null, {}, [{ name: 'Bad', configs: null }],
    [{ name: 'Old', configs: [{ id: 1, model: 'open-router-free', aiRole: 'General Assistant', options: {}, enabled: true }] }],
    [DEFAULT_WORKFLOWS[0], DEFAULT_WORKFLOWS[0]],
    [{ name: 'Duplicates', configs: [DEFAULT_WORKFLOWS[0].configs[0], DEFAULT_WORKFLOWS[0].configs[0]] }],
  ])('rejects malformed or obsolete storage %#', value => {
    expect(() => parseStoredWorkflows(value)).toThrow();
  });
});
