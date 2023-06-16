/* eslint-disable @typescript-eslint/no-unused-vars */
// types test

import {
  RcInferType,
  RcType,
  rc_array,
  rc_object,
  rc_required_key,
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
}> = rc_object({
  a: rc_string.optional(),
  array: rc_array(
    rc_object({
      a: rc_string.optional(),
    }),
  ).optional(),
  b: {
    c: rc_string.optional(),
  },
})

const type2 = rc_object({
  a: rc_string.optional(),
  c: rc_required_key(rc_string.optional()),
  b: {
    c: rc_string.optional(),
    cR: rc_required_key(rc_string.optional()),
  },
})

type InferedType = RcInferType<typeof type2>
//      ^?
