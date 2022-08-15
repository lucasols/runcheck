import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/runcheck.ts', 'src/autofixable.ts'],
  clean: true,
  format: ['cjs', 'esm'],
  esbuildOptions(options) {
    options.mangleProps = /[^_]_$/
  },
})
