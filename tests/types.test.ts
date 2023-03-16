import { describe, expect, test } from 'vitest'
import {
  RcParseResult,
  RcType,
  rc_any,
  rc_boolean,
  rc_date,
  rc_instanceof,
  rc_is_valid,
  rc_literals,
  rc_null,
  rc_number,
  rc_parse,
  rc_parser,
  rc_string,
  rc_undefined,
  rc_union,
  rc_unknown,
  rc_validator,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('rc_string', () => {
  test('pass', () => {
    const result: RcParseResult<string> = rc_parse('hello', rc_string)

    expect(result).toEqual(successResult('hello'))
  })

  test('fail', () => {
    const result = rc_parse(1, rc_string)

    expect(result).toEqual(
      errorResult(`Type 'number' is not assignable to 'string'`),
    )
  })

  test('with fallback', () => {
    expect(rc_parse(1, rc_string.withFallback('world'))).toEqual(
      successResult('world', [
        "Fallback used, Type 'number' is not assignable to 'string'",
      ]),
    )
  })

  test('extra checks', () => {
    expect(
      rc_parse(
        'hello',
        rc_string.where((input) => input.length === 6),
      ),
    ).toEqual(
      errorResult(`Type 'string' is not assignable to 'string_with_predicate'`),
    )
  })
})

describe('rc_number', () => {
  test('pass', () => {
    const result: RcParseResult<number> = rc_parse(1, rc_number)

    expect(result).toEqual(successResult(1))
  })

  test('fail', () => {
    expect(rc_parse('1', rc_number)).toEqual(
      errorResult(`Type 'string' is not assignable to 'number'`),
    )

    expect(rc_parse(NaN, rc_number).error).toBeTruthy()

    expect(rc_parse(NaN, rc_number.withFallback(5))).toEqual(
      successResult(5, [
        "Fallback used, Type 'number' is not assignable to 'number'",
      ]),
    )
  })

  test('extra checks', () => {
    expect(
      rc_parse(
        2,
        rc_number.where((input) => input < 2),
      ),
    ).toEqual(
      errorResult(`Type 'number' is not assignable to 'number_with_predicate'`),
    )
  })
})

describe('rc_undefined or optional', () => {
  test('rc_undefined', () => {
    expect(rc_is_valid(undefined, rc_undefined)).toBeTruthy()
    expect(rc_is_valid('sdf', rc_undefined)).toBeFalsy()
  })

  test('optional', () => {
    expect(rc_is_valid(undefined, rc_string.optional())).toBeTruthy()
    expect(rc_is_valid('sdf', rc_string.optional())).toBeTruthy()

    expect(rc_is_valid(2, rc_string.optional())).toBeFalsy()
  })
})

describe('rc_null or nullish or nullable', () => {
  test('rc_null', () => {
    expect(rc_is_valid(null, rc_null)).toBeTruthy()
    expect(rc_is_valid('sdf', rc_null)).toBeFalsy()
  })

  test('orNullish', () => {
    const validator = rc_validator(rc_string.orNullish())

    expect(validator(null)).toBeTruthy()
    expect(validator(undefined)).toBeTruthy()
    expect(validator('sdf')).toBeTruthy()

    expect(validator(2)).toBeFalsy()
  })

  test('or Nullable', () => {
    const validator = rc_validator(rc_string.orNull())

    expect(validator(null)).toBeTruthy()
    expect(validator(undefined)).toBeFalsy()
    expect(validator('sdfs')).toBeTruthy()

    expect(validator(2)).toBeFalsy()
  })
})

test('rc_any', () => {
  expect(rc_is_valid(null, rc_any)).toBeTruthy()
  expect(rc_is_valid(undefined, rc_any)).toBeTruthy()
  expect(rc_is_valid('sdf', rc_any)).toBeTruthy()
})

test('rc_unknown', () => {
  expect(rc_is_valid(null, rc_unknown)).toBeTruthy()
  expect(rc_is_valid(undefined, rc_unknown)).toBeTruthy()
  expect(rc_is_valid('sdf', rc_unknown)).toBeTruthy()
})

test('rc_boolean', () => {
  expect(rc_is_valid(true, rc_boolean)).toBeTruthy()
  expect(rc_is_valid(undefined, rc_boolean)).toBeFalsy()
})

test('rc_date', () => {
  expect(rc_is_valid(new Date(), rc_date)).toBeTruthy()

  expect(rc_is_valid(true, rc_date)).toBeFalsy()
})

test('rc_instanceof', () => {
  class MyClass {}
  const validator = rc_parser(rc_instanceof(MyClass))

  expect(validator(new MyClass()).error).toBeFalsy()
  expect(validator(true)).toMatchInlineSnapshot(`
    {
      "error": true,
      "errors": [
        "Type 'boolean' is not assignable to 'instanceof__MyClass'",
      ],
    }
  `)

  expect(rc_parse(new Date(2022, 8), rc_instanceof(Date)))
    .toMatchInlineSnapshot(`
      {
        "data": 2022-09-01T03:00:00.000Z,
        "error": false,
        "warnings": false,
      }
    `)
})

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
        "Fallback used, Type 'object' is not assignable to 'string | number'",
      ]),
    )
  })
})

describe('rc_literal', () => {
  test('simple input', () => {
    const helloParser = rc_parser(rc_literals('hello'))

    const result: RcParseResult<'hello'> = helloParser('hello')

    expect(result).toEqual(successResult('hello'))

    expect(helloParser('world')).toEqual(
      errorResult("Type 'string(world)' is not assignable to 'string_literal'"),
    )
  })

  test('multiple inputs', () => {
    const helloParser = rc_parser(rc_literals('hello', 'world'))

    const result: RcParseResult<'hello' | 'world'> = helloParser('hello')

    expect(result).toEqual(successResult('hello'))

    expect(helloParser('world')).toEqual(successResult('world'))

    expect(helloParser('worlds')).toEqual(
      errorResult("Type 'string(worlds)' is not assignable to 'literals'"),
    )

    expect(helloParser(undefined)).toEqual(
      errorResult("Type 'undefined' is not assignable to 'literals'"),
    )
  })

  test('literal types', () => {
    expect(rc_parse(1, rc_literals(1))).toEqual(successResult(1))

    expect(rc_parse(2, rc_literals(1))).toEqual(
      errorResult("Type 'number(2)' is not assignable to 'number_literal'"),
    )

    expect(rc_parse(2, rc_literals(1, 2))).toEqual(successResult(2))

    expect(rc_parse(true, rc_literals(true))).toEqual(successResult(true))

    expect(rc_parse(false, rc_literals(true))).toEqual(
      errorResult(
        "Type 'boolean(false)' is not assignable to 'boolean_literal'",
      ),
    )
  })
})
