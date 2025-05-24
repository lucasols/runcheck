import { describe, expect, test } from 'vitest'
import {
  RcType,
  rc_array,
  rc_literals,
  rc_number,
  rc_object,
  rc_parse,
  rc_record,
  rc_string,
  rc_undefined,
  rc_union,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('rc_union', () => {
  test('throw error on empty inpu', () => {
    expect(() => rc_union()).toThrowError()
  })

  const shape: RcType<string | number> = rc_union(rc_string, rc_number)

  test('pass', () => {
    expect(rc_parse('hello', shape)).toEqual(successResult('hello'))

    expect(rc_parse(1, shape)).toEqual(successResult(1))
  })

  test('fail', () => {
    expect(rc_parse(true, shape)).toEqual(
      errorResult(`Type 'boolean' is not assignable to 'string | number'`),
    )
  })

  test('with fallback', () => {
    const result = rc_parse({}, shape.withFallback('world'))

    expect(result).toEqual(
      successResult('world', [
        "Fallback used, errors -> Type 'object' is not assignable to 'string | number'",
      ]),
    )
  })
})

test('limit object union errors to 1', () => {
  const shape = rc_union(
    rc_object({ a: rc_string }),
    rc_object({ b: rc_number }),
    rc_object({ c: rc_number }),
    rc_object({ d: rc_number }),
    rc_object({ e: rc_number }),
    rc_object({ f: rc_number }),
  )

  expect(rc_parse({ a: 1 }, shape)).toEqual(
    errorResult(
      "$|union 1|.a: Type 'number' is not assignable to 'string'",
      'not matches any other union member',
    ),
  )
})

test('circuit break in obj errors', () => {
  const shape = rc_union(
    rc_object({ a: rc_string, b: rc_number }),
    rc_object({ b: rc_number, c: rc_number }),
    rc_object({ c: rc_number, d: rc_number }),
  )

  expect(rc_parse({ a: 1 }, shape)).toEqual(
    errorResult(
      "$|union 1|.a: Type 'number' is not assignable to 'string'",
      'not matches any other union member',
    ),
  )
})

test('show errors with more depth', () => {
  const shape = rc_object({
    obj: rc_union(
      rc_object({ a: rc_string }),
      rc_object({ b: rc_number }),
      rc_object({ c: rc_number }),
      rc_object({ d: rc_number }),
      rc_object({ e: rc_number }),
      rc_object({ a: rc_number, b: rc_number }),
    ),
  })

  expect(rc_parse({ obj: { a: 1 } }, shape)).toEqual(
    errorResult(
      "$.obj|union 6|.b: Type 'undefined' is not assignable to 'number'",
      "$.obj|union 1|.a: Type 'number' is not assignable to 'string'",
      '$.obj: not matches any other union member',
    ),
  )
})

test('show union in error', () => {
  const shape = rc_object({
    obj: rc_record(
      rc_union(rc_undefined, rc_literals('*'), rc_object({ a: rc_string })),
    ),
  })

  expect(rc_parse({ obj: { a: '**' } }, shape)).toEqual(
    errorResult(
      "$.obj.a: Type 'string' is not assignable to 'undefined | string(*) | object'",
    ),
  )

  expect(rc_parse({ obj: { a: { b: 2 } } }, shape)).toEqual(
    errorResult(
      "$.obj.a|union 3|.a: Type 'undefined' is not assignable to 'string'",
      '$.obj.a: not matches any other union member',
    ),
  )
})

describe('nested unions', () => {
  const shape = rc_object({
    obj: rc_union(
      rc_object({ a: rc_string }),
      rc_object({
        c: rc_number,
        b: rc_union(rc_number, rc_string),
        union: rc_union(
          rc_object({
            ok: rc_string,
            a: rc_string,
          }),
          rc_object({ ok: rc_string, b: rc_number }),
        ),
      }),
    ),
  })

  test('pass', () => {
    expect(rc_parse({ obj: { a: 'hello' } }, shape)).toEqual(
      successResult({ obj: { a: 'hello' } }),
    )

    expect(
      rc_parse(
        {
          obj: {
            c: 2,
            b: 1,
            union: { ok: 'ok', b: 2 },
          },
        },
        shape,
      ),
    ).toEqual(
      successResult({
        obj: {
          c: 2,
          b: 1,
          union: { ok: 'ok', b: 2 },
        },
      }),
    )
  })

  test('fail', () => {
    expect(
      rc_parse(
        {
          obj: {
            c: 2,
            b: 1,
            union: { ok: 'ok', a: 2 },
          },
        },
        shape,
      ),
    ).toEqual(
      errorResult(
        "$.obj|union 2|.union|union 1|.a: Type 'number' is not assignable to 'string'",
        "$.obj|union 2|.union|union 2|.b: Type 'undefined' is not assignable to 'number'",
        "$.obj|union 1|.a: Type 'undefined' is not assignable to 'string'",
      ),
    )
  })
})

test('nullable union error', () => {
  const shape = rc_union(rc_number, rc_string).orNull()

  expect(rc_parse(true, shape)).toEqual(
    errorResult(`Type 'boolean' is not assignable to 'null | number | string'`),
  )
})

test('object union', () => {
  const shape = rc_union(
    rc_object({ a: rc_string }),
    rc_object({ b: rc_number }),
  )

  expect(rc_parse({ a: 'hello', b: 1, c: null }, shape)).toEqual(
    successResult({ a: 'hello' }),
  )

  expect(rc_parse({ b: 1, c: null }, shape)).toEqual(successResult({ b: 1 }))
})

describe('or', () => {
  test('basic or with string and number', () => {
    const shape = rc_string.or(rc_number)

    expect(rc_parse('hello', shape)).toEqual(successResult('hello'))
    expect(rc_parse(42, shape)).toEqual(successResult(42))

    expect(rc_parse(true, shape)).toEqual(
      errorResult(`Type 'boolean' is not assignable to 'string | number'`),
    )
  })

  test('or with object types', () => {
    const shape = rc_object({ a: rc_string }).or(rc_object({ b: rc_number }))

    expect(rc_parse({ a: 'hello' }, shape)).toEqual(
      successResult({ a: 'hello' }),
    )

    expect(rc_parse({ b: 42 }, shape)).toEqual(successResult({ b: 42 }))

    expect(rc_parse({ c: 'invalid' }, shape)).toEqual(
      errorResult(
        "$|union 1|.a: Type 'undefined' is not assignable to 'string'",
        'not matches any other union member',
      ),
    )
  })

  test('chained or operations', () => {
    const shape = rc_string.or(rc_number).or(rc_object({ id: rc_string }))

    expect(rc_parse('hello', shape)).toEqual(successResult('hello'))
    expect(rc_parse(42, shape)).toEqual(successResult(42))
    expect(rc_parse({ id: 'test' }, shape)).toEqual(
      successResult({ id: 'test' }),
    )

    expect(rc_parse(true, shape)).toEqual(
      errorResult(
        `Type 'boolean' is not assignable to 'string | number | object'`,
      ),
    )
  })

  test('or with literals', () => {
    const shape = rc_literals('red', 'blue').or(rc_literals('large', 'small'))

    expect(rc_parse('red', shape)).toEqual(successResult('red'))
    expect(rc_parse('large', shape)).toEqual(successResult('large'))

    expect(rc_parse('green', shape)).toEqual(
      errorResult(
        `Type 'string' is not assignable to 'string(red) | string(blue) | string(large) | string(small)'`,
      ),
    )
  })

  test('or with nullable types', () => {
    const shape = rc_string.orNull().or(rc_number.orNull())

    expect(rc_parse('hello', shape)).toEqual(successResult('hello'))
    expect(rc_parse(42, shape)).toEqual(successResult(42))
    expect(rc_parse(null, shape)).toEqual(successResult(null))

    expect(rc_parse(true, shape)).toEqual(
      errorResult(
        `Type 'boolean' is not assignable to 'null | string | null | number'`,
      ),
    )
  })

  test('or with optional types', () => {
    const shape = rc_string.optional().or(rc_number.optional())

    expect(rc_parse('hello', shape)).toEqual(successResult('hello'))
    expect(rc_parse(42, shape)).toEqual(successResult(42))
    expect(rc_parse(undefined, shape)).toEqual(successResult(undefined))

    expect(rc_parse(true, shape)).toEqual(
      errorResult(
        `Type 'boolean' is not assignable to 'undefined | string | undefined | number'`,
      ),
    )
  })

  test('or with arrays', () => {
    const shape = rc_array(rc_string).or(rc_array(rc_number))

    expect(rc_parse(['hello', 'world'], shape)).toEqual(
      successResult(['hello', 'world']),
    )

    expect(rc_parse([1, 2, 3], shape)).toEqual(successResult([1, 2, 3]))

    expect(rc_parse(['hello', 1], shape)).toEqual(
      errorResult(`Type 'array' is not assignable to 'string[] | number[]'`),
    )
  })

  test('or with record types', () => {
    const shape = rc_record(rc_string).or(rc_record(rc_number))

    expect(rc_parse({ a: 'hello', b: 'world' }, shape)).toEqual(
      successResult({ a: 'hello', b: 'world' }),
    )

    expect(rc_parse({ a: 1, b: 2 }, shape)).toEqual(
      successResult({ a: 1, b: 2 }),
    )

    expect(rc_parse({ a: 'hello', b: 1 }, shape)).toEqual(
      errorResult(
        "$|union 1|.b: Type 'number' is not assignable to 'string'",
        'not matches any other union member',
      ),
    )
  })

  test('or with fallback', () => {
    const shape = rc_string.or(rc_number).withFallback('default')

    expect(rc_parse('hello', shape)).toEqual(successResult('hello'))
    expect(rc_parse(42, shape)).toEqual(successResult(42))

    expect(rc_parse(true, shape)).toEqual(
      successResult('default', [
        "Fallback used, errors -> Type 'boolean' is not assignable to 'string | number'",
      ]),
    )
  })

  test('nested or with complex objects', () => {
    const userShape = rc_object({
      type: rc_literals('user'),
      name: rc_string,
    })

    const adminShape = rc_object({
      type: rc_literals('admin'),
      permissions: rc_array(rc_string),
    })

    const shape = userShape.or(adminShape)

    expect(rc_parse({ type: 'user', name: 'John' }, shape)).toEqual(
      successResult({ type: 'user', name: 'John' }),
    )

    expect(
      rc_parse({ type: 'admin', permissions: ['read', 'write'] }, shape),
    ).toEqual(successResult({ type: 'admin', permissions: ['read', 'write'] }))

    expect(rc_parse({ type: 'guest', name: 'John' }, shape)).toEqual(
      errorResult(
        "$|union 1|.type: Type 'string(guest)' is not assignable to 'string(user)'",
        'not matches any other union member',
      ),
    )
  })
})
