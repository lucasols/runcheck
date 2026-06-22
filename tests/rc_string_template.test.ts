import { describe, expect, test } from 'vitest'
import {
  RcParseResult,
  rc_parse,
  rc_parser,
  rc_string_contains,
  rc_string_ends_with,
  rc_string_starts_with,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('rc_string_starts_with', () => {
  test('valid input', () => {
    const parser = rc_parser(rc_string_starts_with('user_'))

    const result: RcParseResult<`user_${string}`> = parser('user_42')

    expect(result).toEqual(successResult('user_42'))

    expect(parser('user_')).toEqual(successResult('user_'))
  })

  test('invalid input', () => {
    const parser = rc_parser(rc_string_starts_with('user_'))

    expect(parser('admin_42')).toEqual(
      errorResult(
        "Type 'string(admin_42)' is not assignable to '`user_${string}`'",
      ),
    )

    expect(parser(42)).toEqual(
      errorResult("Type 'number(42)' is not assignable to '`user_${string}`'"),
    )
  })
})

describe('rc_string_ends_with', () => {
  test('valid input', () => {
    const parser = rc_parser(rc_string_ends_with('.png'))

    const result: RcParseResult<`${string}.png`> = parser('avatar.png')

    expect(result).toEqual(successResult('avatar.png'))
  })

  test('invalid input', () => {
    const parser = rc_parser(rc_string_ends_with('.png'))

    expect(parser('avatar.jpg')).toEqual(
      errorResult(
        "Type 'string(avatar.jpg)' is not assignable to '`${string}.png`'",
      ),
    )
  })
})

describe('rc_string_contains', () => {
  test('valid input', () => {
    const parser = rc_parser(rc_string_contains('@'))

    const result: RcParseResult<`${string}@${string}`> = parser('a@b')

    expect(result).toEqual(successResult('a@b'))
  })

  test('invalid input', () => {
    const parser = rc_parser(rc_string_contains('@'))

    expect(parser('ab')).toEqual(
      errorResult("Type 'string(ab)' is not assignable to '`${string}@${string}`'"),
    )
  })
})

describe('composition with shared methods', () => {
  test('optional', () => {
    expect(rc_parse(undefined, rc_string_starts_with('user_').optional())).toEqual(
      successResult(undefined),
    )
  })

  test('withFallback', () => {
    expect(
      rc_parse('admin_42', rc_string_starts_with('user_').withFallback('user_0')),
    ).toEqual(
      successResult('user_0', [
        "Fallback used, errors -> Type 'string(admin_42)' is not assignable to '`user_${string}`'",
      ]),
    )
  })
})
