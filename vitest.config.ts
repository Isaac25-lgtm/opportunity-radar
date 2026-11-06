import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      include: ['worker/**/*.ts', 'shared/**/*.ts'],
      reporter: ['text-summary', 'text'],
    },
  },
});
