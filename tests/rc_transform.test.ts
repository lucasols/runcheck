import { describe, expect, test } from 'vitest'
import {
  RcType,
  rc_array,
  rc_number,
  rc_parse,
  rc_transform,
} from '../src/runcheck'
import { RcParser, rc_parser, rc_string, rc_object } from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('valid and invalid inputs', () => {
  const schema: RcType<number> = rc_transform(rc_string, (s) => s.length)

  const parse: RcParser<number> = rc_parser(schema)

  test('valid input', () => {
    const input = 'hello'

    expect(parse(input)).toEqual(successResult(input.length))
  })

  test('invalid inputs', () => {
    const input = 1

    expect(parse(input)).toEqual(
      errorResult(`Type 'number' is not assignable to 'string'`),
    )
  })
})

test('transform obj property', () => {
  const schema = rc_object({
    hello: rc_transform(rc_string, (s) => s.length),
    test: rc_string,
    str_to_arr: rc_transform(rc_string, (s) => s.split('')),
  })

  const parse = rc_parser(schema)

  const input = { hello: 'world', test: 'test', str_to_arr: 'hello' }

  expect(parse(input)).toEqual(
    successResult({
      hello: 5,
      test: 'test',
      str_to_arr: ['h', 'e', 'l', 'l', 'o'],
    }),
  )
})

describe('transform output validation', () => {
  const schema = rc_object({
    hello: rc_transform(rc_string, (s) => s.length, {
      outputSchema: rc_number,
    }),
    test: rc_string,
    str_to_arr: rc_transform(rc_string, (s) => s.split(''), {
      outputSchema: rc_array(rc_string),
    }),
  })

  const parse = rc_parser(schema)

  const expectedResult = {
    hello: 5,
    test: 'test',
    str_to_arr: ['h', 'e', 'l', 'l', 'o'],
  }

  test('validates input', () => {
    const input = { hello: 'world', test: 'test', str_to_arr: 'hello' }

    expect(parse(input)).toEqual(successResult(expectedResult))
  })

  test('validates output', () => {
    expect(parse(expectedResult)).toEqual(successResult(expectedResult))
  })

  test('invalid value', () => {
    const input = { hello: 'world', test: 'test', str_to_arr: 1 }

    expect(parse(input)).toEqual(
      errorResult(
        `$.str_to_arr: Type 'number' is not assignable to 'string'`,
        `$.str_to_arr|output|: Type 'number' is not assignable to 'string[]'`,
      ),
    )
  })

  test('invalid value at type root', () => {
    const schema2 = rc_transform(rc_string, (s) => s.length, {
      outputSchema: rc_number,
    })

    expect(rc_parse({}, schema2)).toEqual(
      errorResult(
        `Type 'object' is not assignable to 'string'`,
        `$|output|: Type 'object' is not assignable to 'number'`,
      ),
    )
  })
})
