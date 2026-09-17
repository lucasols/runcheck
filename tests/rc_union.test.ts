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
      errorResult("Type 'boolean' is not assignable to 'string | number'"),
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

test('limit object union errors to 5', () => {
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
      "$|union 2|.b: Type 'undefined' is not assignable to 'number'",
      "$|union 3|.c: Type 'undefined' is not assignable to 'number'",
      "$|union 4|.d: Type 'undefined' is not assignable to 'number'",
      "$|union 5|.e: Type 'undefined' is not assignable to 'number'",
      'not matches any other union member',
    ),
  )
})

test('circuit break in object errors without summarizing members', () => {
  const shape = rc_union(
    rc_object({ a: rc_string, b: rc_number }),
    rc_object({ b: rc_number, c: rc_number }),
    rc_object({ c: rc_number, d: rc_number }),
  )

  expect(rc_parse({ a: 1 }, shape)).toEqual(
    errorResult(
      "$|union 1|.a: Type 'number' is not assignable to 'string'",
      "$|union 2|.b: Type 'undefined' is not assignable to 'number'",
      "$|union 3|.c: Type 'undefined' is not assignable to 'number'",
    ),
  )
})

test('preserve deeper member errors beyond the shallow error limit', () => {
  const shape = rc_object({
    obj: rc_union(
      rc_object({ a: rc_string }),
      rc_object({ b: rc_number }),
      rc_object({ c: rc_number }),
      rc_object({ d: rc_number }),
      rc_object({ e: rc_number }),
      rc_object({ a: rc_number, deeper: rc_number }),
    ),
  })

  expect(rc_parse({ obj: { a: 1 } }, shape)).toEqual(
    errorResult(
      "$.obj|union 6|.deeper: Type 'undefined' is not assignable to 'number'",
      "$.obj|union 1|.a: Type 'number' is not assignable to 'string'",
      "$.obj|union 2|.b: Type 'undefined' is not assignable to 'number'",
      "$.obj|union 3|.c: Type 'undefined' is not assignable to 'number'",
      "$.obj|union 4|.d: Type 'undefined' is not assignable to 'number'",
      "$.obj|union 5|.e: Type 'undefined' is not assignable to 'number'",
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
      "$.obj.a|union 1|: Type 'string' is not assignable to 'undefined'",
      "$.obj.a|union 2|: Type 'string(**)' is not assignable to 'string(*)'",
      "$.obj.a|union 3|: Type 'string' is not assignable to 'object'",
    ),
  )

  expect(rc_parse({ obj: { a: { b: 2 } } }, shape)).toEqual(
    errorResult(
      "$.obj.a|union 1|: Type 'object' is not assignable to 'undefined'",
      "$.obj.a|union 2|: Type 'object' is not assignable to 'string(*)'",
      "$.obj.a|union 3|.a: Type 'undefined' is not assignable to 'string'",
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
    errorResult("Type 'boolean' is not assignable to 'null | number | string'"),
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
      errorResult("Type 'boolean' is not assignable to 'string | number'"),
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
        "$|union 2|.b: Type 'undefined' is not assignable to 'number'",
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
        "$|union 1|: Type 'boolean' is not assignable to 'string | number'",
        "$|union 2|: Type 'boolean' is not assignable to 'object'",
      ),
    )
  })

  test('or with literals', () => {
    const shape = rc_literals('red', 'blue').or(rc_literals('large', 'small'))

    expect(rc_parse('red', shape)).toEqual(successResult('red'))
    expect(rc_parse('large', shape)).toEqual(successResult('large'))

    expect(rc_parse('green', shape)).toEqual(
      errorResult(
        "Type 'string' is not assignable to 'string(red) | string(blue) | string(large) | string(small)'",
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
        "Type 'boolean' is not assignable to 'null | string | null | number'",
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
        "Type 'boolean' is not assignable to 'undefined | string | undefined | number'",
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
      errorResult(
        "$|union 1|[1]: Type 'number' is not assignable to 'string'",
        "$|union 2|[0]: Type 'string' is not assignable to 'number'",
      ),
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
        "$|union 2|.a: Type 'string' is not assignable to 'number'",
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
        "$.type: Type 'string(guest)' is not assignable to 'string(user) | string(admin)'",
      ),
    )
  })
})

describe('union error reporting options', () => {
  const members = [
    rc_object({ a: rc_string }),
    rc_object({ b: rc_number }),
    rc_object({ c: rc_number }),
    rc_object({ d: rc_number }),
    rc_object({ e: rc_number }),
    rc_object({ f: rc_number }),
  ]

  test('does not summarize exactly five members', () => {
    expect(rc_union(...members.slice(0, 5)).parse({})).toEqual(
      errorResult(
        "$|union 1|.a: Type 'undefined' is not assignable to 'string'",
        "$|union 2|.b: Type 'undefined' is not assignable to 'number'",
        "$|union 3|.c: Type 'undefined' is not assignable to 'number'",
        "$|union 4|.d: Type 'undefined' is not assignable to 'number'",
        "$|union 5|.e: Type 'undefined' is not assignable to 'number'",
      ),
    )
  })

  test('Infinity reports members beyond the default limit', () => {
    expect(
      rc_union(...members).parse({}, { unionErrorLimit: Infinity }),
    ).toEqual(
      errorResult(
        "$|union 1|.a: Type 'undefined' is not assignable to 'string'",
        "$|union 2|.b: Type 'undefined' is not assignable to 'number'",
        "$|union 3|.c: Type 'undefined' is not assignable to 'number'",
        "$|union 4|.d: Type 'undefined' is not assignable to 'number'",
        "$|union 5|.e: Type 'undefined' is not assignable to 'number'",
        "$|union 6|.f: Type 'undefined' is not assignable to 'number'",
      ),
    )
  })

  test('a custom limit affects reporting but not successful matching', () => {
    const schema = rc_union(...members)
    expect(schema.parse({}, { unionErrorLimit: 1 })).toEqual(
      errorResult(
        "$|union 1|.a: Type 'undefined' is not assignable to 'string'",
        'not matches any other union member',
      ),
    )
    expect(schema.parse({ f: 1 }, { unionErrorLimit: 1 })).toEqual(
      successResult({ f: 1 }),
    )
  })

  test('a custom limit retains deeper failures ahead of shallow failures', () => {
    const schema = rc_union(
      ...members,
      rc_object({ a: rc_number, missing: rc_string }),
    )
    expect(schema.parse({ a: 1 }, { unionErrorLimit: 1 })).toEqual(
      errorResult(
        "$|union 7|.missing: Type 'undefined' is not assignable to 'string'",
        "$|union 1|.a: Type 'number' is not assignable to 'string'",
        'not matches any other union member',
      ),
    )
  })

  test('Infinity disables property short circuiting in nested unions and JSON parsing', () => {
    const schema = rc_object({
      value: rc_union(
        rc_object({ a: rc_string, b: rc_number }),
        rc_object({ c: rc_string, d: rc_number }),
      ),
    })
    const expected = errorResult(
      "$.value|union 1|.a: Type 'undefined' is not assignable to 'string'",
      "$.value|union 1|.b: Type 'undefined' is not assignable to 'number'",
      "$.value|union 2|.c: Type 'undefined' is not assignable to 'string'",
      "$.value|union 2|.d: Type 'undefined' is not assignable to 'number'",
    )
    expect(schema.parse({ value: {} }, { unionErrorLimit: Infinity })).toEqual(
      expected,
    )
    expect(
      schema.parseJson('{"value":{}}', { unionErrorLimit: Infinity }),
    ).toEqual(expected)
  })

  test('Infinity expands simple unions without changing the default compact format', () => {
    const schema = rc_object({ value: rc_string.or(rc_number) })
    expect(schema.parse({ value: true })).toEqual(
      errorResult(
        "$.value: Type 'boolean' is not assignable to 'string | number'",
      ),
    )
    expect(
      schema.parse({ value: true }, { unionErrorLimit: Infinity }),
    ).toEqual(
      errorResult(
        "$.value|union 1|: Type 'boolean' is not assignable to 'string'",
        "$.value|union 2|: Type 'boolean' is not assignable to 'number'",
      ),
    )
  })

  test('keeps predicate failures visible and labeled on primitive members', () => {
    const schema = rc_union(
      rc_number,
      rc_string.where(() => ({ error: 'invalid filter' })),
    )
    expect(schema.parse('bad')).toEqual(
      errorResult(
        "$|union 1|: Type 'string' is not assignable to 'number'",
        '$|union 2|: Predicate failed: invalid filter',
      ),
    )
  })

  test('discards warnings from failed members and restores paths after success', () => {
    const schema = rc_union(
      rc_object({ a: rc_number.withFallback(1), b: rc_string }),
      rc_object({ valid: rc_string }),
    )
    expect(schema.parse({ valid: 'yes' })).toEqual(
      successResult({ valid: 'yes' }),
    )
    expect(
      schema.where(() => ({ error: 'outer failure' })).parse({ valid: 'yes' }),
    ).toEqual(errorResult('Predicate failed: outer failure'))
  })
})

test('default reporting skips later object property checks while Infinity runs them', () => {
  let calls = 0
  const schema = rc_union(
    rc_object({
      first: rc_string,
      second: rc_number.where(() => {
        calls++
        return { error: 'second property failure' }
      }),
    }),
    rc_number,
  )
  const input = { first: 1, second: 2 }
  expect(schema.parse(input)).toEqual(
    errorResult(
      "$|union 1|.first: Type 'number' is not assignable to 'string'",
      "$|union 2|: Type 'object' is not assignable to 'number'",
    ),
  )
  expect(calls).toBe(0)
  expect(schema.parse(input, { unionErrorLimit: Infinity })).toEqual(
    errorResult(
      "$|union 1|.first: Type 'number' is not assignable to 'string'",
      '$|union 1|.second: Predicate failed: second property failure',
      "$|union 2|: Type 'object' is not assignable to 'number'",
    ),
  )
  expect(calls).toBe(1)
})

describe('collapsing union property type mismatches', () => {
  const schema = rc_union(
    rc_object({ type: rc_literals('user') }),
    rc_object({ type: rc_literals('admin') }),
  )

  test('collapses nested object property errors with the full parent path', () => {
    const nested = rc_object({
      groups: rc_array(rc_object({ member: schema })),
    })
    expect(nested.parse({ groups: [{ member: { type: 'guest' } }] })).toEqual(
      errorResult(
        "$.groups[0].member.type: Type 'string(guest)' is not assignable to 'string(user) | string(admin)'",
      ),
    )
  })

  test('collapses missing properties and identical expected types', () => {
    expect(schema.parse({})).toEqual(
      errorResult(
        "$.type: Type 'undefined' is not assignable to 'string(user) | string(admin)'",
      ),
    )
    const duplicate = rc_union(
      rc_object({ value: rc_number }),
      rc_object({ value: rc_number }),
    )
    expect(duplicate.parse({ value: 'bad' })).toEqual(
      errorResult("$.value: Type 'string' is not assignable to 'number'"),
    )
  })

  test('Infinity preserves every member label instead of collapsing', () => {
    expect(
      schema.parse({ type: 'guest' }, { unionErrorLimit: Infinity }),
    ).toEqual(
      errorResult(
        "$|union 1|.type: Type 'string(guest)' is not assignable to 'string(user)'",
        "$|union 2|.type: Type 'string(guest)' is not assignable to 'string(admin)'",
      ),
    )
  })

  test('does not lose custom predicate failures at the same property', () => {
    const custom = rc_union(
      rc_object({ value: rc_number }),
      rc_object({
        value: rc_string.where(() => ({ error: 'invalid filter' })),
      }),
      rc_object({ value: rc_number }),
    )
    expect(custom.parse({ value: 'bad' })).toEqual(
      errorResult(
        "$.value: Type 'string' is not assignable to 'number'",
        '$|union 2|.value: Predicate failed: invalid filter',
      ),
    )
  })

  test('does not combine different received types or different property paths', () => {
    const differentReceived = rc_union(
      rc_object({ value: rc_number }),
      rc_object({ value: rc_literals('allowed') }),
    )
    expect(differentReceived.parse({ value: 'bad' })).toEqual(
      errorResult(
        "$|union 1|.value: Type 'string' is not assignable to 'number'",
        "$|union 2|.value: Type 'string(bad)' is not assignable to 'string(allowed)'",
      ),
    )
    expect(
      rc_union(rc_object({ a: rc_number }), rc_object({ b: rc_number })).parse(
        {},
      ),
    ).toEqual(
      errorResult(
        "$|union 1|.a: Type 'undefined' is not assignable to 'number'",
        "$|union 2|.b: Type 'undefined' is not assignable to 'number'",
      ),
    )
  })

  test('collapsing does not hide the summary for members beyond a custom limit', () => {
    const limited = rc_union(
      rc_object({ type: rc_literals('user') }),
      rc_object({ type: rc_literals('admin') }),
      rc_object({ type: rc_literals('service') }),
    )
    expect(limited.parse({ type: 'guest' }, { unionErrorLimit: 2 })).toEqual(
      errorResult(
        "$.type: Type 'string(guest)' is not assignable to 'string(user) | string(admin)'",
        'not matches any other union member',
      ),
    )
  })
})
