import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/runcheck.ts', 'src/autofixable.ts'],
  clean: true,
  outDir: 'dist-test',
  sourcemap: true,
  format: ['esm'],
})
