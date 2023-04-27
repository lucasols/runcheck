import { describe, expect, test } from 'vitest'
import {
  RcType,
  rc_number,
  rc_object,
  rc_parse,
  rc_string,
  rc_union,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('rc_union', () => {
  test('throw error on empty inpu', () => {
    expect(() => rc_union()).toThrowError()
  })

  const shape: RcType<string | number> = rc_union(rc_string, rc_number)

  test('pass', () => {
    expect(rc_parse('hello', shape)).toEqual(successResult('hello'))

    expect(rc_parse(1, shape)).toEqual(successResult(1))
  })

  test('fail', () => {
    expect(rc_parse(true, shape)).toEqual(
      errorResult(`Type 'boolean' is not assignable to 'string | number'`),
    )
  })

  test('with fallback', () => {
    const result = rc_parse({}, shape.withFallback('world'))

    expect(result).toEqual(
      successResult('world', [
        "Fallback used, Type 'object' is not assignable to 'string | number'",
      ]),
    )
  })
})

test('limit object union errors to 1', () => {
  const shape = rc_union(
    rc_object({ a: rc_string }),
    rc_object({ b: rc_number }),
    rc_object({ c: rc_number }),
    rc_object({ d: rc_number }),
    rc_object({ e: rc_number }),
    rc_object({ f: rc_number }),
  )

  expect(rc_parse({ a: 1 }, shape)).toEqual(
    errorResult(
      "$|union 1|.a: Type 'number' is not assignable to 'string'",
      'not matches any other union member',
    ),
  )
})

test('circuit break in obj errors', () => {
  const shape = rc_union(
    rc_object({ a: rc_string, b: rc_number }),
    rc_object({ b: rc_number, c: rc_number }),
    rc_object({ c: rc_number, d: rc_number }),
  )

  expect(rc_parse({ a: 1 }, shape)).toEqual(
    errorResult(
      "$|union 1|.a: Type 'number' is not assignable to 'string'",
      'not matches any other union member',
    ),
  )
})

test('show errors with more depth', () => {
  const shape = rc_object({
    obj: rc_union(
      rc_object({ a: rc_string }),
      rc_object({ b: rc_number }),
      rc_object({ c: rc_number }),
      rc_object({ d: rc_number }),
      rc_object({ e: rc_number }),
      rc_object({ a: rc_number, b: rc_number }),
    ),
  })

  expect(rc_parse({ obj: { a: 1 } }, shape)).toEqual(
    errorResult(
      "$.obj|union 6|.b: Type 'undefined' is not assignable to 'number'",
      "$.obj|union 1|.a: Type 'number' is not assignable to 'string'",
      '$.obj: not matches any other union member',
    ),
  )
})
