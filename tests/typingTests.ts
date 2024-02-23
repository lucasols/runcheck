/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  RcInferType,
  RcType,
  joinAsRcTypeUnion,
  rc_boolean,
  rc_literals,
  rc_number,
  rc_obj_builder,
  rc_object,
  rc_string,
  rc_undefined,
  rc_union,
} from '../src/runcheck'
import { Equal, test, expectType, describe } from './typingTests.utils'

test('obj types optional keys', () => {
  const type2 = rc_object({
    a: rc_string.optionalKey(),
    c: rc_string.optional(),
    b: {
      c: rc_string.optional(),
      cR: rc_string.optionalKey(),
    },
  })

  type InferedType = RcInferType<typeof type2>

  expectType<
    Equal<
      InferedType,
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
