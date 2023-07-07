import { describe, expect, test } from 'vitest'
import {
  RcParseResult,
  rc_array,
  rc_loose_array,
  rc_number,
  rc_object,
  rc_parse,
  rc_parser,
  rc_string,
  rc_tuple,
} from '../src/runcheck'
import { errorResult, expectParse, successResult } from './testUtils'

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

describe('rc_loose_array', () => {
  test('success', () => {
    const helloParser = rc_parser(rc_loose_array(rc_string))

    const result: RcParseResult<string[]> = helloParser(['hello'])

    expect(result).toEqual(successResult(['hello']))

    expect(helloParser(['hello', 'world'])).toMatchInlineSnapshot(
      successResult(['hello', 'world']),
    )
  })

  test('just reject the wrong items', () => {
    const helloParser = rc_parser(rc_loose_array(rc_string))

    const result: RcParseResult<string[]> = helloParser(['hello', 1, 'ok'])

    expect(result).toEqual(
      successResult(
        ['hello', 'ok'],
        [`$[1]: Type 'number' is not assignable to 'string'`],
      ),
    )
  })
})

describe('array unique', () => {
  test('strict mode for an array of primitives', () => {
    const helloParser = rc_parser(rc_array(rc_string, { unique: true }))

    const wrongResult: RcParseResult<string[]> = helloParser([
      '1',
      '1',
      '2',
      '3',
    ])

    expect(wrongResult).toEqual(errorResult(`$[1]: string value is not unique`))

    expect(helloParser(['1', '2', '3'])).toMatchInlineSnapshot(
      successResult(['1', '2', '3']),
    )
  })

  test('loose mode for an array of primitives', () => {
    const helloParser = rc_parser(rc_loose_array(rc_string, { unique: true }))

    const wrongResult: RcParseResult<string[]> = helloParser([
      '1',
      '1',
      '2',
      '3',
    ])

    expect(wrongResult).toEqual(
      successResult(['1', '2', '3'], [`$[1]: string value is not unique`]),
    )

    expect(helloParser(['1', '2', '3'])).toMatchInlineSnapshot(
      successResult(['1', '2', '3']),
    )
  })

  test('trhow error if invalid type is used with unique key', () => {
    // @ts-expect-error invalid type
    expect(rc_parser(rc_array(rc_number, { unique: 'id' }))).not.throw()
  })

  test('array of objects', () => {
    const helloParser = rc_parser(
      rc_array(
        rc_object({
          id: rc_number,
        }),
        { unique: 'id' },
      ),
    )

    const wrongResult: RcParseResult<{ id: number }[]> = helloParser([
      { id: 1 },
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ])

    expect(wrongResult).toEqual(
      errorResult(`$[1].id: Type 'number' with value "1" is not unique`),
    )

    expect(
      helloParser([{ id: 1 }, { id: 2 }, { id: 3 }]),
    ).toMatchInlineSnapshot(successResult([{ id: 1 }, { id: 2 }, { id: 3 }]))
  })

  test('loose mode for an array of objects', () => {
    const helloParser = rc_parser(
      rc_loose_array(
        rc_object({
          id: rc_number,
        }),
        { unique: 'id' },
      ),
    )

    const looseResult: RcParseResult<{ id: number }[]> = helloParser([
      { id: 1 },
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ])

    expect(looseResult).toEqual(
      successResult(
        [{ id: 1 }, { id: 2 }, { id: 3 }],
        [`$[1].id: Type 'number' with value "1" is not unique`],
      ),
    )

    expect(helloParser([{ id: 1 }, { id: 2 }, { id: 3 }])).toEqual(
      successResult([{ id: 1 }, { id: 2 }, { id: 3 }]),
    )
  })

  test('trhow error if all elements are invalid', () => {
    const helloParser = rc_parser(
      rc_loose_array(
        rc_object({
          id: rc_string,
        }),
        { unique: 'id' },
      ),
    )

    const looseResult: RcParseResult<{ id: string }[]> = helloParser([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ])

    expect(looseResult).toEqual(
      errorResult(
        `$[0].id: Type 'number' is not assignable to 'string'`,
        `$[1].id: Type 'number' is not assignable to 'string'`,
        `$[2].id: Type 'number' is not assignable to 'string'`,
      ),
    )
  })

  test('strict mode for an array of objects, with getId fn', () => {
    const helloParser = rc_parser(
      rc_array(
        rc_object({
          id: rc_number,
          meta_id: rc_number.optional(),
        }),
        { unique: (item) => item.meta_id ?? item.id },
      ),
    )

    const success: RcParseResult<{ id: number }[]> = helloParser([
      { id: 1 },
      { id: 1, meta_id: 4 },
      { id: 2 },
      { id: 3 },
    ])

    expect(success).toEqual(
      successResult([{ id: 1 }, { id: 1, meta_id: 4 }, { id: 2 }, { id: 3 }]),
    )

    const error = helloParser([
      { id: 1 },
      { id: 1, meta_id: 4 },
      { id: 1, meta_id: 4 },
      { id: 3 },
    ])

    expect(error).toMatchInlineSnapshot(
      errorResult(
        `$[2]: Type 'object' unique fn return with value "4" is not unique`,
      ),
    )
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

test('rc_object array with excess keys', () => {
  const result = rc_parse(
    [{ a: 1, b: 2, c: 3, d: 4 }],
    rc_array(
      rc_object({
        a: rc_number,
        b: rc_number,
      }),
    ),
  )

  expect(result).toEqual(successResult([{ a: 1, b: 2 }]))
})
