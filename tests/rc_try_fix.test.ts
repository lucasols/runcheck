import { describe, expect, test } from 'vitest'
import { rc_number_autofix } from '../src/autofixable'
import {
  rc_intersection,
  rc_number,
  rc_object,
  rc_parse,
  rc_string,
  rc_try_fix,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('rc_try_fix', () => {
  test('valid input passes without calling the fix function', () => {
    let called = false
    const schema = rc_try_fix(rc_string, () => {
      called = true
      return false
    })

    const result = rc_parse('hello', schema)

    expect(result).toEqual(successResult('hello'))
    expect(called).toBe(false)
  })

  test('fixed input passes with previous errors reported as warnings', () => {
    const schema = rc_try_fix(rc_string, (input) => ({ fixed: String(input) }))

    const result = rc_parse(1, schema)

    expect(result).toEqual(
      successResult('1', [
        `Fixed error -> Type 'number' is not assignable to 'string'`,
      ]),
    )
  })

  test('fix function returning false returns the original errors', () => {
    const schema = rc_try_fix(rc_string, () => false)

    const result = rc_parse(1, schema)

    expect(result).toEqual(
      errorResult(`Type 'number' is not assignable to 'string'`),
    )
  })

  test('invalid fixed value returns the original errors, fix is attempted only once', () => {
    let calls = 0
    const schema = rc_try_fix(rc_string, () => {
      calls++
      return { fixed: 2 }
    })

    const result = rc_parse(true, schema)

    expect(result).toEqual(
      errorResult(`Type 'boolean' is not assignable to 'string'`),
    )
    expect(calls).toBe(1)
  })

  test('fix function receives the input and the errors and warnings of the failed parse', () => {
    let receivedInput: unknown
    let receivedErrors: string[] = []
    let receivedWarnings: string[] = []
    const schema = rc_try_fix(
      rc_object({ a: rc_number_autofix, b: rc_number }),
      (input, { errors, warnings }) => {
        receivedInput = input
        receivedErrors = errors
        receivedWarnings = warnings
        return false
      },
    )

    rc_parse({ a: '1', b: 'x' }, schema)

    expect(receivedInput).toEqual({ a: '1', b: 'x' })
    expect(receivedErrors).toEqual([
      `$.b: Type 'string' is not assignable to 'number'`,
    ])
    expect(receivedWarnings).toEqual([
      `$.a: Autofixed from error -> Type 'string' is not assignable to 'number'`,
    ])
  })

  test('warnings from the discarded first parse are not duplicated', () => {
    const schema = rc_try_fix(
      rc_object({ a: rc_number_autofix, b: rc_number }),
      (input) => {
        if (typeof input === 'object' && input !== null) {
          return { fixed: { ...input, b: 0 } }
        }
        return false
      },
    )

    const result = rc_parse({ a: '1', b: 'x' }, schema)

    expect(result).toEqual(
      successResult({ a: 1, b: 0 }, [
        `$.b: Fixed error -> Type 'string' is not assignable to 'number'`,
        `$.a: Autofixed from error -> Type 'string' is not assignable to 'number'`,
      ]),
    )
  })

  test('nested rc_try_fix reports warnings with paths', () => {
    const schema = rc_object({
      value: rc_try_fix(rc_number, (input) => ({ fixed: Number(input) })),
    })

    const result = rc_parse({ value: '42' }, schema)

    expect(result).toEqual(
      successResult({ value: 42 }, [
        `$.value: Fixed error -> Type 'string' is not assignable to 'number'`,
      ]),
    )
  })

  test('fix a stringified json input', () => {
    const schema = rc_try_fix(
      rc_object({ name: rc_string, age: rc_number }),
      (input) => {
        if (typeof input === 'string') {
          const parsed: unknown = JSON.parse(input)
          return { fixed: parsed }
        }
        return false
      },
    )

    const result = rc_parse('{"name":"John","age":30}', schema)

    expect(result).toEqual(
      successResult({ name: 'John', age: 30 }, [
        `Fixed error -> Type 'string' is not assignable to 'object{ name: string, age: number }'`,
      ]),
    )
  })

  test('fix is not attempted with noWarnings option', () => {
    let called = false
    const schema = rc_try_fix(rc_string, () => {
      called = true
      return { fixed: 'fixed' }
    })

    const result = rc_parse(1, schema, { noWarnings: true })

    expect(result).toEqual(
      errorResult(`Type 'number' is not assignable to 'string'`),
    )
    expect(called).toBe(false)
  })

  test('modifiers can be chained after rc_try_fix', () => {
    const schema = rc_try_fix(rc_string, () => false).withFallback('fallback')

    const result = rc_parse(1, schema)

    expect(result).toEqual(
      successResult('fallback', [
        `Fallback used, errors -> Type 'number' is not assignable to 'string'`,
      ]),
    )
  })

  test('wrapped object schemas keep working inside rc_intersection', () => {
    const schema = rc_intersection(
      rc_try_fix(rc_object({ a: rc_number }), (input) => {
        if (typeof input === 'object' && input !== null && 'a' in input) {
          return { fixed: { ...input, a: Number(input.a) } }
        }
        return false
      }),
      rc_object({ b: rc_string }),
    )

    // valid input, the fix never fires: data of both members must be merged
    expect(rc_parse({ a: 1, b: 'x' }, schema)).toEqual(
      successResult({ a: 1, b: 'x' }),
    )

    // invalid input: the fixed member data must be merged
    expect(rc_parse({ a: '1', b: 'x' }, schema)).toEqual(
      successResult({ a: 1, b: 'x' }, [
        `$.a: Fixed error -> Type 'string' is not assignable to 'number'`,
      ]),
    )
  })

  test('optional chained after rc_try_fix skips the fix function', () => {
    let called = false
    const schema = rc_object({
      value: rc_try_fix(rc_string, () => {
        called = true
        return false
      }).optional(),
    })

    const result = rc_parse({}, schema)

    expect(result).toEqual(successResult({ value: undefined }))
    expect(called).toBe(false)
  })
})
