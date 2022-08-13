import { expect, test } from 'vitest'
import * as git from '../src'

test('short() returns string of length 4+', () => {
  expect(git.gitShort().length > 3).toBeTruthy()

  expect(
    git.gitShort({
      length: 8,
    }).length,
  ).toBe(8)
})

test('long() returns string of length 39+', () => {
  const result = git.gitLong()

  expect(result.length > 38).toBeTruthy()
})

test('branch() returns a string with non-zero length', () => {
  const result = git.gitBranch()

  expect(!!result).toBeTruthy()
})

test('count() returns a non-zero number', () => {
  const result = git.gitCount()

  expect(result).toBeGreaterThan(0)
})

test('count() returns a positive number', () => {
  const result = git.gitCount()

  expect(result).toBeGreaterThanOrEqual(0)
})

test('date() returns a date', () => {
  const result = git.gitDate()

  expect(result instanceof Date).toBeTruthy()
})

test('isDirty() returns a boolean', () => {
  const result = git.gitIsDirty()

  expect(typeof result).toBe('boolean')
})

test('isTagDirty() returns a boolean', () => {
  const result = git.gitIsTagDirty()

  expect(typeof result).toBe('boolean')
})

test('message() returns a string with non-zero length', () => {
  const result = git.gitMessage()

  expect(!!result.length).toBeTruthy()
})

test('tag() returns a string with non-zero length', () => {
  const result = git.gitTag()

  expect(!!result.length).toBeTruthy()
})

test('tagFirstParent() returns a string with non-zero length', () => {
  const result = git.gitTagFirstParent()

  expect(!!result.length).toBeTruthy()
})

test('remoteUrl() works', () => {
  const result = git.gitRemoteUrl()

  expect(
    result.includes('https://github.com') || result.includes('git@github.com'),
  ).toBeTruthy()
})
