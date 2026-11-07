import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html'],
      // Gemessen wird die reine Logik (Darstellung wird per E2E-Browsertest geprüft)
      include: ['src/math/**/*.ts', 'src/modules/**/math.ts', 'src/modules/**/steps.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
} as any);
