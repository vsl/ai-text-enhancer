/**
 * Test Environment Helpers
 * Utilities for setting up test environment variables
 */

export class TestEnv {
  private static originalEnv: NodeJS.ProcessEnv;

  /**
   * Setup test environment with mock services enabled
   */
  static setup(): void {
    TestEnv.originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_MOCK_AUTH = 'true';
    process.env.ALLOW_MOCK_QUOTA = 'true';
  }

  /**
   * Restore original environment
   */
  static teardown(): void {
    if (TestEnv.originalEnv) {
      process.env = TestEnv.originalEnv;
    }
  }
}

/**
 * Use this in test files:
 *
 * beforeAll(() => {
 *   TestEnv.setup();
 * });
 *
 * afterAll(() => {
 *   TestEnv.teardown();
 * });
 */
