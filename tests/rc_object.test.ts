import { describe, expect, test } from 'vitest'
import {
  RcParseResult,
  rc_array,
  rc_assert_is_valid,
  rc_extends_obj,
  rc_get_obj_schema,
  rc_literals,
  rc_loose_array,
  rc_number,
  rc_obj_intersection,
  rc_obj_omit,
  rc_obj_pick,
  rc_object,
  rc_parse,
  rc_parser,
  rc_rename_from_key,
  rc_strict_obj,
  rc_string,
  rc_transform,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('rc_object', () => {
  test('pass', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      { hello: 'world' },
      rc_object({ hello: rc_string }),
    )

    expect(result).toEqual(successResult({ hello: 'world' }))
  })

  test('input is wrong', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      1,
      rc_object({ hello: rc_string }),
    )

    expect(result).toEqual(
      errorResult(`Type 'number' is not assignable to 'object'`),
    )
  })

  test('input is wrong with fallback', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      1,
      rc_object({ hello: rc_string }).withFallback({ hello: 'world' }),
    )

    expect(result).toEqual(
      successResult({ hello: 'world' }, [
        `Fallback used, errors -> Type 'number' is not assignable to 'object'`,
      ]),
    )
  })

  test('input property is wrong', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      { hello: 1 },
      rc_object({ hello: rc_string }),
    )

    expect(result).toEqual(
      errorResult(`$.hello: Type 'number' is not assignable to 'string'`),
    )
  })

  test('input properties are wrong', () => {
    const result: RcParseResult<{ hello: string; ok: number; world: string }> =
      rc_parse(
        { hello: 1, ok: '2', world: 'ok' },
        rc_object({ hello: rc_string, ok: rc_number, world: rc_string }),
      )

    expect(result).toEqual(
      errorResult(
        `$.hello: Type 'number' is not assignable to 'string'`,
        `$.ok: Type 'string' is not assignable to 'number'`,
      ),
    )
  })

  test('nested object error', () => {
    const result: RcParseResult<{
      hello: { world: string }
      value: string
    }> = rc_parse(
      { hello: { world: 1 }, value: 'ok' },
      rc_object({
        hello: rc_object({ world: rc_string }),
        value: rc_string,
      }),
    )

    expect(result).toEqual(
      errorResult(`$.hello.world: Type 'number' is not assignable to 'string'`),
    )
  })

  test('2 levels nested object error', () => {
    const result: RcParseResult<{
      hello: { world: { value: number } }
      value: string
    }> = rc_parse(
      { hello: { world: { value: '1' } }, value: 'ok' },
      rc_object({
        hello: rc_object({
          world: rc_object({
            value: rc_number,
          }),
        }),
        value: rc_string,
      }),
    )

    expect(result).toEqual(
      errorResult(
        `$.hello.world.value: Type 'string' is not assignable to 'number'`,
      ),
    )
  })

  test('allow excess properties', () => {
    const input = { id: 4, user: 'hello', excess: 'world' }

    const result = rc_parse(
      input,
      rc_object({ user: rc_string.optional(), id: rc_number }),
    )

    expect(result).toEqual(successResult({ id: 4, user: 'hello' }))
  })

  test('stric object', () => {
    const input = { id: 4, user: 'hello', excess: 'world' }

    const result = rc_parse(
      input,
      rc_strict_obj({ user: rc_string, id: rc_number }),
    )

    expect(result).toEqual(
      errorResult(`Key 'excess' is not defined in the object shape`),
    )
  })

  test('handle optional props', () => {
    const input = { id: 4 }

    const result = rc_parse(
      input,
      rc_object({
        user: rc_string.optional(),
        id: rc_number,
      }),
    )

    expect(result).toEqual(successResult({ id: 4 }))
  })

  test('optional object', () => {
    const input = undefined

    const result = rc_parse(
      input,
      rc_object({
        user: rc_string,
        id: rc_number,
      }).optional(),
    )

    expect(result.error).toBeFalsy()
  })

  test('object with array element error', () => {
    const input = {
      id: 4,
      user: 'hello',
      array: [1, 2, '3'],
    }

    const result = rc_parse(
      input,
      rc_object({
        user: rc_string,
        id: rc_number,
        array: rc_array(rc_number),
      }),
    )

    expect(result).toEqual(
      errorResult(`$.array[2]: Type 'string' is not assignable to 'number'`),
    )
  })

  test('object with array element object error', () => {
    const input = {
      id: 4,
      user: 'hello',
      array: [{ id: 1 }, { id: 2 }, { id: '3' }],
    }

    const result = rc_parse(
      input,
      rc_object({
        user: rc_string,
        id: rc_number,
        array: rc_array(rc_object({ id: rc_number })),
      }),
    )

    expect(result).toEqual(
      errorResult(`$.array[2].id: Type 'string' is not assignable to 'number'`),
    )
  })
})

describe('rc_obj_intersections', () => {
  test('intersection', () => {
    const parser = rc_parser(
      rc_obj_intersection(
        rc_object({
          a: rc_string,
          b: rc_number,
        }),
        rc_object({
          c: rc_string,
        }),
      ),
    )

    const input = { a: 'hello', b: 1, c: 'world' }

    expect(parser(input)).toEqual(
      successResult({
        a: 'hello',
        b: 1,
        c: 'world',
      }),
    )

    const input2 = { a: 'hello', b: 1, c: 2 }

    const result = parser(input2)

    expect(result).toEqual(
      errorResult(`$.c: Type 'number' is not assignable to 'string'`),
    )
  })
})

describe('rc_rename_key', () => {
  const objSchema = {
    id: rc_rename_from_key('user_id', rc_number),
    renamed: rc_rename_from_key('old_name', rc_number),
    name: rc_string,
  }

  const testSchema = rc_object(objSchema)

  const parse = rc_parser(testSchema)

  test('input with renamed key', () => {
    const input = { user_id: 1, old_name: 2, name: 'hello' }

    const result = parse(input)

    expect(result).toEqual(
      successResult({
        id: 1,
        renamed: 2,
        name: 'hello',
      }),
    )
  })

  test('input with original key', () => {
    const input = { id: 1, renamed: 2, name: 'hello' }

    const result = parse(input)

    expect(result).toEqual(
      successResult({
        id: 1,
        renamed: 2,
        name: 'hello',
      }),
    )
  })

  test('input with wrong type', () => {
    const input = { user_id: '1', renamed: 2, name: 'hello' }

    const result = parse(input)

    expect(result).toEqual(
      errorResult(`$.id: Type 'string' is not assignable to 'number'`),
    )
  })

  test('input with wrong keys', () => {
    const input = { user_ids: '1', olds_name: 2, name: 'hello' }

    const result = parse(input)

    expect(result).toEqual(
      errorResult(
        "$.id: Type 'undefined' is not assignable to 'number'",
        "$.renamed: Type 'undefined' is not assignable to 'number'",
      ),
    )
  })

  test('works in rc_strict_obj', () => {
    const input = { user_id: 1, old_name: 2, name: 'hello' }

    const result = rc_parse(input, rc_strict_obj(objSchema))

    expect(result).toEqual(
      successResult({
        id: 1,
        renamed: 2,
        name: 'hello',
      }),
    )
  })

  describe('rc_array with unique key option', () => {
    const helloParser = rc_parser(
      rc_array(
        rc_object({
          id: rc_rename_from_key('oldKey', rc_number),
        }),
        { unique: 'id' },
      ),
    )

    test('invalid input', () => {
      const wrongResult: RcParseResult<{ id: number }[]> = helloParser([
        { oldKey: 1 },
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ])

      expect(wrongResult).toEqual(
        errorResult(`$[1].id: Type 'number' with value "1" is not unique`),
      )
    })

    test('valid input', () => {
      const validInput = [{ oldKey: 1 }, { id: 2 }, { id: 3 }]

      expect(helloParser(validInput)).toMatchInlineSnapshot(
        successResult([{ id: 1 }, { id: 2 }, { id: 3 }]),
      )
    })
  })
})

test('rc_object key name normalization', () => {
  const input = {
    user_id: 1,
    old_name: 2,
    name: 'hello',
  }

  const result = rc_parse(
    input,
    rc_object(
      {
        userId: rc_number,
        oldName: rc_number,
        name: rc_string,
      },
      { normalizeKeysFrom: 'snake_case' },
    ),
  )

  expect(result).toEqual(
    successResult({
      userId: 1,
      oldName: 2,
      name: 'hello',
    }),
  )
})

test('rc_get_obj_schema', () => {
  const baseSchema = rc_object({
    userId: rc_number,
    oldName: rc_number,
    name: rc_string,
  })

  const subSchema = rc_get_obj_schema(baseSchema).name

  expect(rc_parse('hello', subSchema)).toEqual(successResult('hello'))
})

describe('rc_extends_obj', () => {
  test('extends object', () => {
    const schema = rc_extends_obj({
      name: rc_number,
    })

    expect(rc_parse({ name: 1, a: 2, c: 3 }, schema)).toEqual(
      successResult({ name: 1, a: 2, c: 3 }),
    )
  })

  test('extends object with transformed response', () => {
    const schema = rc_extends_obj({
      name: rc_transform(rc_number, (v) => v + 1),
    })

    expect(rc_parse({ name: 1, a: 2, c: 3 }, schema)).toEqual(
      successResult({ name: 2, a: 2, c: 3 }),
    )
  })

  test('extends object with rc_rename_key response', () => {
    const schema = rc_extends_obj({
      newKeyName: rc_rename_from_key('name', rc_number),
    })

    expect(rc_parse({ name: 1, a: 2, c: 3 }, schema)).toEqual(
      successResult({ newKeyName: 1, a: 2, c: 3, name: 1 }),
    )
  })
})

describe('rc_obj_pick', () => {
  const baseSchema = rc_object({
    userId: rc_number,
    oldName: rc_number,
    name: rc_string,
    a: rc_number,
    b: rc_number,
    c: rc_number,
  })

  test('pick keys success', () => {
    const schema = rc_obj_pick(baseSchema, ['userId', 'name'])

    const result = rc_parse({ userId: 1, name: 'hello' }, schema)

    expect(result).toEqual(successResult({ userId: 1, name: 'hello' }))

    rc_assert_is_valid(result)
  })

  test('pick keys excess keys', () => {
    const schema = rc_obj_pick(baseSchema, ['userId', 'name'])

    const result = rc_parse({ userId: 1, name: 'hello', err: 1 }, schema)

    expect(result).toEqual(successResult({ userId: 1, name: 'hello' }))
  })
})

describe('rc_obj_omit', () => {
  const baseSchema = rc_object({
    userId: rc_number,
    oldName: rc_number,
    name: rc_string,
    a: rc_number,
    b: rc_number,
    c: rc_number,
  })

  test('omit keys success', () => {
    const schema = rc_obj_omit(baseSchema, ['userId', 'name'])

    const result = rc_parse({ oldName: 1, a: 2, b: 3, c: 4 }, schema)

    expect(result).toEqual(successResult({ oldName: 1, a: 2, b: 3, c: 4 }))
  })

  test('omit keys excess keys', () => {
    const schema = rc_obj_omit(baseSchema, ['userId', 'name'])

    const result = rc_parse({ oldName: 1, a: 2, b: 3, c: 4, err: 1 }, schema)

    expect(result).toEqual(successResult({ oldName: 1, a: 2, b: 3, c: 4 }))
  })

  test('missing keys', () => {
    const schema = rc_obj_omit(baseSchema, ['userId', 'name'])

    const result = rc_parse({ a: 2, b: 3, c: 4 }, schema)

    expect(result).toEqual(
      errorResult("$.oldName: Type 'undefined' is not assignable to 'number'"),
    )
  })
})

test('reproduce wrong message bug', () => {
  const dataToValidate = [
    {
      attachments: [
        {
          id: 'GpkM0HesSgi5cJZifxGPB-2',
          ext: 'png',
          date: '2023-04-06T15:14',
          file: {
            data: [137, 96, 130],
            type: 'Buffer',
          },
          name: 'Screen Shot',
          size: 306577,
          type: 'image',
          user: {
            id: 82,
            name: 'Teilor Magrin',
          },
          isNew: true,
          status: 'temp_uploaded',
          user_id: 82,
          fileType: 'image/png',
          originalName: 'Screen Shot.png',
        },
      ],
    },
  ]

  const apiFileObjSchema = rc_object({
    id: rc_string,
    name: rc_string,
    originalName: rc_string,
    ext: rc_string,
    fileType: rc_string,
    file: rc_string,
    size: rc_number,
    user_id: rc_number.orNull(),
    videoThumb: rc_string.optional(),
    universal_file: rc_string.optional(),
    transcription: rc_string.optional(),
    short_transcription: rc_string.optional(),
    audio_conversion_status: rc_literals(
      'pending',
      'success',
      'error',
    ).optional(),
  })

  const attachmentsSchema = rc_loose_array(apiFileObjSchema).withFallback([])

  const schema = rc_object({
    attachments: attachmentsSchema.orNullish(),
  })

  const result = rc_parse(dataToValidate, rc_array(schema))

  expect(result).toMatchObject({
    warnings: [
      "$[0].attachments[0]: Fallback used, errors -> $.file: Type 'object' is not assignable to 'string'",
    ],
  })
})
