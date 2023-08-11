import { describe, expect, test } from 'vitest'
import {
  RcType,
  rc_array,
  rc_narrow,
  rc_number,
  rc_parse,
  rc_parse_json,
  rc_transform,
  rc_union,
  rc_unsafe_transform,
} from '../src/runcheck'
import { RcParser, rc_parser, rc_string, rc_object } from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('valid and invalid inputs', () => {
  const schema: RcType<number> = rc_transform(rc_string, (s) => s.length)

  const parse: RcParser<number> = rc_parser(schema)

  test('valid input', () => {
    const input = 'hello'

    expect(parse(input)).toEqual(successResult(input.length))
  })

  test('invalid inputs', () => {
    const input = 1

    expect(parse(input)).toEqual(
      errorResult(`Type 'number' is not assignable to 'string'`),
    )
  })
})

test('transform obj property', () => {
  const schema = rc_object({
    hello: rc_transform(rc_string, (s) => s.length),
    test: rc_string,
    str_to_arr: rc_transform(rc_string, (s) => s.split('')),
  })

  const parse = rc_parser(schema)

  const input = { hello: 'world', test: 'test', str_to_arr: 'hello' }

  expect(parse(input)).toEqual(
    successResult({
      hello: 5,
      test: 'test',
      str_to_arr: ['h', 'e', 'l', 'l', 'o'],
    }),
  )
})

describe('transform output validation', () => {
  const schema = rc_object({
    hello: rc_transform(rc_string, (s) => s.length, {
      outputSchema: rc_number,
    }),
    test: rc_string,
    str_to_arr: rc_transform(rc_string, (s) => s.split(''), {
      outputSchema: rc_array(rc_string),
    }),
  })

  const parse = rc_parser(schema)

  const expectedResult = {
    hello: 5,
    test: 'test',
    str_to_arr: ['h', 'e', 'l', 'l', 'o'],
  }

  test('validates input', () => {
    const input = { hello: 'world', test: 'test', str_to_arr: 'hello' }

    expect(parse(input)).toEqual(successResult(expectedResult))
  })

  test('validates output', () => {
    expect(parse(expectedResult)).toEqual(successResult(expectedResult))
  })

  test('invalid value', () => {
    const input = { hello: 'world', test: 'test', str_to_arr: 1 }

    expect(parse(input)).toEqual(
      errorResult(
        `$.str_to_arr|output|: Type 'number' is not assignable to 'string[]'`,
        `$.str_to_arr: Type 'number' is not assignable to 'string'`,
      ),
    )
  })

  test('invalid value at type root', () => {
    const schema2 = rc_transform(rc_string, (s) => s.length, {
      outputSchema: rc_number,
    })

    expect(rc_parse({}, schema2)).toEqual(
      errorResult(
        `$|output|: Type 'object' is not assignable to 'number'`,
        `Type 'object' is not assignable to 'string'`,
      ),
    )
  })

  test('outputSchema is strict by default', () => {
    const schema2 = rc_transform(
      rc_string,
      (s) => ({
        ok: s,
      }),
      {
        outputSchema: rc_object({
          ok: rc_string,
        }),
      },
    )

    expect(
      rc_parse(
        {
          ok: 'hello',
          not_ok: 'world',
        },
        schema2,
      ),
    ).toEqual(
      errorResult(
        `$|output|: Expected strict object with 1 keys but got 2`,
        `Type 'object' is not assignable to 'string'`,
      ),
    )
  })
})

describe('unsafe transform', () => {
  test('valid input', () => {
    const schema = rc_unsafe_transform(rc_string, (s) => ({
      data: s.length,
      ok: true,
    }))

    const parse = rc_parser(schema)

    const input = 'hello'

    expect(parse(input)).toEqual(successResult(input.length))
  })

  test('invalid input', () => {
    const schema = rc_unsafe_transform(rc_string, (s) => ({
      data: s.length,
      ok: true,
    }))

    const parse = rc_parser(schema)

    const input = 1

    expect(parse(input)).toEqual(
      errorResult(`Type 'number' is not assignable to 'string'`),
    )
  })

  test('return error in transform', () => {
    const schema = rc_unsafe_transform(rc_string, (input) =>
      rc_parse_json(input, rc_number),
    )

    const parse = rc_parser(schema)

    const input = 'hello'

    expect(parse(input)).toEqual(
      errorResult(
        `json parsing error: Unexpected token h in JSON at position 0`,
      ),
    )
  })

  test('validate output', () => {
    const schema = rc_unsafe_transform(
      rc_string,
      (input) => rc_parse_json(input, rc_number),
      { outputSchema: rc_number },
    )

    const parse = rc_parser(schema)

    const input = 2

    expect(parse(input)).toEqual(successResult(2))
  })
})

describe('rc_narrow', () => {
  test('types are narrowed', () => {
    const stringOrArrayOfStrings = rc_union(rc_string, rc_array(rc_string))

    const schema = rc_narrow(stringOrArrayOfStrings, (input) =>
      Array.isArray(input) ? input : [input],
    )

    const parse = rc_parser(schema)

    const parseResult = parse('hello')

    expect(parseResult).toEqual(successResult(['hello']))

    if (!parseResult.ok) {
      throw new Error('parseResult should be ok')
    }

    const parsedData = parseResult.data

    const parsedDataResult = rc_parse(parsedData, schema)

    expect(parsedDataResult).toEqual(successResult(['hello']))
  })

  test('invalid narrowing is not allowed', () => {
    const stringOrArrayOfStrings = rc_union(rc_string, rc_array(rc_string))

    rc_narrow(stringOrArrayOfStrings, (input) =>
      // @ts-expect-error -- invalid narrowing
      Array.isArray(input) ? input : [[input]],
    )
  })
})
