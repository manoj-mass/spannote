import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  treeshake: true,
  external: ['react', '@spannote/core', '@spannote/model'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
