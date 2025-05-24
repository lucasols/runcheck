import { describe, expect, test } from 'vitest'
import {
  RcType,
  rc_default,
  rc_nullish_default,
  rc_number,
  rc_object,
  rc_parse,
  rc_parser,
  rc_string,
  rc_transform,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('default', () => {
  const schema: RcType<number> = rc_default(rc_number, 0)

  const parse = rc_parser(schema)

  test('valid input', () => {
    expect(parse(1)).toEqual(successResult(1))
  })

  test('default value', () => {
    expect(parse(undefined)).toEqual(successResult(0))
  })

  test('invalid inputs', () => {
    expect(parse('1')).toEqual(
      errorResult(`Type 'string' is not assignable to 'number'`),
    )
  })

  test('default null value', () => {
    const schema2: RcType<number | null> = rc_default(
      rc_number.orNullish(),
      null,
    )

    const parse2 = rc_parser(schema2)

    expect(parse2(undefined)).toEqual(successResult(null))
    expect(parse2(null)).toEqual(successResult(null))
  })
})

describe('default obj property', () => {
  const schema = rc_object({
    hello: rc_default(rc_number, 0),
    test: rc_string,
  })

  const parse = rc_parser(schema)

  test('default value', () => {
    expect(parse({ test: 'test' })).toEqual(
      successResult({ hello: 0, test: 'test' }),
    )
  })

  test('invalid inputs', () => {
    expect(parse({ hello: '1', test: 'test' })).toEqual(
      errorResult(`$.hello: Type 'string' is not assignable to 'number'`),
    )
  })
})

describe('nullish default', () => {
  const schema = rc_nullish_default(rc_number.orNull(), 0)

  const parse = rc_parser(schema)

  test('default value', () => {
    expect(parse(undefined)).toEqual(successResult(0))
    expect(parse(null)).toEqual(successResult(0))
  })
})

test('make schema optional', () => {
  const schema: RcType<number> = rc_default(rc_number, 0)

  const parse = rc_parser(schema)

  expect(parse(undefined)).toEqual(successResult(0))
})

test('make nullish default nullish', () => {
  const schema: RcType<number> = rc_nullish_default(rc_number, 0)

  const parse = rc_parser(schema)

  expect(parse(undefined)).toEqual(successResult(0))
  expect(parse(null)).toEqual(successResult(0))
})

test('keep transformed value', () => {
  const schema: RcType<number> = rc_default(
    rc_transform(rc_number, (n) => n + 1),
    0,
  )

  const parse = rc_parser(schema)

  expect(parse(1)).toEqual(successResult(2))
})

test('use default on transformed values', () => {
  const schema: RcType<number> = rc_default(
    rc_transform(rc_number, (number) => (number === 1 ? undefined : number)),
    0,
  )

  const parse = rc_parser(schema)

  expect(parse(1)).toEqual(successResult(0))
})

test('rc_default with fallback', () => {
  const result = rc_parse(
    [],
    rc_default(rc_string, 'world').withFallback('world'),
  )

  expect(result).toEqual(
    successResult('world', [
      "Fallback used, errors -> Type 'array' is not assignable to 'string'",
    ]),
  )
})

describe('schema.default() method', () => {
  test('valid input', () => {
    const schema: RcType<number> = rc_number.default(0)
    const parse = rc_parser(schema)
    expect(parse(1)).toEqual(successResult(1))
  })

  test('default value', () => {
    const schema: RcType<number> = rc_number.default(0)
    const parse = rc_parser(schema)
    expect(parse(undefined)).toEqual(successResult(0))
  })

  test('invalid inputs', () => {
    const schema: RcType<number> = rc_number.default(0)
    const parse = rc_parser(schema)
    expect(parse('1')).toEqual(
      errorResult(`Type 'string' is not assignable to 'number'`),
    )
  })

  test('default null value', () => {
    const schema: RcType<number | null> = rc_number.orNullish().default(null)
    const parse = rc_parser(schema)

    expect(parse(undefined)).toEqual(successResult(null))
    expect(parse(null)).toEqual(successResult(null))
  })

  test('default with object property', () => {
    const schema: RcType<{ hello: number; test: string }> = rc_object({
      hello: rc_number.default(0),
      test: rc_string,
    })
    const parse = rc_parser(schema)

    expect(parse({ test: 'test' })).toEqual(
      successResult({ hello: 0, test: 'test' }),
    )
  })

  test('keep transformed value', () => {
    const schema: RcType<number> = rc_transform(
      rc_number,
      (n) => n + 1,
    ).default(0)
    const parse = rc_parser(schema)
    expect(parse(1)).toEqual(successResult(2))
  })

  test('use default on transformed values', () => {
    const schema: RcType<number> = rc_transform(rc_number, (n) =>
      n === 1 ? undefined : n,
    ).default(0)
    const parse = rc_parser(schema)
    expect(parse(1)).toEqual(successResult(0))
  })

  test('withFallback after default', () => {
    const schema: RcType<string> = rc_string
      .default('hello')
      .withFallback('world')
    const result = rc_parse([], schema)

    expect(result).toEqual(
      successResult('world', [
        "Fallback used, errors -> Type 'array' is not assignable to 'string'",
      ]),
    )
  })

  test('optional and default', () => {
    const schema: RcType<number> = rc_number.optional().default(0)
    const parse = rc_parser(schema)
    expect(parse(undefined)).toEqual(successResult(0))
    expect(parse(1)).toEqual(successResult(1))
  })
})

describe('schema.nullishDefault() method', () => {
  test('valid input', () => {
    const schema: RcType<number> = rc_number.nullishDefault(0)
    const parse = rc_parser(schema)
    expect(parse(1)).toEqual(successResult(1))
  })

  test('nullish default for undefined', () => {
    const schema: RcType<number> = rc_number.nullishDefault(0)
    const parse = rc_parser(schema)
    expect(parse(undefined)).toEqual(successResult(0))
  })

  test('nullish default for null', () => {
    const schema: RcType<number> = rc_number.nullishDefault(0)
    const parse = rc_parser(schema)
    expect(parse(null)).toEqual(successResult(0))
  })

  test('invalid inputs', () => {
    const schema: RcType<number> = rc_number.nullishDefault(0)
    const parse = rc_parser(schema)
    expect(parse('1')).toEqual(
      errorResult(`Type 'string' is not assignable to 'number'`),
    )
  })

  test('nullish default with function', () => {
    const schema: RcType<number> = rc_number.nullishDefault(() => 42)
    const parse = rc_parser(schema)
    expect(parse(null)).toEqual(successResult(42))
    expect(parse(undefined)).toEqual(successResult(42))
  })

  test('nullish default with object property', () => {
    const schema: RcType<{ hello: number; test: string }> = rc_object({
      hello: rc_number.nullishDefault(0),
      test: rc_string,
    })
    const parse = rc_parser(schema)

    expect(parse({ test: 'test' })).toEqual(
      successResult({ hello: 0, test: 'test' }),
    )
    expect(parse({ hello: null, test: 'test' })).toEqual(
      successResult({ hello: 0, test: 'test' }),
    )
  })

  test('keep transformed value', () => {
    const schema: RcType<number> = rc_transform(
      rc_number,
      (n) => n + 1,
    ).nullishDefault(0)
    const parse = rc_parser(schema)
    expect(parse(1)).toEqual(successResult(2))
  })

  test('use nullish default on transformed values that return null', () => {
    const schema: RcType<number> = rc_transform(rc_number, (n) =>
      n === 1 ? null : n,
    ).nullishDefault(0)
    const parse = rc_parser(schema)
    expect(parse(1)).toEqual(successResult(0))
  })

  test('use nullish default on transformed values that return undefined', () => {
    const schema: RcType<number> = rc_transform(rc_number, (n) =>
      n === 1 ? undefined : n,
    ).nullishDefault(0)
    const parse = rc_parser(schema)
    expect(parse(1)).toEqual(successResult(0))
  })

  test('withFallback after nullishDefault', () => {
    const schema: RcType<string> = rc_string
      .nullishDefault('hello')
      .withFallback('world')
    const result = rc_parse([], schema)

    expect(result).toEqual(
      successResult('world', [
        "Fallback used, errors -> Type 'array' is not assignable to 'string'",
      ]),
    )
  })

  test('nullishDefault with orNullish schema', () => {
    const schema: RcType<number> = rc_number.orNullish().nullishDefault(42)
    const parse = rc_parser(schema)

    expect(parse(1)).toEqual(successResult(1))
    expect(parse(null)).toEqual(successResult(42))
    expect(parse(undefined)).toEqual(successResult(42))
  })
})
