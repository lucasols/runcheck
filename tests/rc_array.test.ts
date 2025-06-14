import { describe, expect, test } from 'vitest'
import {
  RcParseResult,
  RcType,
  rc_array,
  rc_array_filter_from_schema,
  rc_boolean,
  rc_disable_loose_array,
  rc_discriminated_union,
  rc_literals,
  rc_loose_array,
  rc_number,
  rc_obj_builder,
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
        [
          `$[1]: Rejected, error -> Type 'number' is not assignable to 'string'`,
        ],
      ),
    )
  })

  test('error msg for rejected object items', () => {
    const schema = rc_loose_array(
      rc_object({
        a: {
          b: {
            c: rc_string,
          },
        },
      }),
    )

    const result = rc_parse(
      [
        { a: { b: { c: 'ok' } } },
        { a: { b: { c: 1 } } },
        { a: { b: { c: 'ok' } } },
      ],
      schema,
    )

    expect(result).toEqual(
      successResult(
        [{ a: { b: { c: 'ok' } } }, { a: { b: { c: 'ok' } } }],
        [
          `$[1]: Rejected, error -> #.a.b.c: Type 'number' is not assignable to 'string'`,
        ],
      ),
    )
  })

  test('error msg for rejected array items', () => {
    const schema = rc_loose_array(rc_array(rc_string))

    const result = rc_parse(
      [
        ['ok', 'world'],
        ['ok', 1],
        ['ok', 'world'],
      ],
      schema,
    )

    expect(result).toEqual(
      successResult(
        [
          ['ok', 'world'],
          ['ok', 'world'],
        ],
        [
          `$[1]: Rejected, error -> #[1]: Type 'number' is not assignable to 'string'`,
        ],
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
      successResult(
        ['1', '2', '3'],
        [`$[1]: Rejected, error -> string value is not unique`],
      ),
    )

    expect(helloParser(['1', '2', '3'])).toMatchInlineSnapshot(
      successResult(['1', '2', '3']),
    )
  })

  test('throw error if invalid type is used with unique key', () => {
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
        [
          `$[1]: Rejected, error -> #.id: Type 'number' with value "1" is not unique`,
        ],
      ),
    )

    expect(helloParser([{ id: 1 }, { id: 2 }, { id: 3 }])).toEqual(
      successResult([{ id: 1 }, { id: 2 }, { id: 3 }]),
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

    const success: RcParseResult<
      { id: number; meta_id: number | undefined }[]
    > = helloParser([{ id: 1 }, { id: 1, meta_id: 4 }, { id: 2 }, { id: 3 }])

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
    const helloParser = rc_parser(rc_tuple([rc_string]))

    const result: RcParseResult<[string]> = helloParser(['hello'])

    expect(result).toEqual(successResult(['hello']))

    expect(helloParser(['hello', 'world'])).toEqual(
      errorResult(`Type 'array' is not assignable to '[string]'`),
    )
  })

  test('input is wrong', () => {
    const result: RcParseResult<[string]> = rc_parse(1, rc_tuple([rc_string]))

    expect(result).toMatchInlineSnapshot(
      errorResult(`Type 'number' is not assignable to '[string]'`),
    )
  })

  test('array element is wrong', () => {
    expect(
      expectParse({
        input: ['ok', 0],
        type: rc_tuple([rc_string, rc_string]),
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
          [
            `$[1]: Rejected, error -> #.deleted: Type 'string' is not assignable to 'boolean'`,
          ],
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
          [
            `$[2]: Rejected, error -> #.value: Type 'number' is not assignable to 'string'`,
          ],
        ),
      )
    })
  })
})

test('reproduce bug in rc_loose_array', () => {
  const fieldSchema = rc_discriminated_union('type', {
    text: {
      format: rc_literals('markdown', 'html'),
    },
    select: {
      options: rc_loose_array(
        rc_obj_builder<{
          value: string
          label: string
        }>()({
          value: rc_string,
          label: rc_string,
        }),
      ),
    },
  })

  const result = rc_parse(
    [
      { type: 'text', format: 'markdown' },
      { type: 'select', options: [{ label: 'world' }] },
    ],
    rc_array(fieldSchema),
  )

  expect(result).toEqual(
    successResult(
      [
        { type: 'text', format: 'markdown' },
        { type: 'select', options: [] },
      ],
      [
        `$[1]|type: select|.options[0]: Rejected, error -> #.value: Type 'undefined' is not assignable to 'string'`,
      ],
    ),
  )
})
