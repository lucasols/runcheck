import { describe, expect, test } from 'vitest'
import {
  RcParseResult,
  RcType,
  rc_array,
  rc_array_filter_from_schema,
  rc_boolean,
  rc_disable_loose_array,
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
          meta_id: rc_number.optional,
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

test('rc_disable_loose_array', () => {
  const looseArray = rc_loose_array(rc_number)

  const result = rc_parse([1, 'sdf', 3], rc_disable_loose_array(looseArray))

  expect(result).toEqual(
    errorResult(`$[1]: Type 'string' is not assignable to 'number'`),
  )

  const looseArrayInsideObject = rc_object({
    a: rc_number,
    b: looseArray,
  })

  const result2 = rc_parse(
    { a: 1, b: [1, 'sdf', 3] },
    rc_disable_loose_array(looseArrayInsideObject),
  )

  expect(result2).toEqual(
    errorResult(`$.b[1]: Type 'string' is not assignable to 'number'`),
  )
})

describe('rc_array_filter_from_schema', () => {
  const schema: RcType<{ value: string }[]> = rc_array_filter_from_schema(
    rc_object({
      deleted: rc_boolean,
    }),
    (item) => !item.deleted,
    rc_object({
      value: rc_string,
    }),
  )

  test('pass', () => {
    const values = [
      { value: 'hello', deleted: false },
      { value: 'world', deleted: true },
      { value: 'test', deleted: false },
    ]

    const result = rc_parse(values, schema)

    expect(result).toEqual(
      successResult([{ value: 'hello' }, { value: 'test' }]),
    )
  })

  test('fail at filter schema', () => {
    const values = [
      { value: 'hello', deleted: false },
      { value: 'world', deleted: 'true' },
      { value: 'test', deleted: false },
    ]

    const result = rc_parse(values, schema)

    expect(result).toEqual(
      errorResult(`$[1].deleted: Type 'string' is not assignable to 'boolean'`),
    )
  })

  test('fail at type schema', () => {
    const values = [
      { value: 'hello', deleted: false },
      { value: 'world', deleted: true },
      { value: 1, deleted: false },
    ]

    const result = rc_parse(values, schema)

    expect(result).toEqual(
      errorResult(`$[2].value: Type 'number' is not assignable to 'string'`),
    )
  })

  test('warning at filter schema', () => {
    const values = [
      { value: 'hello', deleted: false },
      { value: 'world', deleted: 'true' },
      { value: 'test', deleted: false },
    ]

    const result = rc_parse(
      values,
      rc_array_filter_from_schema(
        rc_object({
          deleted: rc_boolean.withFallback(false),
        }),
        (item) => !item.deleted,
        rc_object({
          value: rc_string,
        }),
      ),
    )

    expect(result).toEqual(
      successResult(
        [{ value: 'hello' }, { value: 'world' }, { value: 'test' }],
        [
          `$[1].deleted: Fallback used, errors -> Type 'string' is not assignable to 'boolean'`,
        ],
      ),
    )
  })

  describe('loose mode', () => {
    const looseSchema: RcType<{ value: string }[]> =
      rc_array_filter_from_schema(
        rc_object({
          deleted: rc_boolean,
        }),
        (item) => !item.deleted,
        rc_object({
          value: rc_string,
        }),
        { loose: true },
      )

    test('pass', () => {
      const values = [
        { value: 'hello', deleted: false },
        { value: 'world', deleted: true },
        { value: 'test', deleted: false },
      ]

      const result = rc_parse(values, looseSchema)

      expect(result).toEqual(
        successResult([{ value: 'hello' }, { value: 'test' }]),
      )
    })

    test('fail at filter schema', () => {
      const values = [
        { value: 'hello', deleted: false },
        { value: 'world', deleted: 'true' },
        { value: 'test', deleted: false },
      ]

      const result = rc_parse(values, looseSchema)

      expect(result).toEqual(
        successResult(
          [{ value: 'hello' }, { value: 'test' }],
          [`$[1].deleted: Type 'string' is not assignable to 'boolean'`],
        ),
      )
    })

    test('fail at type schema', () => {
      const values = [
        { value: 'hello', deleted: false },
        { value: 'world', deleted: true },
        { value: 1, deleted: false },
      ]

      const result = rc_parse(values, looseSchema)

      expect(result).toEqual(
        successResult(
          [{ value: 'hello' }],
          [`$[2].value: Type 'number' is not assignable to 'string'`],
        ),
      )
    })
  })
})
