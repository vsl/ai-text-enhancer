/**
 * Test Environment Helpers
 * Utilities for setting up test environment variables
 */

export class TestEnv {
  private static originalEnv: NodeJS.ProcessEnv;

  /**
   * Save and restore the test environment
   */
  static setup(): void {
    TestEnv.originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
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
