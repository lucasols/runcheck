import { describe, expect, test } from 'vitest'
import {
  RcType,
  rc_boolean,
  rc_discriminated_union,
  rc_intersection,
  rc_number,
  rc_object,
  rc_parse,
  rc_record,
  rc_string,
  rc_union,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('rc_discriminated_union and rc_object', () => {
  const shape: RcType<
    ({ type: 'a'; value: string } | { type: 'b'; value: number }) & {
      extra: boolean
    }
  > = rc_intersection(
    rc_discriminated_union('type', {
      a: { value: rc_string },
      b: { value: rc_number },
    }),
    rc_object({ extra: rc_boolean }),
  )

  test('pass', () => {
    expect(rc_parse({ type: 'a', value: 'hello', extra: true }, shape)).toEqual(
      successResult({ type: 'a', value: 'hello', extra: true }),
    )
  })

  test('fail at discrimated union', () => {
    expect(rc_parse({ type: 'a', value: 1, extra: true }, shape)).toEqual(
      errorResult(
        "$|type: a|.value: Type 'number' is not assignable to 'string'",
      ),
    )
  })

  test('fail at object', () => {
    expect(rc_parse({ type: 'a', value: 'hello', extra: 1 }, shape)).toEqual(
      errorResult("$.extra: Type 'number' is not assignable to 'boolean'"),
    )
  })
})

describe('rc_object and rc_object', () => {
  const shape: RcType<
    {
      a: string
      b: number
    } & {
      extra: boolean
    }
  > = rc_intersection(
    rc_object({ a: rc_string, b: rc_number }),
    rc_object({ extra: rc_boolean }),
  )

  test('pass', () => {
    expect(rc_parse({ a: 'hello', b: 1, extra: true }, shape)).toEqual(
      successResult({ a: 'hello', b: 1, extra: true }),
    )
  })

  test('fail at first object', () => {
    expect(rc_parse({ a: 1, b: 1, extra: true }, shape)).toEqual(
      errorResult("$.a: Type 'number' is not assignable to 'string'"),
    )
  })

  test('fail at second object', () => {
    expect(rc_parse({ a: 'hello', b: 1, extra: 1 }, shape)).toEqual(
      errorResult("$.extra: Type 'number' is not assignable to 'boolean'"),
    )
  })
})

describe('rc_record and rc_object', () => {
  const validValue: Record<string, string | boolean> & {
    extra: boolean
  } = {
    a: 'hello',
    b: 'world',
    extra: true,
  }

  const shape: RcType<typeof validValue> = rc_intersection(
    rc_record(rc_union(rc_string, rc_boolean)),
    rc_object({ extra: rc_boolean }),
  )

  test('pass', () => {
    expect(rc_parse(validValue, shape)).toEqual(successResult(validValue))
  })

  test('fail at rc_record', () => {
    expect(rc_parse({ a: 1, b: 'world', extra: true }, shape)).toEqual(
      errorResult("$.a: Type 'number' is not assignable to 'string | boolean'"),
    )
  })

  test('fail at rc_object', () => {
    expect(rc_parse({ a: 'hello', b: 'world', extra: '1' }, shape)).toEqual(
      errorResult("$.extra: Type 'string' is not assignable to 'boolean'"),
    )
  })
})

describe('rc_union and rc_union', () => {
  const validValue: (number | string) & (boolean | number) = 1

  const shape: RcType<number> = rc_intersection(
    rc_union(rc_string, rc_number),
    rc_union(rc_boolean, rc_number),
  )

  test('pass', () => {
    expect(rc_parse(validValue, shape)).toEqual(successResult(validValue))
  })

  test('fail at first union', () => {
    expect(rc_parse('hello', shape)).toEqual(
      errorResult(
        "Type 'string' is not assignable to '(string | number) & (boolean | number)'",
      ),
    )
  })

  test('fail at second union', () => {
    expect(rc_parse(true, shape)).toEqual(
      errorResult(
        "Type 'boolean' is not assignable to '(string | number) & (boolean | number)'",
      ),
    )
  })
})
