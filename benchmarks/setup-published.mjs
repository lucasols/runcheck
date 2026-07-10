import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const publishedDir = join(dirname(fileURLToPath(import.meta.url)), 'published')
const installedPkgPath = join(
  publishedDir,
  'node_modules',
  'runcheck',
  'package.json',
)

const latestVersion = execSync('npm view runcheck version', {
  encoding: 'utf8',
}).trim()

const installedVersion =
  existsSync(installedPkgPath) ?
    JSON.parse(readFileSync(installedPkgPath, 'utf8')).version
  : null

if (installedVersion === latestVersion) {
  console.log(`Published runcheck@${latestVersion} already installed`)
} else {
  console.log(`Installing published runcheck@${latestVersion}...`)

  mkdirSync(publishedDir, { recursive: true })

  execSync(
    `npm install runcheck@${latestVersion} --no-save --no-audit --no-fund --no-package-lock`,
    { cwd: publishedDir, stdio: 'inherit' },
  )
}
