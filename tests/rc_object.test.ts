import { describe, expect, test } from 'vitest'
import { rc_enable_obj_strict, rc_get_obj_shape } from '../src/rc_object'
import {
  RcParseResult,
  rc_array,
  rc_assert_is_valid,
  rc_boolean,
  rc_get_from_key_as_fallback,
  rc_literals,
  rc_loose_array,
  rc_number,
  rc_obj_builder,
  rc_obj_extends,
  rc_obj_merge,
  rc_obj_omit,
  rc_obj_pick,
  rc_obj_strict,
  rc_object,
  rc_parse,
  rc_parser,
  rc_record,
  rc_string,
  rc_transform,
  rc_union,
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
      errorResult(
        `Type 'number' is not assignable to 'object{ hello: string }'`,
      ),
    )
  })

  test('input is wrong with fallback', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      1,
      rc_object({ hello: rc_string }).withFallback({ hello: 'world' }),
    )

    expect(result).toEqual(
      successResult({ hello: 'world' }, [
        `Fallback used, errors -> Type 'number' is not assignable to 'object{ hello: string }'`,
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
    const result = rc_parse(
      { hello: { world: 1 }, value: 'ok', array: [1, 2] },
      rc_object({
        hello: rc_object({ world: rc_string }),
        value: rc_string,
        array: rc_array(rc_number),
      }),
    )

    type Prettify<T> =
      T extends Record<string, any> ?
        {
          [K in keyof T]: Prettify<T[K]>
        }
      : T

    if (!result.error) {
      type Data = Prettify<typeof result.data>

      const _data: Data = {
        hello: { world: '1' },
        value: 'ok',
        array: [1, 2],
      }
    }

    expect(result).toEqual(
      errorResult(`$.hello.world: Type 'number' is not assignable to 'string'`),
    )
  })

  test('2 levels nested object error', () => {
    const result = rc_parse(
      { hello: { world: { value: '1' } }, value: 'ok' },
      rc_object({
        hello: {
          world: {
            value: rc_number,
          },
        },
        value: rc_string,
      }),
    )

    if (!result.error) {
      type Data = typeof result.data

      const _data: Data = { hello: { world: { value: 1 } }, value: 'ok' }
    }

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

describe('rc_obj_merges', () => {
  test('merge', () => {
    const parser = rc_parser(
      rc_obj_merge(
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

describe('rc_get_from_key_as_fallback', () => {
  const objSchema = {
    id: rc_get_from_key_as_fallback('user_id', rc_number),
    renamed: rc_get_from_key_as_fallback('old_name', rc_number),
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

    const result = rc_parse(input, rc_obj_strict(objSchema))

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
          id: rc_get_from_key_as_fallback('oldKey', rc_number),
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

  test('a value parsed with rc_get_from_key_as_fallback can be validated back with the same schema', () => {
    const input = { user_id: 1, excess: 2, name: 'hello' }

    const schema = rc_object({
      id: rc_get_from_key_as_fallback('user_id', rc_number),
      id_copy: rc_get_from_key_as_fallback('user_id', rc_number),
      name: rc_string,
    })

    const result = rc_parse(input, schema)

    if (result.error) {
      throw new Error('unexpected error')
    }

    expect(result).toEqual(
      successResult({
        id: 1,
        id_copy: 1,
        name: 'hello',
      }),
    )

    const result2 = rc_parse(result.data, schema)

    expect(result2).toEqual(
      successResult({
        id: 1,
        id_copy: 1,
        name: 'hello',
      }),
    )
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

  const subSchema = rc_get_obj_shape(baseSchema).name

  expect(rc_parse('hello', subSchema)).toEqual(successResult('hello'))
})

describe('rc_extends_obj', () => {
  test('extends object', () => {
    const schema = rc_obj_extends({
      name: rc_number,
    })

    expect(rc_parse({ name: 1, a: 2, c: 3 }, schema)).toEqual(
      successResult({ name: 1, a: 2, c: 3 }),
    )
  })

  test('extends object with transformed response', () => {
    const schema = rc_obj_extends({
      name: rc_transform(rc_number, (v) => v + 1),
    })

    expect(rc_parse({ name: 1, a: 2, c: 3 }, schema)).toEqual(
      successResult({ name: 2, a: 2, c: 3 }),
    )
  })

  test('extends object with rc_get_from_key_as_fallback response', () => {
    const schema = rc_obj_extends({
      newKeyName: rc_get_from_key_as_fallback('name', rc_number),
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

test('rc_obj_builder', () => {
  type Test = {
    a: string
    b: number
    c?: string
    obj: {
      a: string
      b: number
      array?: number[]
      looseArray: string[]
      veryLongPropertyNameThatShouldBeAutocompleted: string
    }
    objOrNull: {
      a: string
      literal: 'a' | 'b' | 'c'
    } | null
    obj2: {
      a: string
    }
    literal: 'a' | 'b'
    literalInObjArray: null | {
      items: {
        id: string
        type: 'a' | 'b' | 'c'
      }[]
    }
    obj2OrNull?: {
      a: string
    } | null
  }

  const obj2 = rc_object({
    a: rc_string,
  })

  const obj3 = rc_obj_builder<{ a: string }>()({
    a: rc_string,
  })

  const shape = rc_obj_builder<Test>()({
    a: rc_string,
    b: rc_number,
    c: rc_string.optional(),
    obj: {
      a: rc_string,
      b: rc_number,
      array: rc_array(rc_number).optional(),
      looseArray: rc_loose_array(rc_string),
      veryLongPropertyNameThatShouldBeAutocompleted: rc_string,
    },
    objOrNull: rc_object({
      a: rc_string,
      literal: rc_literals('a', 'b', 'c'),
    }).orNull(),
    obj2,
    literal: rc_literals('a', 'b'),
    literalInObjArray: rc_object({
      items: rc_loose_array(
        rc_object({
          id: rc_string,
          type: rc_literals('a', 'b', 'c'),
        }),
      ),
    }).orNull(),
    obj2OrNull: obj3.orNullish(),
  })

  const result = rc_parse(
    {
      a: 'a',
      b: 1,
      c: 'c',
      literal: 'a',
      obj: {
        a: 'a',
        b: 1,
        looseArray: ['a', 'b'],
        veryLongPropertyNameThatShouldBeAutocompleted: 'a',
      },
      objOrNull: null,
      obj2: { a: 'a' },
      literalInObjArray: null,
    },
    shape,
  )

  expect(result).toEqual(successResult(expect.anything()))
})

describe('rc_strict_obj', () => {
  test('stric object', () => {
    const input = { id: 4, user: 'hello', excess: 'world' }

    const result = rc_parse(
      input,
      rc_obj_strict({ user: rc_string, id: rc_number }),
    )

    expect(result).toEqual(
      errorResult(`Key 'excess' is not defined in the object shape`),
    )
  })

  test('rc_enable_obj_strict: use a obj type as input', () => {
    const objSchema = rc_object({ user: rc_string, id: rc_number })

    const strictObjSchema = rc_enable_obj_strict(objSchema)

    const input = { id: 4, user: 'hello', excess: 'world' }

    const result = rc_parse(input, strictObjSchema)

    expect(result).toEqual(
      errorResult(`Key 'excess' is not defined in the object shape`),
    )
  })

  test('rc_enable_obj_strict: use a obj type as input, recursive', () => {
    const objSchema = rc_object({
      user: rc_string,
      id: rc_number,
      obj: rc_object({ user: rc_string, id: rc_number }),
      obj2: { string: rc_string },
    })

    const strictObjSchema = rc_enable_obj_strict(objSchema)

    const input = {
      id: 4,
      user: 'hello',
      obj: { id: 4, user: 'hello', excess: 'world' },
      obj2: { string: 'hello', excess: 'world' },
    }

    const result = rc_parse(input, strictObjSchema)

    expect(result).toEqual(
      errorResult(
        `$.obj: Key 'excess' is not defined in the object shape`,
        `$.obj2: Key 'excess' is not defined in the object shape`,
      ),
    )
  })

  test('rc_enable_obj_strict: disable recursive strict obj', () => {
    const objSchema = rc_object({
      user: rc_string,
      id: rc_number,
      obj: rc_object({ user: rc_string, id: rc_number }),
      obj2: { string: rc_string },
    })

    const strictObjSchema = rc_enable_obj_strict(objSchema, {
      nonRecursive: true,
    })

    const input = {
      id: 4,
      user: 'hello',
      obj: { id: 4, user: 'hello', excess: 'world' },
      obj2: { string: 'hello', excess: 'world' },
    }

    const result = rc_parse(input, strictObjSchema)

    expect(result).toEqual(
      successResult({
        id: 4,
        user: 'hello',
        obj: { id: 4, user: 'hello' },
        obj2: { string: 'hello' },
      }),
    )
  })

  test('rc_enable_obj_strict: recursive should affect objects inside arrays', () => {
    const objSchema = rc_object({
      array: rc_array(rc_object({ id: rc_number, user: rc_string })),
    })

    const strictObjSchema = rc_enable_obj_strict(objSchema)

    const input = {
      array: [
        { id: 4, user: 'hello', excess: 'world' },
        { id: 4, user: 'hello', excess: 'world' },
      ],
    }

    const result = rc_parse(input, strictObjSchema)

    expect(result).toEqual(
      errorResult(
        `$.array[0]: Key 'excess' is not defined in the object shape`,
      ),
    )
  })

  test('input with less keys than the shape', () => {
    const input = { id: 4 }

    const result = rc_parse(
      input,
      rc_obj_strict({ user: rc_string, id: rc_number }),
    )

    expect(result).toEqual(
      errorResult(`$.user: Type 'undefined' is not assignable to 'string'`),
    )
  })

  test('missing and extra keys', () => {
    const input = { id: 4, extra: 'hello', extra2: 'hello' }

    const result = rc_parse(
      input,
      rc_obj_strict({ user: rc_string, id: rc_number }),
    )

    expect(result).toEqual(
      errorResult(
        `Key 'user' is missing`,
        `Key 'extra' is not defined in the object shape`,
        `Key 'extra2' is not defined in the object shape`,
      ),
    )
  })
})

test('rc_obj_builder should return error for wrong schema', () => {
  rc_obj_builder<{ a: string }>()({
    a: rc_string,
    // @ts-expect-error - should return a excess key error
    b: rc_number,
  })

  // @ts-expect-error - should return a missing key error
  rc_obj_builder<{ a: string; b: number }>()({
    a: rc_string,
  })

  rc_obj_builder<{ a: 'ok' | 'wrong' | null }>()({
    // @ts-expect-error - should return a invalid schema error
    a: rc_literals('ok', 'wrong'),
  })

  expect(true).toEqual(true)
})

test('reproduce bug in rc_rename_from_key: return validation error on parsed JSON', () => {
  type LegacyPlanSeatPermissions = {
    current_plan: string
    exceded_actions: boolean
    has_access_pages: boolean
    payment_expired: boolean
    plan_level: string
    can_access_lowcode: boolean
  }

  const planSeatPermissionsSchema = rc_obj_builder<LegacyPlanSeatPermissions>()(
    {
      current_plan: rc_string,
      exceded_actions: rc_boolean,
      has_access_pages: rc_boolean,
      payment_expired: rc_boolean,
      plan_level: rc_string,
      can_access_lowcode: rc_boolean,
    },
  )

  type NewLegacyPlanSeatPermissions = {
    can_create_premium_fields: boolean
    can_create_premium_blocks: boolean
  }

  const newPlanSeatPermissionsSchema =
    rc_obj_builder<NewLegacyPlanSeatPermissions>()({
      can_create_premium_fields: rc_boolean,
      can_create_premium_blocks: rc_boolean,
    })

  const userDataSchema = rc_object({
    plan_seat_permissions: planSeatPermissionsSchema.optional(),
    legacy_plan_permissions: rc_get_from_key_as_fallback(
      'plan_seat_permissions',
      newPlanSeatPermissionsSchema.optional(),
    ),
  })

  const inputJSON =
    '{"data":{"plan_seat_permissions":{"current_plan":"developer","exceded_actions":false,"has_access_pages":true,"payment_expired":false,"plan_level":"developer","can_access_lowcode":true},"legacy_plan_permissions":{"can_create_premium_fields":true,"can_create_premium_blocks":true}},"timestamp":1698724504554,"version":"0","kb":1.6640625}'

  const parsedJSON = JSON.parse(inputJSON)

  expect(parsedJSON).toMatchInlineSnapshot(`
    {
      "data": {
        "legacy_plan_permissions": {
          "can_create_premium_blocks": true,
          "can_create_premium_fields": true,
        },
        "plan_seat_permissions": {
          "can_access_lowcode": true,
          "current_plan": "developer",
          "exceded_actions": false,
          "has_access_pages": true,
          "payment_expired": false,
          "plan_level": "developer",
        },
      },
      "kb": 1.6640625,
      "timestamp": 1698724504554,
      "version": "0",
    }
  `)

  const result = rc_parse(
    JSON.parse(inputJSON),
    rc_object({
      data: userDataSchema,
      timestamp: rc_number,
      version: rc_string,
      kb: rc_number,
    }),
  )

  expect(result.ok && result.data).toMatchInlineSnapshot(`
    {
      "data": {
        "legacy_plan_permissions": {
          "can_create_premium_blocks": true,
          "can_create_premium_fields": true,
        },
        "plan_seat_permissions": {
          "can_access_lowcode": true,
          "current_plan": "developer",
          "exceded_actions": false,
          "has_access_pages": true,
          "payment_expired": false,
          "plan_level": "developer",
        },
      },
      "kb": 1.6640625,
      "timestamp": 1698724504554,
      "version": "0",
    }
  `)
})

describe('rc_obj_builder modifiers', () => {
  describe('optional', () => {
    type Type = {
      obj: undefined | { a: string }
      obj2?: { a: string }
    }

    const shape = rc_obj_builder<Type>()({
      obj: ['optional', { a: rc_string }],
      obj2: ['optional', { a: rc_string }],
    })

    test('pass', () => {
      expect(rc_parse({ obj: { a: 'a' }, obj2: { a: 'a' } }, shape)).toEqual(
        successResult({ obj: { a: 'a' }, obj2: { a: 'a' } }),
      )

      expect(rc_parse({ obj: undefined, obj2: undefined }, shape)).toEqual(
        successResult({}),
      )

      expect(rc_parse({ obj: { a: 'a' } }, shape)).toEqual(
        successResult({ obj: { a: 'a' } }),
      )
    })

    test('fail', () => {
      expect(rc_parse({ obj: null }, shape)).toEqual(
        errorResult(
          `$.obj: Type 'null' is not assignable to 'undefined | object{ a: string }'`,
        ),
      )
    })
  })

  describe('nullish_or', () => {
    type Type = {
      obj: null | undefined | { a: string; b: number }
      obj2?: null | { a: string }
    }

    const shape = rc_obj_builder<Type>()({
      obj: ['nullish_or', { a: rc_string, b: rc_number }],
      obj2: ['nullish_or', { a: rc_string }],
    })

    test('pass', () => {
      expect(
        rc_parse({ obj: { a: 'a', b: 1 }, obj2: { a: 'a' } }, shape),
      ).toEqual(successResult({ obj: { a: 'a', b: 1 }, obj2: { a: 'a' } }))

      expect(rc_parse({ obj: undefined, obj2: undefined }, shape)).toEqual(
        successResult({}),
      )

      expect(rc_parse({ obj: null, obj2: null }, shape)).toEqual(
        successResult({ obj: null, obj2: null }),
      )

      expect(rc_parse({ obj: { a: 'a', b: 2 } }, shape)).toEqual(
        successResult({ obj: { a: 'a', b: 2 } }),
      )
    })

    test('fail', () => {
      expect(rc_parse({ obj: 1 }, shape)).toEqual(
        errorResult(
          `$.obj: Type 'number' is not assignable to 'null | undefined | object{ a: string, b: number }'`,
        ),
      )
    })
  })

  describe('null_or', () => {
    type Type = {
      obj: null | { a: string }
    }

    const shape = rc_obj_builder<Type>()({
      obj: ['null_or', { a: rc_string }],
    })

    test('pass', () => {
      expect(rc_parse({ obj: { a: 'a' } }, shape)).toEqual(
        successResult({ obj: { a: 'a' } }),
      )

      expect(rc_parse({ obj: null }, shape)).toEqual(
        successResult({ obj: null }),
      )
    })

    test('fail', () => {
      expect(rc_parse({ obj: undefined }, shape)).toEqual(
        errorResult(
          `$.obj: Type 'undefined' is not assignable to 'null | object{ a: string }'`,
        ),
      )
    })
  })
})

describe('detailed shape description in error message', () => {
  test('rc_object description is truncated in error message', () => {
    const schema = rc_object({
      a: rc_string,
      b: rc_string,
      c: rc_string,
      d: rc_string,
      e: rc_string,
      f: rc_string,
      g: rc_string,
      h: rc_string,
      i: rc_string,
      j: rc_string,
      k: rc_string,
      l: rc_string,
      m: rc_string,
      n: rc_string,
      o: rc_string,
      p: rc_string,
      q: rc_string,
      r: rc_string,
      s: rc_string,
      t: rc_string,
      u: rc_string,
      v: rc_string,
      w: rc_string,
      x: rc_string,
      y: rc_string,
      z: rc_string,
    })

    const result = rc_parse(1, schema)

    expect(result).toEqual(
      errorResult(
        `Type 'number' is not assignable to 'object{ a: string, b: string, c: string, d: string, e: string, f: string, g: string, h: string, i: string, ... }'`,
      ),
    )
  })

  test('error in union is not detailed', () => {
    const schema = rc_union(rc_string, rc_obj_strict({ a: rc_string }))

    const result = rc_parse(1, schema)

    expect(result).toEqual(
      errorResult(`Type 'number' is not assignable to 'string | strict_obj'`),
    )
  })
})

test('error in empty string key', () => {
  const schema = rc_object({
    '': rc_string,
    record: rc_record(rc_string),
  })

  const result = rc_parse({ '': 1, record: { '': 1 } }, schema)

  expect(result).toEqual(
    errorResult(
      `$['']: Type 'number' is not assignable to 'string'`,
      `$.record['']: Type 'number' is not assignable to 'string'`,
    ),
  )
})
