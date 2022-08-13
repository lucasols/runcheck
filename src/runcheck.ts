import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const RE_BRANCH = /^ref: refs\/heads\/(.*)\n/

const root = process.cwd()

function fasterFileExists(filePath: string) {
  return !!fs.statSync(filePath, { throwIfNoEntry: false })?.isFile()
}

function _command(cmd: string, spawnProps: string[]) {
  const result = spawnSync(cmd, spawnProps)

  if (result.status !== 0) {
    throw new Error(
      '[git-rev-sync] failed to execute command: ' +
        result.stderr +
        '/' +
        result.error,
    )
  }

  return result.stdout.toString().replace(/^\s+|\s+$/g, '')
}

function _getGitDirectory(start = root): string {
  const testPath = path.resolve(start, '.git')

  const pathStat = fs.statSync(testPath, { throwIfNoEntry: false })

  if (pathStat?.isDirectory()) {
    return testPath
  }

  const parent = path.resolve(start, '..')

  if (parent === start) {
    throw new Error('[git-rev-sync] failed to find .git directory')
  }

  return _getGitDirectory(parent)
}

export function gitBranch(dir?: string): string {
  const gitDir = _getGitDirectory(dir)

  const head = fs.readFileSync(path.resolve(gitDir, 'HEAD'), 'utf8')
  const b = head.match(RE_BRANCH)

  if (b?.[1]) {
    return b[1]
  }

  return 'Detached: ' + head.trim()
}

function escapeRegex(string: string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export function gitLong(dir?: string) {
  const b = gitBranch(dir)

  if (/Detached: /.test(b)) {
    return b.substring(10)
  }

  const gitDir = _getGitDirectory(dir)

  const gitRootDir = gitDir.includes('.git/worktrees/')
    ? gitDir.replace(/\.git\/worktrees\/.+$/, '.git')
    : gitDir

  const refsFilePath = path.resolve(gitRootDir, 'refs', 'heads', b)

  let ref: string

  if (fasterFileExists(refsFilePath)) {
    ref = fs.readFileSync(refsFilePath, 'utf8')
  } else {
    // If there isn't an entry in /refs/heads for this branch, it may be that
    // the ref is stored in the packfile (.git/packed-refs). Fall back to
    // looking up the hash here.
    const packedRefsPath = path.resolve(gitDir, 'packed-refs')

    if (fasterFileExists(packedRefsPath)) {
      const refToFind = ['refs', 'heads', b].join('/')
      const packfileContents = fs.readFileSync(packedRefsPath, 'utf8')
      const packfileRegex = new RegExp(`(.*) ${escapeRegex(refToFind)}`)

      const match = packfileRegex.exec(packfileContents)?.[1]

      if (!match) {
        throw new Error(`[git-rev-sync] failed to find ref ${refToFind}`)
      }

      ref = match
    } else {
      throw new Error('[git-rev-sync] failed to find packed-refs')
    }
  }

  return ref.trim()
}

export function gitShort({
  dir,
  length = 7,
}: { dir?: string; length?: number } = {}): string {
  return gitLong(dir).substring(0, length)
}

export function gitMessage() {
  return _command('git', ['log', '-1', '--pretty=%B']);
}

export function gitTag(markDirty?: boolean) {
  if (markDirty) {
    return _command('git', ['describe', '--always', '--tag', '--dirty', '--abbrev=0']);
  }

  return _command('git', ['describe', '--always', '--tag', '--abbrev=0']);
}

export function gitTagFirstParent(markDirty?: boolean) {
  if (markDirty) {
    return _command('git', [
      'describe',
      '--always',
      '--tag',
      '--dirty',
      '--abbrev=0',
      '--first-parent',
    ])
  }

  return _command('git', [
    'describe',
    '--always',
    '--tag',
    '--abbrev=0',
    '--first-parent',
  ])
}

export function gitHasUnstagedChanges() {
  const writeTree = _command('git', ['write-tree'])
  return _command('git', ['diff-index', writeTree, '--']).length > 0
}

export function gitIsDirty() {
  return _command('git', ['diff-index', 'HEAD', '--']).length > 0
}

export function gitIsTagDirty() {
  try {
    _command('git', ['describe', '--exact-match', '--tags'])
  } catch (e) {
    if (e instanceof Error && e.message.indexOf('no tag exactly matches')) {
      return true
    }

    throw e
  }
  return false
}

export function gitRemoteUrl() {
  return _command('git', ['ls-remote', '--get-url'])
}

export function gitDate() {
  return new Date(
    _command('git', ['log', '--no-color', '-n', '1', '--pretty=format:"%ad"']),
  )
}

export function gitCount() {
  return parseInt(_command('git', ['rev-list', '--all', '--count']), 10)
}
