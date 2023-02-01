import { describe, expect, test } from 'vitest'
import { RcType, rc_transform } from '../src/runcheck'
import {
  RcParser,
  rc_parser,
  rc_string,
  rc_object,
  rc_array,
  rc_recursive,
} from '../src/runcheck'
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
