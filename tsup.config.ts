import { defineConfig } from 'tsup'
import pkg from './package.json'
import { writeFileSync } from 'fs'

writeFileSync(`./last-build-version.txt`, `v${pkg.version}\n`, 'utf-8')

export default defineConfig({
  entry: ['src/runcheck.ts', 'src/autofixable.ts'],
  clean: true,
  format: ['cjs', 'esm'],
  esbuildOptions(options) {
    options.mangleProps = /[^_]_$/
  },
})
