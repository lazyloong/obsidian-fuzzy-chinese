import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      obsidian: resolve(__dirname, 'tests/__mocks__/obsidian.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
  bench: {
    include: ['bench/**/*.bench.ts'],
  },
});
