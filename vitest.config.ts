import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  // SWC: esbuild no emite los metadatos de decoradores que NestJS necesita para
  // inyectar dependencias en las pruebas e2e.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    testTimeout: 15_000,
    setupFiles: ['./test/preparar.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.module.ts', 'src/**/index.ts', 'src/**/dto/**', 'src/main.ts'],
      reporter: ['text', 'lcov'],
      // El umbral del Diccionario de la EDT, igual que en el backend.
      thresholds: { statements: 80, lines: 80, functions: 80, branches: 70 },
    },
  },
});
