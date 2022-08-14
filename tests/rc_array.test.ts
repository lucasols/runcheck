import { beforeAll, describe, expect, test } from 'vitest'
import {
  RcParseResult,
  rc_array,
  rc_parse,
  rc_parser,
  rc_string,
  rc_tuple,
} from '../src/runcheck'
import { dedent, errorResult, expectParse, successResult } from './testUtils'

describe('rc_array', () => {
  test('basic check', () => {
    const helloParser = rc_parser(rc_array(rc_string))

    const result: RcParseResult<string[]> = helloParser(['hello'])

    expect(result).toEqual(successResult(['hello']))

    expect(helloParser(['hello', 'world'])).toMatchInlineSnapshot(
      successResult(['hello', 'world']),
    )
  })

  test('input is wrong', () => {
    const result: RcParseResult<string[]> = rc_parse(1, rc_array(rc_string))

    expect(result).toMatchInlineSnapshot(
      errorResult(`Type 'number' is not assignable to 'string[]'`),
    )
  })

  test('array element is wrong', () => {
    expect(
      expectParse({ input: ['ok', 0], type: rc_array(rc_string) }),
    ).toEqual(errorResult(`$[1]: Type 'number' is not assignable to 'string'`))
  })
})

describe('rc_tuple', () => {
  test('basic check', () => {
    const helloParser = rc_parser(rc_tuple([rc_string] as const))

    const result: RcParseResult<[string]> = helloParser(['hello'])

    expect(result).toEqual(successResult(['hello']))

    expect(helloParser(['hello', 'world'])).toEqual(
      errorResult(`Type 'array' is not assignable to '[string]'`),
    )
  })

  test('input is wrong', () => {
    const result: RcParseResult<[string]> = rc_parse(
      1,
      rc_tuple([rc_string] as const),
    )

    expect(result).toMatchInlineSnapshot(
      errorResult(`Type 'number' is not assignable to '[string]'`),
    )
  })

  test('array element is wrong', () => {
    expect(
      expectParse({
        input: ['ok', 0],
        type: rc_tuple([rc_string, rc_string] as const),
      }),
    ).toEqual(errorResult(`$[1]: Type 'number' is not assignable to 'string'`))
  })
})
