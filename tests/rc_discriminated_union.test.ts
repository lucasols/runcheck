import { describe, expect, test } from 'vitest'
import {
  RcType,
  rc_boolean,
  rc_null,
  rc_number,
  rc_object,
  rc_parse,
  rc_string,
  rc_union,
  rc_discriminated_union,
} from '../src/runcheck'
import { errorResult, successResult, typeIsValid } from './testUtils'

describe('rc_discriminated_union', () => {
  const shape = rc_discriminated_union('type', {
    a: { value: rc_string },
    b: { value: rc_number },
    c: { value: rc_boolean },
    d: { value: rc_null },
  })

  typeIsValid<
    RcType<
      | { type: 'a'; value: string }
      | { type: 'b'; value: number }
      | { type: 'c'; value: boolean }
      | { type: 'd'; value: null }
    >
  >(shape)

  test('discriminator fail', () => {
    expect(rc_parse({ type: 1, value: 'hello' }, shape)).toEqual(
      errorResult(`$.type: Type 'number(1)' is not a valid discriminator`),
    )

    expect(rc_parse({ type: 'e', value: 'hello' }, shape)).toEqual(
      errorResult(`$.type: Type 'string(e)' is not a valid discriminator`),
    )
  })

  test('value fail', () => {
    expect(rc_parse({ type: 'a', value: 1 }, shape)).toEqual(
      errorResult(
        "$|type: a|.value: Type 'number' is not assignable to 'string'",
      ),
    )
  })

  test('pass', () => {
    expect(rc_parse({ type: 'a', value: 'hello' }, shape)).toEqual(
      successResult({ type: 'a', value: 'hello' }),
    )

    expect(rc_parse({ type: 'b', value: 1 }, shape)).toEqual(
      successResult({ type: 'b', value: 1 }),
    )
  })

  test('pass with empty object', () => {
    const shape2 = rc_discriminated_union('type', {
      a: {},
      b: { value: rc_number },
    })

    expect(rc_parse({ type: 'a' }, shape2)).toEqual(
      successResult({ type: 'a' }),
    )
  })

  test('value fail in union', () => {
    const shapeInUnion = rc_union(rc_string, shape)

    expect(rc_parse({ type: 'a', value: 1 }, shapeInUnion)).toEqual(
      errorResult(
        "$|union 2||type: a|.value: Type 'number' is not assignable to 'string'",
        'not matches any other union member',
      ),
    )
  })

  test('discriminator fail with union', () => {
    const shapeInUnion = rc_union(rc_string, shape)

    expect(rc_parse({ type: 'e', value: 'hello' }, shapeInUnion)).toEqual(
      errorResult(
        `$|union 2|.type: Type 'string(e)' is not a valid discriminator`,
        'not matches any other union member',
      ),
    )
  })
})
test('passing type in shape object is allowed', () => {
  const shape2: RcType<
    { type: 'a'; value: string } | { type: 'b'; value: number }
  > = rc_discriminated_union('type', {
    a: { type: rc_string, value: rc_string },
    b: { type: rc_string, value: rc_number },
  })

  expect(rc_parse({ type: 'a', value: 'hello' }, shape2)).toEqual(
    successResult({ type: 'a', value: 'hello' }),
  )
})

test('passing rc_object in shape object is allowed', () => {
  const shape2 = rc_discriminated_union('type', {
    a: rc_object({ type: rc_string, value: rc_string }),
    b: rc_object({ value: rc_string }),
  })

  typeIsValid<
    RcType<{ type: 'a'; value: string } | { type: 'b'; value: string }>
  >(shape2)

  expect(rc_parse({ type: 'a', value: 'hello' }, shape2)).toEqual(
    successResult({ type: 'a', value: 'hello' }),
  )
})
