import { writeFileSync } from 'fs'
import { defineConfig } from 'tsup'
import pkg from './package.json'

writeFileSync(`./last-build-version.txt`, `v${pkg.version}\n`, 'utf-8')

export default defineConfig({
  entry: ['src/runcheck.ts', 'src/autofixable.ts'],
  clean: true,
  format: ['esm'],
  sourcemap: true,
  esbuildOptions(options) {
    options.mangleProps = /[^_]_$/
  },
})
