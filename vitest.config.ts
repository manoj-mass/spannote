import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@spannote/model': src('model'),
      '@spannote/anchor': src('anchor'),
      '@spannote/render': src('render'),
      '@spannote/protocol': src('protocol'),
      '@spannote/core': src('core'),
      '@spannote/react': src('react'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['packages/*/test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});
