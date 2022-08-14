import { describe, expect, test } from 'vitest'
import { rc_boolean, rc_number, rc_parse, rc_string } from '../src/runcheck'
import { successResult } from './testUtils'

describe('fallback', () => {
  test('fallback pass check but, return warnings', () => {
    const result = rc_parse(1, rc_string.withFallback('world'))

    expect(result).toEqual(
      successResult('world', [
        "Fallback used, Type 'number' is not assignable to 'string'",
      ]),
    )
  })
})

describe('autofix', () => {
  test('fix number to string', () => {
    const result = rc_parse(1, rc_string.withAutofix())

    expect(result).toEqual(
      successResult('1', [
        "Autofixed from, Type 'number' is not assignable to 'string'",
      ]),
    )
  })

  test('use a custom implementation', () => {
    const result = rc_parse(
      1,
      rc_boolean.withAutofix(() => {
        return { fixed: true }
      }),
    )

    expect(result).toEqual(
      successResult(true, [
        "Autofixed from, Type 'number' is not assignable to 'boolean'",
      ]),
    )
  })

  test('fix a string to number', () => {
    const result = rc_parse('1', rc_number.withAutofix())

    expect(result).toEqual(
      successResult(1, [
        "Autofixed from, Type 'string' is not assignable to 'number'",
      ]),
    )
  })
})
