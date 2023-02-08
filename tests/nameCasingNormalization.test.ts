import { expect, test } from 'vitest'
import { snakeCase } from '../src/runcheck'

test.each([
  ['hello_world', 'hello_world'],
  ['userId', 'user_id'],
  ['oldName', 'old_name'],
  ['name', 'name'],
  ['name-case', 'name_case'],
  ['oldNameOk', 'old_name_ok'],
])('convert to snake_case', (a, expected) => {
  expect(snakeCase(a)).toBe(expected)
})
