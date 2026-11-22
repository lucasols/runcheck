import { describe, expect, test } from 'vitest'
import {
  RcInferType,
  RcType,
  rc_array,
  rc_literals,
  rc_number,
  rc_obj_builder,
  rc_object,
  rc_parse,
  rc_readonly,
  rc_string,
  rc_tuple,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'
import { Equal, expectType } from './typingTests.utils'

describe('rc_readonly', () => {
  test('readonly tuple', () => {
    type RecordsSort = readonly [string, 'asc' | 'desc']

    const schema: RcType<RecordsSort> = rc_readonly(
      rc_tuple([rc_string, rc_literals('asc', 'desc')]),
    )

    expectType<Equal<RcInferType<typeof schema>, RecordsSort>>()

    expect(rc_parse(['name', 'asc'], schema)).toEqual(
      successResult(['name', 'asc']),
    )
    expect(rc_parse(['name', 'up'], schema)).toEqual(
      errorResult(
        "$[1]: Type 'string(up)' is not assignable to 'string(asc) | string(desc)'",
      ),
    )
  })

  test('readonly array', () => {
    const schema = rc_readonly(rc_array(rc_number))

    expectType<Equal<RcInferType<typeof schema>, readonly number[]>>()

    expect(rc_parse([1, 2], schema)).toEqual(successResult([1, 2]))
    expect(rc_parse(['1'], schema)).toEqual(
      errorResult("$[0]: Type 'string' is not assignable to 'number'"),
    )
  })

  test('readonly object', () => {
    const schema = rc_readonly(rc_object({ a: rc_string, b: rc_number }))

    expectType<
      Equal<
        RcInferType<typeof schema>,
        Readonly<{ a: string; b: number }>
      >
    >()

    expect(rc_parse({ a: 'a', b: 1 }, schema)).toEqual(
      successResult({ a: 'a', b: 1 }),
    )
  })

  test('chained modifiers keep the readonly type', () => {
    const schema = rc_readonly(rc_array(rc_string)).optional()

    expectType<
      Equal<RcInferType<typeof schema>, readonly string[] | undefined>
    >()

    expect(rc_parse(undefined, schema)).toEqual(successResult(undefined))
  })

  test('readonly nullable distributes over the union', () => {
    const schema = rc_readonly(rc_array(rc_string).orNull())

    expectType<Equal<RcInferType<typeof schema>, readonly string[] | null>>()

    expect(rc_parse(null, schema)).toEqual(successResult(null))
  })

  test('can be used with rc_obj_builder', () => {
    type Query = {
      sort: readonly [string, 'asc' | 'desc']
      ids: readonly number[]
    }

    const schema = rc_obj_builder<Query>()({
      sort: rc_readonly(rc_tuple([rc_string, rc_literals('asc', 'desc')])),
      ids: rc_readonly(rc_array(rc_number)),
    })

    expect(rc_parse({ sort: ['a', 'desc'], ids: [1] }, schema)).toEqual(
      successResult({ sort: ['a', 'desc'], ids: [1] }),
    )
  })
})
