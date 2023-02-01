import { describe, expect, test } from 'vitest'
import {
  RcParseResult,
  rc_array,
  rc_number,
  rc_object,
  rc_obj_intersection,
  rc_parse,
  rc_parser,
  rc_rename_key,
  rc_strict_obj,
  rc_string,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('rc_object', () => {
  test('pass', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      { hello: 'world' },
      rc_object({ hello: rc_string }),
    )

    expect(result).toEqual(successResult({ hello: 'world' }))
  })

  test('input is wrong', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      1,
      rc_object({ hello: rc_string }),
    )

    expect(result).toEqual(
      errorResult(`Type 'number' is not assignable to 'object'`),
    )
  })

  test('input is wrong with fallback', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      1,
      rc_object({ hello: rc_string }).withFallback({ hello: 'world' }),
    )

    expect(result).toEqual(
      successResult({ hello: 'world' }, [
        `Fallback used, Type 'number' is not assignable to 'object'`,
      ]),
    )
  })

  test('input property is wrong', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      { hello: 1 },
      rc_object({ hello: rc_string }),
    )

    expect(result).toEqual(
      errorResult(`$.hello: Type 'number' is not assignable to 'string'`),
    )
  })

  test('input properties are wrong', () => {
    const result: RcParseResult<{ hello: string; ok: number; world: string }> =
      rc_parse(
        { hello: 1, ok: '2', world: 'ok' },
        rc_object({ hello: rc_string, ok: rc_number, world: rc_string }),
      )

    expect(result).toEqual(
      errorResult(
        `$.hello: Type 'number' is not assignable to 'string'`,
        `$.ok: Type 'string' is not assignable to 'number'`,
      ),
    )
  })

  test('nested object error', () => {
    const result: RcParseResult<{
      hello: { world: string }
      value: string
    }> = rc_parse(
      { hello: { world: 1 }, value: 'ok' },
      rc_object({
        hello: rc_object({ world: rc_string }),
        value: rc_string,
      }),
    )

    expect(result).toEqual(
      errorResult(`$.hello.world: Type 'number' is not assignable to 'string'`),
    )
  })

  test('2 levels nested object error', () => {
    const result: RcParseResult<{
      hello: { world: { value: number } }
      value: string
    }> = rc_parse(
      { hello: { world: { value: '1' } }, value: 'ok' },
      rc_object({
        hello: rc_object({
          world: rc_object({
            value: rc_number,
          }),
        }),
        value: rc_string,
      }),
    )

    test.todo('nested warning message')

    expect(result).toEqual(
      errorResult(
        `$.hello.world.value: Type 'string' is not assignable to 'number'`,
      ),
    )
  })

  test('allow excess properties', () => {
    const input = { id: 4, user: 'hello', excess: 'world' }

    const result = rc_parse(
      input,
      rc_object({ user: rc_string.optional(), id: rc_number }),
    )

    expect(result).toEqual(successResult({ id: 4, user: 'hello' }))
  })

  test('stric object', () => {
    const input = { id: 4, user: 'hello', excess: 'world' }

    const result = rc_parse(
      input,
      rc_strict_obj({ user: rc_string, id: rc_number }),
    )

    expect(result).toEqual(
      errorResult(`Key 'excess' is not defined in the object shape`),
    )
  })

  test('handle optional props', () => {
    const input = { id: 4 }

    const result = rc_parse(
      input,
      rc_object({
        user: rc_string.optional(),
        id: rc_number,
      }),
    )

    console.log(result)

    expect(result).toEqual(successResult({ id: 4 }))
  })

  test('optional object', () => {
    const input = undefined

    const result = rc_parse(
      input,
      rc_object({
        user: rc_string,
        id: rc_number,
      }).optional(),
    )

    expect(result.error).toBeFalsy()
  })

  test('object with array element error', () => {
    const input = {
      id: 4,
      user: 'hello',
      array: [1, 2, '3'],
    }

    const result = rc_parse(
      input,
      rc_object({
        user: rc_string,
        id: rc_number,
        array: rc_array(rc_number),
      }),
    )

    expect(result).toEqual(
      errorResult(`$.array[2]: Type 'string' is not assignable to 'number'`),
    )
  })

  test('object with array element object error', () => {
    const input = {
      id: 4,
      user: 'hello',
      array: [{ id: 1 }, { id: 2 }, { id: '3' }],
    }

    const result = rc_parse(
      input,
      rc_object({
        user: rc_string,
        id: rc_number,
        array: rc_array(rc_object({ id: rc_number })),
      }),
    )

    expect(result).toEqual(
      errorResult(`$.array[2].id: Type 'string' is not assignable to 'number'`),
    )
  })
})

describe('rc_obj_intersections', () => {
  test('intersection', () => {
    const parser = rc_parser(
      rc_obj_intersection(
        rc_object({
          a: rc_string,
          b: rc_number,
        }),
        rc_object({
          c: rc_string,
        }),
      ),
    )

    const input = { a: 'hello', b: 1, c: 'world' }

    expect(parser(input)).toEqual(
      successResult({
        a: 'hello',
        b: 1,
        c: 'world',
      }),
    )

    const input2 = { a: 'hello', b: 1, c: 2 }

    const result = parser(input2)

    expect(result).toEqual(
      errorResult(`$.c: Type 'number' is not assignable to 'string'`),
    )
  })
})

describe('rc_rename_key', () => {
  const objSchema = {
    id: rc_rename_key('user_id', rc_number),
    renamed: rc_rename_key('old_name', rc_number),
    name: rc_string,
  }

  const testSchema = rc_object(objSchema)

  const parse = rc_parser(testSchema)

  test('input with renamed key', () => {
    const input = { user_id: 1, old_name: 2, name: 'hello' }

    const result = parse(input)

    expect(result).toEqual(
      successResult({
        id: 1,
        renamed: 2,
        name: 'hello',
      }),
    )
  })

  test('input with original key', () => {
    const input = { id: 1, renamed: 2, name: 'hello' }

    const result = parse(input)

    expect(result).toEqual(
      successResult({
        id: 1,
        renamed: 2,
        name: 'hello',
      }),
    )
  })

  test('input with wrong type', () => {
    const input = { user_id: '1', renamed: 2, name: 'hello' }

    const result = parse(input)

    expect(result).toEqual(
      errorResult(`$.id: Type 'string' is not assignable to 'number'`),
    )
  })

  test('input with wrong keys', () => {
    const input = { user_ids: '1', olds_name: 2, name: 'hello' }

    const result = parse(input)

    expect(result).toEqual(
      errorResult(
        "$.id: Type 'undefined' is not assignable to 'number'",
        "$.renamed: Type 'undefined' is not assignable to 'number'",
      ),
    )
  })

  test('works in rc_strict_obj', () => {
    const input = { user_id: 1, old_name: 2, name: 'hello' }

    const result = rc_parse(input, rc_strict_obj(objSchema))

    expect(result).toEqual(
      successResult({
        id: 1,
        renamed: 2,
        name: 'hello',
      }),
    )
  })
})
