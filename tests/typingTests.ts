/* eslint-disable @typescript-eslint/ban-ts-comment */
import { rc_discriminated_union_builder } from '../src/rc_discriminated_union'
import {
  RcInferType,
  RcType,
  joinAsRcTypeUnion,
  rc_boolean,
  rc_get_obj_shape,
  rc_literals,
  rc_null,
  rc_number,
  rc_obj_builder,
  rc_obj_omit,
  rc_obj_pick,
  rc_object,
  rc_string,
  rc_undefined,
  rc_union,
} from '../src/runcheck'
import { Equal, describe, expectType, test } from './typingTests.utils'

test('obj types optional keys', () => {
  const type2 = rc_object({
    a: rc_string.optionalKey(),
    c: rc_string.optional(),
    b: {
      c: rc_string.optional(),
      cR: rc_string.optionalKey(),
    },
  })

  type InferredType = RcInferType<typeof type2>

  expectType<
    Equal<
      InferredType,
      {
        a?: string | undefined
        c: string | undefined
        b: {
          c: string | undefined
          cR?: string | undefined
        }
      }
    >
  >()
})

function union(a: string | number) {
  return a
}

const testA: string = 'a'

union(testA)

describe('rc_obj_builder', () => {
  test('should return error if has a missing key', () => {
    type Test = {
      a: string
      b?: number
      undef?: undefined
    }

    // @ts-expect-error
    rc_obj_builder<Test>()({
      a: rc_string,
    })

    // @ts-expect-error
    rc_obj_builder<Test>()({
      a: rc_string,
      b: rc_number.optional(),
    })

    rc_obj_builder<Test>()({
      a: rc_string,
      b: rc_number.optional(),
      undef: rc_undefined,
    })
  })

  test('wrong types errors are localized', () => {
    type Test = {
      a: string
      b: number
    }

    rc_obj_builder<Test>()({
      a: rc_string,
      // @ts-expect-error
      b: rc_string,
    })

    rc_obj_builder<Test>()({
      a: rc_string,
      b: rc_number,
    })
  })

  test('extra properties should return error', () => {
    type Test = {
      a: string
      b: number
    }

    rc_obj_builder<Test>()({
      a: rc_string,
      b: rc_number,
      // @ts-expect-error
      c: rc_string,
    })
  })

  test('union types with missing members should return error', () => {
    type Test = {
      a: string
      b: number | string
    }

    rc_obj_builder<Test>()({
      a: rc_string,
      // @ts-expect-error
      b: rc_string,
    })

    rc_obj_builder<Test>()({
      a: rc_string,
      b: rc_union(rc_number, rc_string),
    })
  })

  test('union types with missing literal members should return error', () => {
    type Test = {
      a: string
      b: 'a' | 'b' | 'c'
    }

    rc_obj_builder<Test>()({
      a: rc_string,
      // @ts-expect-error
      b: rc_literals('a', 'b'),
    })

    rc_obj_builder<Test>()({
      a: rc_string,
      b: rc_literals('a', 'b', 'c'),
    })
  })

  test('union types with extra members should return error', () => {
    type Test = {
      a: string
      b: number | string
    }

    rc_obj_builder<Test>()({
      a: rc_string,
      // @ts-expect-error
      b: rc_union(rc_number, rc_string, rc_boolean),
    })
  })

  test('union with number literals should not be widen', () => {
    type Test = {
      a: string
      b: 0 | 1
    }

    rc_obj_builder<Test>()({
      a: rc_string,
      // @ts-expect-error
      b: rc_number,
    })
  })

  test('object with extra properties should return error', () => {
    type Test = {
      a: string
      obj: {
        a: string
      }
    }

    rc_obj_builder<Test>()({
      a: rc_string,
      obj: {
        a: rc_string,
        // @ts-expect-error
        b: rc_number,
      },
    })
  })

  test('object unions should use rc_union', () => {
    type Test = {
      a: string
      union:
        | {
            type: 'a'
          }
        | {
            type: 'b'
          }
    }

    rc_obj_builder<Test>()({
      a: rc_string,
      union: {
        // @ts-expect-error
        type: rc_literals('a', 'b'),
      },
    })
  })

  test('object unions with missing members should return error', () => {
    type Test = {
      a: string
      union:
        | {
            type: 'a'
          }
        | {
            type: 'b'
          }
        | {
            type: 'c'
          }
    }

    rc_obj_builder<Test>()({
      a: rc_string,
      // @ts-expect-error
      union: rc_union(
        rc_object({
          type: rc_literals('a'),
        }),
        rc_object({
          type: rc_literals('c'),
        }),
      ),
    })
  })
})

describe('joinAsRcTypeUnion', () => {
  test('simple types', () => {
    const type: RcType<string> | RcType<number> = rc_string as any

    const joinedType = joinAsRcTypeUnion(type)
    //      ^?

    expectType<Equal<typeof joinedType, RcType<string | number>>>()
  })

  test('object types', () => {
    const type: RcType<{ a: string }> | RcType<{ b: number }> = rc_object({
      a: rc_string,
    }) as any

    const joinedType = joinAsRcTypeUnion(type)
    //      ^?

    expectType<
      Equal<typeof joinedType, RcType<{ a: string } | { b: number }>>
    >()
  })
})

describe('rc_discriminated_union_builder', () => {
  test('ok', () => {
    type DiscUnion =
      | { type: 'a'; value: string }
      | { type: 'b'; value: number }
      | { type: 'c'; value: boolean }
      | { type: 'd'; value: null }

    const type = rc_discriminated_union_builder<DiscUnion, 'type'>('type')({
      a: { value: rc_string },
      b: { value: rc_number },
      c: { value: rc_boolean },
      d: { value: rc_null },
    })

    expectType<Equal<RcInferType<typeof type>, DiscUnion>>()
  })

  test('should return error if has a wrong member type', () => {
    type DiscUnion = { type: 'a'; value: string } | { type: 'b'; value: number }

    rc_discriminated_union_builder<DiscUnion, 'type'>('type')({
      a: {
        // @ts-expect-error
        value: rc_number,
      },
      b: { value: rc_number },
    })
  })

  test('should return error if has extra discriminator', () => {
    type DiscUnion = { type: 'a'; value: string } | { type: 'b'; value: number }

    rc_discriminated_union_builder<DiscUnion, 'type'>('type')({
      a: { value: rc_string },
      b: { value: rc_number },
      // @ts-expect-error
      c: { value: rc_boolean },
    })
  })

  test('should return error if has missing discriminator', () => {
    type DiscUnion = { type: 'a'; value: string } | { type: 'b'; value: number }

    // @ts-expect-error
    rc_discriminated_union_builder<DiscUnion, 'type'>('type')({
      a: { value: rc_string },
    })
  })

  test('should return error if has a missing member key', () => {
    type DiscUnion =
      | { type: 'a'; value: string; extra: boolean }
      | { type: 'b'; value: number }

    rc_discriminated_union_builder<DiscUnion, 'type'>('type')({
      // @ts-expect-error
      a: {
        value: rc_string,
      },
      b: { value: rc_number },
    })
  })

  test('should return error if has extra member key', () => {
    type DiscUnion = { type: 'a'; value: string } | { type: 'b'; value: number }

    rc_discriminated_union_builder<DiscUnion, 'type'>('type')({
      a: { value: rc_string },
      b: {
        value: rc_number,
        // @ts-expect-error
        extra: true,
      },
    })
  })

  test('should return error if has a missing member obj key', () => {
    type DiscUnion =
      | {
          type: 'a'
          value: {
            a: string
            b: number
          }
        }
      | { type: 'b'; value: number }

    rc_discriminated_union_builder<DiscUnion, 'type'>('type')({
      a: {
        // @ts-expect-error
        value: { a: rc_string },
      },
      b: {
        value: rc_number,
      },
    })
  })

  test('should return error if has extra member obj key', () => {
    type DiscUnion =
      | {
          type: 'a'
          value: {
            a: string
          }
        }
      | { type: 'b'; value: number }

    rc_discriminated_union_builder<DiscUnion, 'type'>('type')({
      a: {
        value: {
          a: rc_string,
          // @ts-expect-error
          b: rc_number,
        },
      },
      b: {
        value: rc_number,
      },
    })
  })
})

describe('obj shape manipulation', () => {
  test('rc_get_obj_shape', () => {
    const shape = rc_get_obj_shape(
      rc_object({
        a: rc_string,
        b: rc_number,
      }),
    )

    expectType<
      Equal<
        typeof shape,
        {
          a: RcType<string>
          b: RcType<number>
        }
      >
    >()
  })

  test('rc_obj_omit', () => {
    const objSchema = rc_obj_omit(
      rc_object({
        a: rc_string,
        b: rc_number,
        c: rc_boolean,
      }),
      ['a'],
    )

    expectType<
      Equal<
        typeof objSchema,
        RcType<{
          b: number
          c: boolean
        }>
      >
    >()
  })

  test('rc_obj_pick', () => {
    const objSchema = rc_obj_pick(
      rc_object({
        a: rc_string,
        b: rc_number,
        c: rc_boolean,
      }),
      ['a'],
    )

    expectType<
      Equal<
        typeof objSchema,
        RcType<{
          a: string
        }>
      >
    >()
  })
})
