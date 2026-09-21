describe('runtime configuration', () => {
  it('fails fast when a public environment value is missing', () => {
    const value = process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    jest.resetModules();

    expect(() => require('../../src/lib/runtime-config')).toThrow('NEXT_PUBLIC_API_BASE_URL is required');

    process.env.NEXT_PUBLIC_API_BASE_URL = value;
    jest.resetModules();
  });
});
