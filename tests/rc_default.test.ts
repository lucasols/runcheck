import { describe, expect, test } from 'vitest'
import { errorResult, successResult } from './testUtils'
import {
  RcType,
  rc_default,
  rc_nullish_default,
  rc_number,
  rc_object,
  rc_parser,
  rc_string,
} from '../src/runcheck'

describe('default', () => {
  const schema: RcType<number> = rc_default(rc_number.optional(), 0)

  const parse = rc_parser(schema)

  test('valid input', () => {
    expect(parse(1)).toEqual(successResult(1))
  })

  test('default value', () => {
    expect(parse(undefined)).toEqual(successResult(0))
  })

  test('invalid inputs', () => {
    expect(parse('1')).toEqual(
      errorResult(`Type 'string' is not assignable to 'number'`),
    )
  })

  test('default null value', () => {
    const schema2: RcType<number | null> = rc_default(
      rc_number.orNullish(),
      null,
    )

    const parse2 = rc_parser(schema2)

    expect(parse2(undefined)).toEqual(successResult(null))
    expect(parse2(null)).toEqual(successResult(null))
  })
})

describe('default obj property', () => {
  const schema = rc_object({
    hello: rc_default(rc_number.optional(), 0),
    test: rc_string,
  })

  const parse = rc_parser(schema)

  test('default value', () => {
    expect(parse({ test: 'test' })).toEqual(
      successResult({ hello: 0, test: 'test' }),
    )
  })
})

describe('nullish default', () => {
  const schema = rc_nullish_default(rc_number.orNullish(), 0)

  const parse = rc_parser(schema)

  test('default value', () => {
    expect(parse(undefined)).toEqual(successResult(0))
    expect(parse(null)).toEqual(successResult(0))
  })
})
