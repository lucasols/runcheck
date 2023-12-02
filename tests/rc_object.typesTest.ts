/* eslint-disable @typescript-eslint/no-unused-vars */
// types test

import {
  RcInferType,
  RcType,
  rc_array,
  rc_obj_builder,
  rc_obj_extends,
  rc_object,
  rc_parse,
  rc_string,
} from '../src/runcheck'

const type: RcType<{
  a?: string
  array?: {
    a?: string
  }[]
  b: {
    c?: string
  }
  obj: { a: string | undefined }
}> = rc_object({
  a: rc_string.optionalKey(),
  array: rc_array(
    rc_object({
      a: rc_string.optionalKey(),
    }),
  ).optionalKey(),
  b: {
    c: rc_string.optionalKey(),
  },
  obj: rc_object({ a: rc_string.optional() }),
})

const type2 = rc_object({
  a: rc_string.optionalKey(),
  c: rc_string.optional(),
  b: {
    c: rc_string.optional(),
    cR: rc_string.optional(),
  },
})

type Prettify<T> =
  T extends Record<string, any> ?
    {
      [K in keyof T]: Prettify<T[K]>
    }
  : T

type InferedType = RcInferType<typeof type2>
//      ^?

function test<T>(schema: RcType<T>): T | null {
  const parseResult = rc_parse(
    '',
    rc_object({
      value: schema,
    }),
  )

  if (parseResult.error) {
    return null
  }

  const data = parseResult.data

  type DataType = Prettify<typeof data>

  return data.value
}

const extends_obj = rc_obj_extends({
  a: rc_string.optionalKey(),
  c: rc_string.optional(),
})

const objBuilderWithOptional = rc_obj_builder<{
  orNull: null | { a: string }
  orUndefined: undefined | { a: string }
  orNullish: null | undefined | { a: string }
  optional?: { a: string }
  optionalNullish?: null | { a: string }
}>()({
  orNull: ['null_or:', { a: rc_string }],
  orUndefined: ['optional', { a: rc_string }],
  orNullish: ['nullish_or:', { a: rc_string }],
  optional: ['optional', { a: rc_string }],
  optionalNullish: ['nullish_or:', { a: rc_string }],
})
