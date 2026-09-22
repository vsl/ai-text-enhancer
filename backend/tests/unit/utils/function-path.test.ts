import { getFunctionPath } from '../../../src/utils/function-path.ts';

describe('getFunctionPath', () => {
  it.each([
    ['/functions/v1/enhance', 'enhance', '/'],
    ['/functions/v1/enhance/health', 'enhance', '/health'],
    ['/me/health', 'me', '/health'],
    ['/functions/v1/admin/users/123', 'admin', '/users/123'],
    ['/health', 'enhance', '/health'],
  ])('normalizes %s', (pathname, functionName, expected) => {
    expect(getFunctionPath(pathname, functionName)).toBe(expected);
  });
});
